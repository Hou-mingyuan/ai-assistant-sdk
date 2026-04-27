package com.aiassistant.rag;

import java.util.List;

/**
 * Abstraction for text embedding providers.
 * Implementations call an embedding API (OpenAI, local model, etc.) to
 * convert text chunks into dense float vectors for similarity search.
 */
public interface EmbeddingProvider {

    float[] embed(String text);

    List<float[]> embedBatch(List<String> texts);

    int dimensions();
}
