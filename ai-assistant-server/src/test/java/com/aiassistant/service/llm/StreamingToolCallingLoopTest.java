package com.aiassistant.service.llm;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.aiassistant.service.OpenAiResponseParser;
import com.aiassistant.tool.ToolRegistry;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.time.Duration;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.List;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;
import reactor.core.publisher.Flux;

class StreamingToolCallingLoopTest {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private static ResponsePostProcessor postProcessor() {
        return new ResponsePostProcessor(null, null, new OpenAiResponseParser(MAPPER));
    }

    private static ObjectNode emptyBody(String model) {
        ObjectNode body = MAPPER.createObjectNode();
        body.put("model", model);
        body.put("stream", true);
        body.putArray("messages");
        return body;
    }

    private static String responseWithToolCall(String callId, String fn, String args) {
        return ("{\"choices\":[{\"finish_reason\":\"tool_calls\",\"message\":{\"role\":\"assistant\","
                        + "\"content\":null,\"tool_calls\":[{\"id\":\"%s\",\"type\":\"function\","
                        + "\"function\":{\"name\":\"%s\",\"arguments\":\"%s\"}}]}}]}")
                .formatted(callId, fn, args.replace("\"", "\\\""));
    }

    private static String finalAssistantResponse(String content) {
        return "{\"choices\":[{\"finish_reason\":\"stop\",\"message\":{\"role\":\"assistant\",\"content\":\""
                + content
                + "\"}}]}";
    }

    private static String noToolsResponse() {
        return "{\"choices\":[{\"finish_reason\":\"stop\",\"message\":{\"role\":\"assistant\","
                + "\"content\":\"hi\"}}]}";
    }

    private static class StubChatClient implements ChatCompletionClient {
        final Deque<String> rawQueue;
        final List<String> streamChunks;
        int rawCalls = 0;
        int streamCalls = 0;

        StubChatClient(List<String> rawSeq, List<String> streamChunks) {
            this.rawQueue = new ArrayDeque<>(rawSeq);
            this.streamChunks = streamChunks;
        }

        @Override
        public String complete(ObjectNode body, String key) {
            throw new UnsupportedOperationException();
        }

        @Override
        public String completeRaw(ObjectNode body, String key) {
            rawCalls++;
            if (rawQueue.isEmpty()) throw new IllegalStateException("no more canned responses");
            return rawQueue.removeFirst();
        }

        @Override
        public Flux<String> completeStream(ObjectNode body, String key) {
            streamCalls++;
            return Flux.fromIterable(streamChunks);
        }
    }

    private static ToolRegistry singleToolRegistry(String name, String result) {
        ToolRegistry reg = new ToolRegistry(List.of());
        reg.register(
                new com.aiassistant.tool.ToolDefinition() {
                    @Override
                    public String name() {
                        return name;
                    }

                    @Override
                    public String description() {
                        return "test";
                    }

                    @Override
                    public com.fasterxml.jackson.databind.JsonNode parametersSchema() {
                        return MAPPER.createObjectNode().put("type", "object");
                    }

                    @Override
                    public String execute(com.fasterxml.jackson.databind.JsonNode args) {
                        return result;
                    }
                });
        return reg;
    }

    @Test
    void noToolCallsFallsThroughToStreamingCompletion() {
        StubChatClient client =
                new StubChatClient(List.of(noToolsResponse()), List.of("Hel", "lo!"));
        StreamingToolCallingLoop loop =
                new StreamingToolCallingLoop(
                        singleToolRegistry("noop", ""), client, postProcessor(), MAPPER, 5, 1000);
        List<String> result =
                loop.stream(emptyBody("gpt-x"), "key", null)
                        .collectList()
                        .block(Duration.ofSeconds(5));
        assertThat(result).containsExactly("Hel", "lo!");
        assertThat(client.rawCalls).isEqualTo(1);
        assertThat(client.streamCalls).isEqualTo(1);
    }

