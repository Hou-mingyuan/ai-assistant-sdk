package com.aiassistant.service.llm;

import com.fasterxml.jackson.databind.node.ObjectNode;
import reactor.core.publisher.Flux;

/**
 * Abstraction for LLM chat completion calls (OpenAI-compatible protocol).
 * Implement this interface to integrate a non-standard LLM provider;
 * register as a Spring Bean and it will replace the default {@link OpenAiCompatibleChatClient}
 * via {@code @ConditionalOnMissingBean}.
 */
public interface ChatCompletionClient {

    /**
     * Blocking chat completion. Returns the assistant message content.
     *
     * @param requestBody OpenAI-compatible JSON request body (model, messages, temperature, etc.)
     * @param apiKey      Bearer token for the LLM API
     * @return assistant response text
     * @throws IllegalStateException on HTTP errors or unexpected response shape
     */
    String complete(ObjectNode requestBody, String apiKey);

    /**
     * Blocking chat completion returning the raw JSON response (for tool calling parsing).
     * Default implementation delegates to {@link #complete} and wraps in a minimal JSON envelope.
     */
    default String completeRaw(ObjectNode requestBody, String apiKey) {
        String content = complete(requestBody, apiKey);
        return "{\"choices\":[{\"message\":{\"content\":" + escapeJsonString(content) + "},\"finish_reason\":\"stop\"}]}";
    }

    private static String escapeJsonString(String s) {
        if (s == null) return "null";
        StringBuilder sb = new StringBuilder(s.length() + 16);
        sb.append('"');
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            switch (c) {
                case '\\' -> sb.append("\\\\");
                case '"'  -> sb.append("\\\"");
                case '\n' -> sb.append("\\n");
                case '\r' -> sb.append("\\r");
                case '\t' -> sb.append("\\t");
                case '\b' -> sb.append("\\b");
                case '\f' -> sb.append("\\f");
                default -> {
                    if (c < 0x20) {
                        sb.append(String.format("\\u%04x", (int) c));
                    } else {
                        sb.append(c);
                    }
                }
            }
        }
        sb.append('"');
        return sb.toString();
    }

    /**
     * Streaming chat completion. Emits content deltas as they arrive.
     *
     * @param requestBody OpenAI-compatible JSON request body with {@code "stream": true}
     * @param apiKey      Bearer token for the LLM API
     * @return Flux of content delta strings
     */
    Flux<String> completeStream(ObjectNode requestBody, String apiKey);
}
