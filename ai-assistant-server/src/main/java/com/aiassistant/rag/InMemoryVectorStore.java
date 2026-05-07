package com.aiassistant.rag;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.PriorityQueue;
import java.util.concurrent.ConcurrentHashMap;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * In-memory vector store using cosine similarity with MinHeap-based top-K selection. O(n log k)
 * instead of O(n log n) — significant when k << n. Suitable for development, testing, and small
 * knowledge bases (<10K docs).
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
        PriorityQueue<SearchResult> minHeap =
                new PriorityQueue<>(topK + 1, Comparator.comparingDouble(SearchResult::score));

        float queryNorm = norm(queryVector);
        if (queryNorm == 0f) return List.of();

        for (Document doc : store.values()) {
            if (namespace != null && !namespace.equals(doc.namespace())) continue;
            double score = cosineSimilarity(queryVector, doc.vector(), queryNorm);
            if (minHeap.size() < topK) {
                minHeap.offer(new SearchResult(doc.id(), doc.content(), score, doc.metadata()));
            } else if (!minHeap.isEmpty() && score > minHeap.peek().score()) {
                minHeap.poll();
                minHeap.offer(new SearchResult(doc.id(), doc.content(), score, doc.metadata()));
            }
        }

        List<SearchResult> results = new ArrayList<>(minHeap);
        results.sort(Comparator.comparingDouble(SearchResult::score).reversed());
        return results;
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

    static float norm(float[] v) {
        float sum = 0f;
        for (float x : v) sum += x * x;
        return (float) Math.sqrt(sum);
    }

    /**
     * Cosine similarity with pre-computed query norm, avoiding redundant norm(query) per document.
     * The inner loop is kept simple and sequential for JIT auto-vectorization (SIMD).
     */
    static double cosineSimilarity(float[] query, float[] doc, float queryNorm) {
        if (query.length != doc.length || queryNorm == 0f) return 0.0;
        float dot = 0f, docNormSq = 0f;
        for (int i = 0; i < query.length; i++) {
            dot += query[i] * doc[i];
            docNormSq += doc[i] * doc[i];
        }
        double docNorm = Math.sqrt(docNormSq);
        return docNorm == 0.0 ? 0.0 : dot / (queryNorm * docNorm);
    }

    /** Convenience overload for standalone use (without pre-computed norm). */
    static double cosineSimilarity(float[] a, float[] b) {
        return cosineSimilarity(a, b, norm(a));
    }
}
