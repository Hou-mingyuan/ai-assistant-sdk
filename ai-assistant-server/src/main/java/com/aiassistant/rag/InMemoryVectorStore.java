package com.aiassistant.rag;

import java.util.Comparator;
import java.util.List;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Simple in-memory vector store using cosine similarity. Suitable for development, testing, and
 * small knowledge bases (<10K docs). For production at scale, replace with Milvus/pgvector/Chroma
 * implementation.
 */
public class InMemoryVectorStore implements VectorStore {

    private static final Logger log = LoggerFactory.getLogger(InMemoryVectorStore.class);
    private final ConcurrentHashMap<String, Document> store = new ConcurrentHashMap<>();

    @Override
    public void upsert(List<Document> documents) {
        for (Document doc : documents) {
            String key = doc.namespace() + "::" + doc.id();
            store.put(key, doc);
        }
        log.info("Upserted {} documents, total store size: {}", documents.size(), store.size());
    }

    @Override
    public List<SearchResult> search(float[] queryVector, int topK, String namespace) {
        return store.values().stream()
                .filter(doc -> namespace == null || namespace.equals(doc.namespace()))
                .map(
                        doc ->
                                new SearchResult(
                                        doc.id(),
                                        doc.content(),
                                        cosineSimilarity(queryVector, doc.vector()),
                                        doc.metadata()))
                .sorted(Comparator.comparingDouble(SearchResult::score).reversed())
                .limit(topK)
                .collect(Collectors.toList());
    }

    @Override
    public void delete(String namespace, List<String> docIds) {
        for (String id : docIds) {
            store.remove(namespace + "::" + id);
        }
    }

    @Override
    public long count(String namespace) {
        if (namespace == null) return store.size();
        return store.values().stream().filter(d -> namespace.equals(d.namespace())).count();
    }

    static double cosineSimilarity(float[] a, float[] b) {
        if (a.length != b.length) return 0.0;
        double dot = 0, normA = 0, normB = 0;
        for (int i = 0; i < a.length; i++) {
            dot += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
        }
        double denom = Math.sqrt(normA) * Math.sqrt(normB);
        return denom == 0 ? 0.0 : dot / denom;
    }
}
