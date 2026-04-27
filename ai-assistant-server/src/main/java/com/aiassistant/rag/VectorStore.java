package com.aiassistant.rag;

import java.util.List;

/**
 * Abstraction for vector similarity search stores.
 * Implementations can be in-memory (for dev/testing), Milvus, pgvector, Chroma, etc.
 */
public interface VectorStore {

    void upsert(List<Document> documents);

    List<SearchResult> search(float[] queryVector, int topK, String namespace);

    void delete(String namespace, List<String> docIds);

    long count(String namespace);

    record Document(
            String id,
            String namespace,
            String content,
            float[] vector,
            java.util.Map<String, String> metadata
    ) {}

    record SearchResult(
            String docId,
            String content,
            double score,
            java.util.Map<String, String> metadata
    ) {}
}