    @Test
    void singleToolRoundEmitsProgressAndFinalAnswer() {
        StubChatClient client =
                new StubChatClient(
                        List.of(
                                responseWithToolCall("c1", "echo", "{}"),
                                finalAssistantResponse("answer-after-tool")),
                        List.of());
        StreamingToolCallingLoop loop =
                new StreamingToolCallingLoop(
                        singleToolRegistry("echo", "tool-output"),
                        client,
                        postProcessor(),
                        MAPPER,
                        5,
                        1000);
        List<String> result =
                loop.stream(emptyBody("gpt-x"), "key", null)
                        .collectList()
                        .block(Duration.ofSeconds(5));
        assertThat(result).hasSize(3);
        assertThat(result.get(0)).contains("\uD83D\uDD27").contains("echo");
        assertThat(result.get(1)).contains("\u2705").contains("tool-output");
        assertThat(result.get(2)).isEqualTo("answer-after-tool");
        assertThat(client.rawCalls).isEqualTo(2);
        assertThat(client.streamCalls).isEqualTo(0);
    }

    @Test
    void emptyChoicesEmitsParsedFallbackContent() {
        StubChatClient client = new StubChatClient(List.of("{\"choices\":[]}"), List.of());
        StreamingToolCallingLoop loop =
                new StreamingToolCallingLoop(
                        singleToolRegistry("noop", ""), client, postProcessor(), MAPPER, 5, 1000);
        List<String> result =
                loop.stream(emptyBody("gpt-x"), "key", null)
                        .collectList()
                        .block(Duration.ofSeconds(5));
        assertThat(result).hasSize(1);
    }

    @Test
    void exceptionDuringProbeInvokesKeyFailureCallback() {
        ChatCompletionClient throwing =
                new ChatCompletionClient() {
                    @Override
                    public String complete(ObjectNode body, String key) {
                        return "";
                    }

                    @Override
                    public String completeRaw(ObjectNode body, String key) {
                        throw new RuntimeException("upstream-401");
                    }

                    @Override
                    public Flux<String> completeStream(ObjectNode body, String key) {
                        return Flux.empty();
                    }
                };
        AtomicReference<String> failedKey = new AtomicReference<>();
        StreamingToolCallingLoop loop =
                new StreamingToolCallingLoop(
                        singleToolRegistry("noop", ""), throwing, postProcessor(), MAPPER, 5, 1000);
        assertThatThrownBy(
                        () ->
                                loop.stream(emptyBody("gpt-x"), "bad-key", failedKey::set)
                                        .collectList()
                                        .block(Duration.ofSeconds(5)))
                .hasMessageContaining("upstream-401");
        assertThat(failedKey.get()).isEqualTo("bad-key");
    }

    @Test
    void maxRoundsCapsTheLoopAndTerminates() {
        /* Model keeps requesting more tool calls; with maxRounds=2 the loop must terminate. */
        StubChatClient client =
                new StubChatClient(
                        List.of(
                                responseWithToolCall("c1", "echo", "{}"),
                                responseWithToolCall("c2", "echo", "{}"),
                                responseWithToolCall("c3", "echo", "{}")),
                        List.of());
        StreamingToolCallingLoop loop =
                new StreamingToolCallingLoop(
                        singleToolRegistry("echo", "x"), client, postProcessor(), MAPPER, 2, 1000);
        List<String> result =
                loop.stream(emptyBody("gpt-x"), "key", null)
                        .collectList()
                        .block(Duration.ofSeconds(5));
        assertThat(result).isNotEmpty();
        long progressEmissions =
                result.stream()
                        .filter(s -> s.contains("\uD83D\uDD27") || s.contains("\u2705"))
                        .count();
        /* 2 rounds × (🔧 + ✅) = 4 progress markers minimum. */
        assertThat(progressEmissions).isGreaterThanOrEqualTo(4);
    }

    @Test
    void truncateHelperCapsLongStrings() {
        assertThat(StreamingToolCallingLoop.truncate(null, 5)).isEqualTo("");
        assertThat(StreamingToolCallingLoop.truncate("abc", 5)).isEqualTo("abc");
        assertThat(StreamingToolCallingLoop.truncate("abcdefg", 4)).isEqualTo("abcd…");
    }
}
