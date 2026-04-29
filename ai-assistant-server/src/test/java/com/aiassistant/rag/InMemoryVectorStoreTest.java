package com.aiassistant.rag;

import static org.junit.jupiter.api.Assertions.*;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class InMemoryVectorStoreTest {

    @Test
    void upsertAndSearch_returnsRelevantDocuments() {
        var store = new InMemoryVectorStore();
        store.upsert(
                List.of(
                        new VectorStore.Document(
                                "d1", "ns1", "Java is great", new float[] {1, 0, 0}, Map.of()),
                        new VectorStore.Document(
                                "d2",
                                "ns1",
                                "Python is versatile",
                                new float[] {0, 1, 0},
                                Map.of()),
                        new VectorStore.Document(
                                "d3", "ns1", "Rust is fast", new float[] {0, 0, 1}, Map.of())));
        assertEquals(3, store.count("ns1"));

        var results = store.search(new float[] {1, 0, 0}, 2, "ns1");
        assertEquals(2, results.size());
        assertEquals("d1", results.get(0).docId());
        assertEquals(1.0, results.get(0).score(), 0.001);
    }

    @Test
    void search_filtersbyNamespace() {
        var store = new InMemoryVectorStore();
        store.upsert(
                List.of(
                        new VectorStore.Document("d1", "ns1", "Doc1", new float[] {1, 0}, Map.of()),
                        new VectorStore.Document(
                                "d2", "ns2", "Doc2", new float[] {1, 0}, Map.of())));
        var results = store.search(new float[] {1, 0}, 10, "ns1");
        assertEquals(1, results.size());
        assertEquals("d1", results.get(0).docId());
    }

    @Test
    void delete_removesDocuments() {
        var store = new InMemoryVectorStore();
        store.upsert(List.of(new VectorStore.Document("d1", "ns", "A", new float[] {1}, Map.of())));
        assertEquals(1, store.count("ns"));
        store.delete("ns", List.of("d1"));
        assertEquals(0, store.count("ns"));
    }

    @Test
    void cosineSimilarity_isCorrect() {
        assertEquals(
                1.0,
                InMemoryVectorStore.cosineSimilarity(new float[] {1, 0}, new float[] {1, 0}),
                0.001);
        assertEquals(
                0.0,
                InMemoryVectorStore.cosineSimilarity(new float[] {1, 0}, new float[] {0, 1}),
                0.001);
        assertEquals(
                0.0, InMemoryVectorStore.cosineSimilarity(new float[] {0}, new float[] {0}), 0.001);
    }
}
