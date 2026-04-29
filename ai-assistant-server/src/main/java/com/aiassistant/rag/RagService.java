package com.aiassistant.rag;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Retrieval-Augmented Generation service. Coordinates embedding, vector search, and context
 * injection into the LLM prompt.
 *
 * <p>Usage flow: 1. Ingest documents via {@link #ingest} 2. At chat time, call {@link
 * #retrieveContext} to get relevant chunks 3. The LlmService prepends the context to the system
 * prompt
 */
public class RagService {

    private static final Logger log = LoggerFactory.getLogger(RagService.class);
    private static final int DEFAULT_CHUNK_SIZE = 500;
    private static final int DEFAULT_CHUNK_OVERLAP = 50;
    private static final int DEFAULT_TOP_K = 5;
    private static final double DEFAULT_SCORE_THRESHOLD = 0.3;

    private final EmbeddingProvider embeddingProvider;
    private final VectorStore vectorStore;

    public RagService(EmbeddingProvider embeddingProvider, VectorStore vectorStore) {
        this.embeddingProvider = embeddingProvider;
        this.vectorStore = vectorStore;
    }

    /** Ingest a document: split into chunks, embed, and store in vector DB. */
    public int ingest(
            String namespace, String docId, String content, Map<String, String> metadata) {
        List<String> chunks = chunkText(content, DEFAULT_CHUNK_SIZE, DEFAULT_CHUNK_OVERLAP);
        if (chunks.isEmpty()) return 0;

        List<float[]> embeddings = embeddingProvider.embedBatch(chunks);
        if (embeddings == null || embeddings.size() != chunks.size()) {
            log.error(
                    "Embedding count mismatch: expected {} but got {}",
                    chunks.size(),
                    embeddings == null ? 0 : embeddings.size());
            throw new RuntimeException("Embedding count mismatch for document: " + docId);
        }
        List<VectorStore.Document> docs = new ArrayList<>();
        for (int i = 0; i < chunks.size(); i++) {
            String chunkId = docId + "#" + i;
            Map<String, String> meta =
                    new java.util.HashMap<>(metadata != null ? metadata : Map.of());
            meta.put("sourceDocId", docId);
            meta.put("chunkIndex", String.valueOf(i));
            docs.add(
                    new VectorStore.Document(
                            chunkId, namespace, chunks.get(i), embeddings.get(i), meta));
        }
        vectorStore.upsert(docs);
        log.info(
                "Ingested document '{}' into namespace '{}': {} chunks",
                docId,
                namespace,
                chunks.size());
        return chunks.size();
    }

    /** Ingest raw text without a specific docId. */
    public int ingest(String namespace, String content) {
        return ingest(namespace, UUID.randomUUID().toString(), content, Map.of());
    }

    /** Retrieve relevant context chunks for a user query. */
    public List<VectorStore.SearchResult> retrieveContext(
            String query, String namespace, int topK) {
        float[] queryVec = embeddingProvider.embed(query);
        List<VectorStore.SearchResult> results = vectorStore.search(queryVec, topK, namespace);
        return results.stream().filter(r -> r.score() >= DEFAULT_SCORE_THRESHOLD).toList();
    }

    public List<VectorStore.SearchResult> retrieveContext(String query, String namespace) {
        return retrieveContext(query, namespace, DEFAULT_TOP_K);
    }

    /** Build context string to inject into the system prompt. */
    public String buildContextPrompt(String query, String namespace) {
        List<VectorStore.SearchResult> results = retrieveContext(query, namespace);
        if (results.isEmpty()) return "";
        StringBuilder sb = new StringBuilder();
        sb.append("以下是从知识库中检索到的相关参考信息，请基于这些信息回答用户问题。如果信息不足，请说明。\n\n");
        for (int i = 0; i < results.size(); i++) {
            sb.append("---[参考 ").append(i + 1).append("]---\n");
            sb.append(results.get(i).content()).append("\n\n");
        }
        return sb.toString();
    }

    public long documentCount(String namespace) {
        return vectorStore.count(namespace);
    }

    static List<String> chunkText(String text, int chunkSize, int overlap) {
        if (text == null || text.isBlank()) return List.of();
        int safeOverlap = Math.max(0, Math.min(overlap, chunkSize - 1));
        int step = chunkSize - safeOverlap;
        if (step <= 0) step = chunkSize;
        List<String> chunks = new ArrayList<>();
        int length = text.length();
        int start = 0;
        while (start < length) {
            int end = Math.min(start + chunkSize, length);
            chunks.add(text.substring(start, end).trim());
            start += step;
        }
        return chunks.stream().filter(s -> !s.isEmpty()).toList();
    }
}
