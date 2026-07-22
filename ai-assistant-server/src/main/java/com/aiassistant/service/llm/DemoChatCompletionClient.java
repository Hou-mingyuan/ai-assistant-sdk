package com.aiassistant.service.llm;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import reactor.core.publisher.Flux;

/**
 * Deterministic local provider used only by the explicitly selected {@code demo} mode.
 *
 * <p>It never calls an external model and every response identifies itself as a demo response, so
 * transport and UI flows can be exercised without presenting fixed output as real AI capability.
 */
public final class DemoChatCompletionClient implements ChatCompletionClient {

    public static final String RESPONSE_MARKER =
            "[DEMO MODE - deterministic local response, not real AI]";

    private static final Duration STREAM_DELAY = Duration.ofMillis(20);

    @Override
    public String complete(ObjectNode requestBody, String apiKey) {
        return String.join("", responseChunks(requestBody));
    }

    @Override
    public Flux<String> completeStream(ObjectNode requestBody, String apiKey) {
        return Flux.fromIterable(responseChunks(requestBody)).delayElements(STREAM_DELAY);
    }

    private static List<String> responseChunks(ObjectNode requestBody) {
        String userText = extractLastUserText(requestBody);
        List<String> chunks = new ArrayList<>();
        chunks.add(RESPONSE_MARKER);
        chunks.add("\n\nThe SDK received your message through the complete chat pipeline: ");
        chunks.add(userText.isBlank() ? "(empty message)" : "\"" + userText + "\"");
        chunks.add(
                "\n\nSet AI_ASSISTANT_PROVIDER and AI_ASSISTANT_API_KEY to use a real "
                        + "OpenAI-compatible model.");
        return chunks;
    }

    private static String extractLastUserText(ObjectNode requestBody) {
        if (requestBody == null) {
            return "";
        }
        JsonNode messages = requestBody.path("messages");
        if (!messages.isArray()) {
            return "";
        }
        for (int i = messages.size() - 1; i >= 0; i--) {
            JsonNode message = messages.get(i);
            if (!"user".equals(message.path("role").asText())) {
                continue;
            }
            JsonNode content = message.path("content");
            if (content.isTextual()) {
                return content.asText();
            }
            if (content.isArray()) {
                for (JsonNode part : content) {
                    if ("text".equals(part.path("type").asText())
                            && part.path("text").isTextual()) {
                        return part.path("text").asText();
                    }
                }
            }
        }
        return "";
    }
}
