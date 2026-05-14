package com.aiassistant.service.llm;

import com.aiassistant.tool.ToolRegistry;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.function.Consumer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import reactor.core.publisher.Flux;
import reactor.core.scheduler.Schedulers;

/**
 * Streaming-side tool-calling loop, extracted from {@code LlmService.callLlmStreamWithTools} and
 * {@code LlmService.executeToolsWithProgress} (K20) so the algorithm can be unit-tested in
 * isolation, swapped out, or reused from other flows without touching the main 38 KB LlmService.
 *
 * <p>Two-phase strategy:
 *
 * <ol>
 *   <li><b>Probe</b> — perform a non-streaming completion to discover whether the model wants to
 *       call tools. If it does not, fall straight through to a normal streaming completion.
 *   <li><b>Tools with progress</b> — emit visible progress markers as each tool is invoked, then
 *       loop until {@code finish_reason != "tool_calls"} or {@link #getMaxRounds()} is hit.
 * </ol>
 *
 * <p>Why two classes (this + {@link ToolCallingLoop}): the blocking and streaming algorithms
 * diverge around progress emission, timeouts, and Reactor sink wiring, and a shared abstraction
 * would force either side to take on incidental complexity.
 *
 * <p>State-free; thread-safe; can be reused across requests. The {@link #stream} method internally
 * does {@code body.deepCopy()} for tool probing/looping so the caller's request body is never
 * mutated.
 */
public final class StreamingToolCallingLoop {

    private static final Logger log = LoggerFactory.getLogger(StreamingToolCallingLoop.class);

    private final ToolRegistry toolRegistry;
    private final ChatCompletionClient chatClient;
    private final ResponsePostProcessor responsePostProcessor;
    private final ObjectMapper objectMapper;
    private final int maxRounds;
    private final long perCallTimeoutMs;

    public StreamingToolCallingLoop(
            ToolRegistry toolRegistry,
            ChatCompletionClient chatClient,
            ResponsePostProcessor responsePostProcessor,
            ObjectMapper objectMapper,
            int maxRounds,
            long perCallTimeoutMs) {
        this.toolRegistry = toolRegistry;
        this.chatClient = chatClient;
        this.responsePostProcessor = responsePostProcessor;
        this.objectMapper = objectMapper;
        this.maxRounds = Math.max(1, Math.min(maxRounds, 16));
        this.perCallTimeoutMs = Math.max(1000L, perCallTimeoutMs);
    }

    public int getMaxRounds() {
        return maxRounds;
    }

    public long getLoopTimeoutMs() {
        return perCallTimeoutMs * maxRounds;
    }

    /**
     * Stream the assistant response, handling any tool-calling round-trips along the way.
     *
     * @param body OpenAI-compatible request body (must already have {@code stream:true} set if you
     *     want the no-tool path to actually stream; this method deep-copies before probing)
     * @param apiKey bearer token to forward
     * @param onKeyFailure invoked once when the upstream call fails so the caller can mark the key
     *     unhealthy (may be null)
     * @return a Flux that emits assistant content chunks, optionally interleaved with progress
     *     markers like {@code "\n\n> 🔧 **toolName** ..."} when tools are invoked
     */
    public Flux<String> stream(ObjectNode body, String apiKey, Consumer<String> onKeyFailure) {
        return Flux.defer(
                () -> {
                    ObjectNode probeBody = body.deepCopy();
                    probeBody.put("stream", false);
                    try {
                        String rawResponse = chatClient.completeRaw(probeBody, apiKey);
                        JsonNode root = objectMapper.readTree(rawResponse);
                        JsonNode choices = root.path("choices");
                        if (!choices.isArray() || choices.isEmpty()) {
                            return Flux.just(
                                    responsePostProcessor.parseContentFromRaw(rawResponse));
                        }
                        JsonNode firstChoice = choices.get(0);
                        String finishReason = firstChoice.path("finish_reason").asText("");
                        JsonNode toolCalls = firstChoice.path("message").path("tool_calls");

                        if (!"tool_calls".equals(finishReason)
                                || !toolCalls.isArray()
                                || toolCalls.isEmpty()) {
                            return chatClient.completeStream(body, apiKey);
                        }

                        return executeToolsWithProgress(
                                        probeBody, firstChoice.path("message"), toolCalls, apiKey)
                                .subscribeOn(Schedulers.boundedElastic());
                    } catch (Exception e) {
                        if (onKeyFailure != null) {
                            try {
                                onKeyFailure.accept(apiKey);
                            } catch (Exception inner) {
                                log.debug("onKeyFailure callback threw: {}", inner.getMessage());
                            }
                        }
                        return Flux.error(e);
                    }
                });
    }

