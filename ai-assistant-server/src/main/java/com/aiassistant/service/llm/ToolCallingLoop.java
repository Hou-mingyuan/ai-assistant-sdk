package com.aiassistant.service.llm;

import com.aiassistant.tool.ToolRegistry;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Blocking-side tool-calling loop, extracted from the historical 39 KB {@code LlmService} so the
 * algorithm can be unit-tested in isolation and replaced without touching the main service.
 *
 * <p>Given an initial assistant response containing {@code "finish_reason": "tool_calls"}, this
 * class executes each tool, appends the result back into the conversation, and re-invokes the
 * non-streaming chat completion until either:
 *
 * <ul>
 *   <li>the assistant returns a non-tool finish_reason (success — return its content);
 *   <li>{@link #getMaxRounds()} is hit (return the last assistant content);
 *   <li>the response is malformed (return a friendly error string).
 * </ul>
 *
 * <p>State-free; thread-safe; can be reused across requests. The single public {@link #execute}
 * mutates the supplied {@code body} (appends messages), so callers should not share the same body
 * across threads.
 */
public final class ToolCallingLoop {

    private static final Logger log = LoggerFactory.getLogger(ToolCallingLoop.class);

    private final ToolRegistry toolRegistry;
    private final ChatCompletionClient chatClient;
    private final ResponsePostProcessor responsePostProcessor;
    private final ObjectMapper objectMapper;
    private final int maxRounds;

    public ToolCallingLoop(
            ToolRegistry toolRegistry,
            ChatCompletionClient chatClient,
            ResponsePostProcessor responsePostProcessor,
            ObjectMapper objectMapper,
            int maxRounds) {
        this.toolRegistry = toolRegistry;
        this.chatClient = chatClient;
        this.responsePostProcessor = responsePostProcessor;
        this.objectMapper = objectMapper;
        this.maxRounds = Math.max(1, Math.min(maxRounds, 16));
    }

    public int getMaxRounds() {
        return maxRounds;
    }

    /**
     * Run the tool-calling loop. If {@code toolRegistry} is null/empty the loop is a no-op and the
     * already-parsed content is returned.
     *
     * @param body the OpenAI-compatible request body (the {@code messages} array will be appended
     *     to in-place across rounds)
     * @param rawResponse the raw JSON response from the first non-streaming call
     * @param apiKey bearer token to forward to subsequent calls
     * @return final assistant content
     */
    public String execute(ObjectNode body, String rawResponse, String apiKey) {
        if (toolRegistry == null || toolRegistry.isEmpty()) {
            return responsePostProcessor.parseContentFromRaw(rawResponse);
        }
        String modelId = body.path("model").asText("");
        for (int round = 0; round < maxRounds; round++) {
            JsonNode root;
            try {
                root = objectMapper.readTree(rawResponse);
            } catch (Exception e) {
                log.warn(
                        "Failed to parse LLM response in tool loop (round {}): {}",
                        round,
                        e.getMessage());
                return "AI service returned an unparseable response.";
            }
            JsonNode choices = root.path("choices");
            if (!choices.isArray() || choices.isEmpty()) {
                return responsePostProcessor.parseContentFromRaw(rawResponse);
            }

            JsonNode firstChoice = choices.get(0);
            JsonNode msg = firstChoice.path("message");
            String finishReason = firstChoice.path("finish_reason").asText("");
            JsonNode toolCalls = msg.path("tool_calls");

            if (!"tool_calls".equals(finishReason) || !toolCalls.isArray() || toolCalls.isEmpty()) {
                return msg.path("content").asText("");
            }

            JsonNode messagesNode = body.get("messages");
            if (messagesNode == null || !messagesNode.isArray()) {
                throw new RuntimeException("Malformed request body: 'messages' is not an array");
            }
            ArrayNode messages = (ArrayNode) messagesNode;
            ObjectNode assistantMsg = messages.addObject();
            assistantMsg.put("role", "assistant");
            if (msg.has("content") && !msg.get("content").isNull()) {
                assistantMsg.put("content", msg.get("content").asText(""));
            } else {
                assistantMsg.putNull("content");
            }
            assistantMsg.set("tool_calls", toolCalls);

            for (JsonNode tc : toolCalls) {
                String callId = tc.path("id").asText();
                String fnName = tc.path("function").path("name").asText();
                String argsStr = tc.path("function").path("arguments").asText("{}");
                String toolResult;
                try {
                    JsonNode args = objectMapper.readTree(argsStr);
                    toolResult = toolRegistry.execute(fnName, args);
                } catch (Exception e) {
                    toolResult = "Error: " + e.getMessage();
                    log.warn("Tool execution failed: {} - {}", fnName, e.getMessage());
                }
                ObjectNode toolMsg = messages.addObject();
                toolMsg.put("role", "tool");
                toolMsg.put("tool_call_id", callId);
                toolMsg.put("content", toolResult);
            }

            rawResponse = chatClient.completeRaw(body, apiKey);
            responsePostProcessor.extractAndRecord(rawResponse, modelId);
        }
        return responsePostProcessor.parseContentFromRaw(rawResponse);
    }
}
