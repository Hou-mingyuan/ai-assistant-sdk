package com.aiassistant.rag;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class RagServiceTest {

    @Test
    void chunkText_splitsCorrectly() {
        String text = "A".repeat(1200);
        var chunks = RagService.chunkText(text, 500, 50);
        assertTrue(chunks.size() >= 3);
        assertEquals(500, chunks.get(0).length());
    }

    @Test
    void chunkText_handlesEmptyInput() {
        assertTrue(RagService.chunkText("", 500, 50).isEmpty());
        assertTrue(RagService.chunkText(null, 500, 50).isEmpty());
    }

    @Test
    void chunkText_shortTextSingleChunk() {
        var chunks = RagService.chunkText("Hello world", 500, 50);
        assertEquals(1, chunks.size());
        assertEquals("Hello world", chunks.get(0));
    }

    @Test
    void ingestAndRetrieve_worksWithMockEmbedding() {
        EmbeddingProvider mockEmbed = new EmbeddingProvider() {
            @Override public float[] embed(String text) {
                return text.contains("Java") ? new float[]{1, 0, 0} : new float[]{0, 1, 0};
            }
            @Override public List<float[]> embedBatch(List<String> texts) {
                return texts.stream().map(this::embed).toList();
            }
            @Override public int dimensions() { return 3; }
        };

        var store = new InMemoryVectorStore();
        var rag = new RagService(mockEmbed, store);

        rag.ingest("test", "doc1", "Java is a programming language", null);
        assertEquals(1, rag.documentCount("test"));

        var results = rag.retrieveContext("Tell me about Java", "test");
        assertFalse(results.isEmpty());
    }

    @Test
    void buildContextPrompt_returnsEmptyForNoResults() {
        EmbeddingProvider noopEmbed = new EmbeddingProvider() {
            @Override public float[] embed(String text) { return new float[]{0, 0}; }
            @Override public List<float[]> embedBatch(List<String> texts) { return texts.stream().map(this::embed).toList(); }
            @Override public int dimensions() { return 2; }
        };
        var rag = new RagService(noopEmbed, new InMemoryVectorStore());
        assertEquals("", rag.buildContextPrompt("anything", "empty_ns"));
    }
}