    /**
     * Tool calling with user-visible progress. Each round emits {@code 🔧 toolName} before the call
     * and {@code ✅ result-prefix} after. Final assistant content is the last emission.
     */
    private Flux<String> executeToolsWithProgress(
            ObjectNode body, JsonNode assistantMessage, JsonNode toolCalls, String apiKey) {
        long deadline = System.currentTimeMillis() + getLoopTimeoutMs();
        return Flux.create(
                sink -> {
                    try {
                        ObjectNode bodyClone = body.deepCopy();
                        bodyClone.put("stream", false);
                        JsonNode msgsNode = bodyClone.get("messages");
                        if (msgsNode == null || !msgsNode.isArray()) {
                            sink.error(
                                    new RuntimeException(
                                            "Malformed request body: 'messages' is not an array"));
                            return;
                        }
                        ArrayNode messages = (ArrayNode) msgsNode;
                        JsonNode curAssistantMsg = assistantMessage;
                        JsonNode curToolCalls = toolCalls;

                        for (int round = 0; round < maxRounds; round++) {
                            if (System.currentTimeMillis() > deadline) {
                                sink.next(
                                        "\n\n> ⚠️ Tool calling loop timed out after "
                                                + (getLoopTimeoutMs() / 1000)
                                                + "s\n");
                                break;
                            }
                            ObjectNode aMsg = messages.addObject();
                            aMsg.put("role", "assistant");
                            if (curAssistantMsg.has("content")
                                    && !curAssistantMsg.get("content").isNull()) {
                                aMsg.put("content", curAssistantMsg.get("content").asText(""));
                            } else {
                                aMsg.putNull("content");
                            }
                            aMsg.set("tool_calls", curToolCalls);

                            for (JsonNode tc : curToolCalls) {
                                String callId = tc.path("id").asText();
                                String fnName = tc.path("function").path("name").asText();
                                String argsStr = tc.path("function").path("arguments").asText("{}");

                                sink.next(
                                        "\n\n> \uD83D\uDD27 **"
                                                + fnName
                                                + "** `"
                                                + truncate(argsStr, 80)
                                                + "`\n");

                                String toolResult;
                                try {
                                    JsonNode args = objectMapper.readTree(argsStr);
                                    toolResult = toolRegistry.execute(fnName, args);
                                } catch (Exception e) {
                                    toolResult = "Error: " + e.getMessage();
                                    log.warn(
                                            "Tool execution failed: {} - {}",
                                            fnName,
                                            e.getMessage());
                                }

                                sink.next("> ✅ " + truncate(toolResult, 120) + "\n\n");

                                ObjectNode toolMsg = messages.addObject();
                                toolMsg.put("role", "tool");
                                toolMsg.put("tool_call_id", callId);
                                toolMsg.put("content", toolResult);
                            }

                            String rawResponse = chatClient.completeRaw(bodyClone, apiKey);
                            JsonNode root = objectMapper.readTree(rawResponse);
                            JsonNode choices = root.path("choices");
                            if (!choices.isArray() || choices.isEmpty()) {
                                sink.next(responsePostProcessor.parseContentFromRaw(rawResponse));
                                break;
                            }
                            JsonNode nextChoice = choices.get(0);
                            String nextFinish = nextChoice.path("finish_reason").asText("");
                            JsonNode nextToolCalls = nextChoice.path("message").path("tool_calls");

                            if (!"tool_calls".equals(nextFinish)
                                    || !nextToolCalls.isArray()
                                    || nextToolCalls.isEmpty()) {
                                sink.next(nextChoice.path("message").path("content").asText(""));
                                break;
                            }
                            curAssistantMsg = nextChoice.path("message");
                            curToolCalls = nextToolCalls;
                        }
                        sink.complete();
                    } catch (Exception e) {
                        sink.error(e);
                    }
                });
    }

    static String truncate(String s, int maxLen) {
        if (s == null) return "";
        return s.length() <= maxLen ? s : s.substring(0, maxLen) + "…";
    }
}
