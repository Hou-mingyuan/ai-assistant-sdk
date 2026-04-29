package com.aiassistant.spi;

import java.util.List;
import java.util.Map;
import reactor.core.publisher.Flux;

/**
 * SPI for pluggable LLM model providers. Implement this interface to add support for Claude,
 * Gemini, local models, etc. Default implementation uses OpenAI-compatible API.
 */
public interface ModelProvider {

    /** Unique identifier, e.g. "openai", "claude", "gemini", "ollama" */
    String id();

    /** Human-readable display name */
    String displayName();

    /** List of supported model IDs */
    List<String> supportedModels();

    /** Synchronous chat completion */
    String complete(CompletionRequest request);

    /** Streaming chat completion */
    Flux<String> completeStream(CompletionRequest request);

    /** Check if this provider is currently healthy/reachable */
    default boolean isHealthy() {
        return true;
    }

    record CompletionRequest(
            String model,
            String systemPrompt,
            List<Message> messages,
            int maxTokens,
            double temperature,
            String apiKey,
            Map<String, Object> extraParams) {
        public record Message(String role, String content) {}
    }
}
