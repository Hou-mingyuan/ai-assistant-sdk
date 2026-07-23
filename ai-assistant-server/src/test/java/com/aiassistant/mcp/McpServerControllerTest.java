package com.aiassistant.mcp;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.aiassistant.spi.AssistantCapability;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;

class McpServerControllerTest {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private static AssistantCapability cap(String name, String resultPrefix) {
        return new AssistantCapability() {
            @Override
            public String name() {
                return name;
            }

            @Override
            public String description() {
                return name + " description";
            }

            @Override
            public Map<String, Object> inputSchema() {
                return Map.of("type", "object");
            }

            @Override
            public String execute(Map<String, Object> params) {
                return resultPrefix + ":" + params.get("q");
            }
        };
    }

    private JsonNode call(McpServerController controller, String body) throws Exception {
        ResponseEntity<String> resp = controller.handleJsonRpc(body);
        return MAPPER.readTree(resp.getBody());
    }

    @Test
    void initialize_returnsServerInfoAndProtocol() throws Exception {
        McpServerController controller = new McpServerController(List.of());

        JsonNode r = call(controller, "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"initialize\"}");

        assertEquals(1, r.path("id").asInt());
        assertEquals("2.0", r.path("jsonrpc").asText());
        assertEquals("ai-assistant-sdk", r.path("result").path("serverInfo").path("name").asText());
        assertEquals("1.0.1", r.path("result").path("serverInfo").path("version").asText());
        assertTrue(r.path("result").path("capabilities").has("tools"));
    }

    @Test
    void toolsList_listsCapabilities() throws Exception {
        McpServerController controller = new McpServerController(List.of(cap("translate", "ok")));

        JsonNode r = call(controller, "{\"id\":2,\"method\":\"tools/list\"}");

        JsonNode tools = r.path("result").path("tools");
        assertEquals(1, tools.size());
        assertEquals("translate", tools.get(0).path("name").asText());
        assertEquals("object", tools.get(0).path("inputSchema").path("type").asText());
    }

    @Test
    void toolsCall_invokesCapabilityAndReturnsText() throws Exception {
        McpServerController controller = new McpServerController(List.of(cap("echo", "R")));

        JsonNode r =
                call(
                        controller,
                        "{\"id\":3,\"method\":\"tools/call\",\"params\":{\"name\":\"echo\","
                                + "\"arguments\":{\"q\":\"hi\"}}}");

        JsonNode content = r.path("result").path("content");
        assertEquals("text", content.get(0).path("type").asText());
        assertEquals("R:hi", content.get(0).path("text").asText());
    }

    @Test
    void toolsCall_unknownTool_returnsInvalidParams() throws Exception {
        McpServerController controller = new McpServerController(List.of(cap("echo", "R")));

        JsonNode r =
                call(
                        controller,
                        "{\"id\":4,\"method\":\"tools/call\",\"params\":{\"name\":\"nope\"}}");

        assertEquals(-32602, r.path("error").path("code").asInt());
    }

    @Test
    void toolsCall_executionFailure_returnsServerError() throws Exception {
        AssistantCapability boom =
                new AssistantCapability() {
                    @Override
                    public String name() {
                        return "boom";
                    }

                    @Override
                    public String description() {
                        return "d";
                    }

                    @Override
                    public Map<String, Object> inputSchema() {
                        return Map.of();
                    }

                    @Override
                    public String execute(Map<String, Object> params) throws Exception {
                        throw new IllegalStateException("kaboom");
                    }
                };
        McpServerController controller = new McpServerController(List.of(boom));

        JsonNode r =
                call(
                        controller,
                        "{\"id\":5,\"method\":\"tools/call\",\"params\":{\"name\":\"boom\","
                                + "\"arguments\":{}}}");

        assertEquals(-32000, r.path("error").path("code").asInt());
    }

    @Test
    void unknownMethod_returnsMethodNotFound() throws Exception {
        McpServerController controller = new McpServerController(List.of());

        JsonNode r = call(controller, "{\"id\":6,\"method\":\"bogus\"}");

        assertEquals(-32601, r.path("error").path("code").asInt());
    }

    @Test
    void invalidJson_returnsParseError() throws Exception {
        McpServerController controller = new McpServerController(List.of());

        JsonNode r = call(controller, "{ broken json");

        assertEquals(-32700, r.path("error").path("code").asInt());
    }

    @Test
    void nullCapabilities_handledGracefully() throws Exception {
        McpServerController controller = new McpServerController(null);

        JsonNode r = call(controller, "{\"id\":7,\"method\":\"tools/list\"}");

        assertEquals(0, r.path("result").path("tools").size());
    }
}
