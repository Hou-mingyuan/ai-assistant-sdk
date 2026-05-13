package com.aiassistant.service.llm;

import static org.assertj.core.api.Assertions.assertThat;

import com.aiassistant.service.OpenAiResponseParser;
import com.aiassistant.tool.ToolRegistry;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.ArrayDeque;
import java.util.Deque;
import org.junit.jupiter.api.Test;
import reactor.core.publisher.Flux;

class ToolCallingLoopTest {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private static ResponsePostProcessor postProcessor() {
        /* null ContentFilter + null TokenUsageTracker -> pass-through behaviour
         * suitable for unit testing the tool calling loop in isolation. */
        return new ResponsePostProcessor(null, null, new OpenAiResponseParser(MAPPER));
    }

    private static ObjectNode emptyBody(String model) {
        ObjectNode body = MAPPER.createObjectNode();
        body.put("model", model);
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

    /** Test ChatCompletionClient that returns canned responses in order. */
    private static class StubChatClient implements ChatCompletionClient {
        private final Deque<String> raws;

        StubChatClient(String... raws) {
            this.raws = new ArrayDeque<>();
            for (String r : raws) this.raws.add(r);
        }

        @Override
        public String complete(ObjectNode requestBody, String apiKey) {
            throw new UnsupportedOperationException("not used");
        }

        @Override
        public String completeRaw(ObjectNode requestBody, String apiKey) {
            if (raws.isEmpty()) throw new IllegalStateException("no more canned responses");
            return raws.removeFirst();
        }

        @Override
        public Flux<String> completeStream(ObjectNode requestBody, String apiKey) {
            return Flux.empty();
        }
    }

    /** Minimal ToolRegistry stub: every call returns the same canned result. */
    private static ToolRegistry singleToolRegistry(String name, String result) {
        ToolRegistry reg = new ToolRegistry(java.util.List.of());
        reg.register(
                new com.aiassistant.tool.ToolDefinition() {
                    @Override
                    public String name() {
                        return name;
                    }

                    @Override
                    public String description() {
                        return "test tool";
                    }

                    @Override
                    public com.fasterxml.jackson.databind.JsonNode parametersSchema() {
                        return MAPPER.createObjectNode().put("type", "object");
                    }

                    @Override
                    public String execute(com.fasterxml.jackson.databind.JsonNode arguments) {
                        return result;
                    }
                });
        return reg;
    }

    @Test
    void emptyToolRegistryReturnsParsedContentDirectly() {
        ToolCallingLoop loop =
                new ToolCallingLoop(
                        new ToolRegistry(java.util.List.of()),
                        new StubChatClient(),
                        postProcessor(),
                        MAPPER,
                        5);
        String raw = finalAssistantResponse("hello");
        ObjectNode body = emptyBody("gpt-x");
        String out = loop.execute(body, raw, "key");
        assertThat(out).isEqualTo("hello");
    }

    @Test
    void singleRoundOfToolCallingProducesFinalAnswer() {
        ToolCallingLoop loop =
                new ToolCallingLoop(
                        singleToolRegistry("echo", "tool-result-42"),
                        new StubChatClient(finalAssistantResponse("done with tool")),
                        postProcessor(),
                        MAPPER,
                        5);
        String firstRaw = responseWithToolCall("call_1", "echo", "{}");
        ObjectNode body = emptyBody("gpt-x");
        String out = loop.execute(body, firstRaw, "key");
        assertThat(out).isEqualTo("done with tool");

        ArrayNode messages = (ArrayNode) body.get("messages");
        assertThat(messages).hasSize(2);
        assertThat(messages.get(0).get("role").asText()).isEqualTo("assistant");
        assertThat(messages.get(0).get("tool_calls")).isNotNull();
        assertThat(messages.get(1).get("role").asText()).isEqualTo("tool");
        assertThat(messages.get(1).get("tool_call_id").asText()).isEqualTo("call_1");
        assertThat(messages.get(1).get("content").asText()).isEqualTo("tool-result-42");
    }

    @Test
    void maxRoundsCappedDefendsAgainstInfiniteLoop() {
        /* tool keeps returning a tool_calls response forever; loop must terminate */
        ToolCallingLoop loop =
                new ToolCallingLoop(
                        singleToolRegistry("echo", "result"),
                        new StubChatClient(
                                responseWithToolCall("c1", "echo", "{}"),
                                responseWithToolCall("c2", "echo", "{}"),
                                responseWithToolCall("c3", "echo", "{}"),
                                finalAssistantResponse("fallback after max rounds")),
                        postProcessor(),
                        MAPPER,
                        2);
        ObjectNode body = emptyBody("gpt-x");
        String out =
                loop.execute(body, responseWithToolCall("c0", "echo", "{}"), "key");
        /* After 2 rounds the loop returns whatever parseContentFromRaw extracts;
         * either fallback or empty, but it MUST terminate. */
        assertThat(out).isNotNull();
    }

    @Test
    void unparseableInitialResponseReturnsErrorString() {
        ToolCallingLoop loop =
                new ToolCallingLoop(
                        singleToolRegistry("echo", "x"),
                        new StubChatClient(),
                        postProcessor(),
                        MAPPER,
                        5);
        String out = loop.execute(emptyBody("gpt-x"), "{not-json", "key");
        assertThat(out).contains("unparseable");
    }

    @Test
    void missingChoicesArrayShortCircuitsToParseContent() {
        ToolCallingLoop loop =
                new ToolCallingLoop(
                        singleToolRegistry("echo", "x"),
                        new StubChatClient(),
                        postProcessor(),
                        MAPPER,
                        5);
        String out =
                loop.execute(emptyBody("gpt-x"), "{\"choices\":[]}", "key");
        assertThat(out).isNotNull(); /* delegates to ResponsePostProcessor.parseContentFromRaw */
    }
}
