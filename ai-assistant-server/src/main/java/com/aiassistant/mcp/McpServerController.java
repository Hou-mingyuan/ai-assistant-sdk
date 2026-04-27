package com.aiassistant.mcp;

import com.aiassistant.spi.AssistantCapability;
import com.aiassistant.util.JsonNodeUtils;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * MCP (Model Context Protocol) Server endpoint.
 * Exposes assistant capabilities as MCP tools, compatible with
 * platforms like 织信 (Informat) that support MCP Client connections.
 *
 * <p>Implements the JSON-RPC based MCP protocol with methods:
 * <ul>
 *   <li>tools/list — discover available tools</li>
 *   <li>tools/call — invoke a tool</li>
 *   <li>initialize — server handshake</li>
 * </ul>
 */
@RestController
@RequestMapping("${ai-assistant.context-path:/ai-assistant}/mcp")
public class McpServerController {

    private static final Logger log = LoggerFactory.getLogger(McpServerController.class);
    private static final String MCP_VERSION = "2025-03-26";
    private static final String SERVER_NAME = "ai-assistant-sdk";
    private static final String SERVER_VERSION = "1.0.0";

    private final List<AssistantCapability> capabilities;
    private final ObjectMapper mapper = new ObjectMapper();

    public McpServerController(List<AssistantCapability> capabilities) {
        this.capabilities = capabilities != null ? capabilities : List.of();
    }

    @PostMapping(produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<String> handleJsonRpc(@RequestBody String body) {
        try {
            JsonNode request = mapper.readTree(body);
            String method = request.path("method").asText("");
            JsonNode id = request.has("id") ? request.get("id") : null;

            ObjectNode response = switch (method) {
                case "initialize" -> handleInitialize(request, id);
                case "tools/list" -> handleToolsList(id);
                case "tools/call" -> handleToolsCall(request, id);
                default -> errorResponse(id, -32601, "Method not found: " + method);
            };

            return ResponseEntity.ok().contentType(MediaType.APPLICATION_JSON).body(response.toString());
        } catch (Exception e) {
            log.error("MCP request failed", e);
            ObjectNode err = errorResponse(null, -32700, "Parse error: " + e.getMessage());
            return ResponseEntity.ok().contentType(MediaType.APPLICATION_JSON).body(err.toString());
        }
    }

    private ObjectNode handleInitialize(JsonNode request, JsonNode id) {
        ObjectNode resp = mapper.createObjectNode();
        resp.put("jsonrpc", "2.0");
        if (id != null) resp.set("id", id);

        ObjectNode result = resp.putObject("result");
        result.put("protocolVersion", MCP_VERSION);
        ObjectNode serverInfo = result.putObject("serverInfo");
        serverInfo.put("name", SERVER_NAME);
        serverInfo.put("version", SERVER_VERSION);

        ObjectNode caps = result.putObject("capabilities");
        caps.putObject("tools");

        return resp;
    }

    private ObjectNode handleToolsList(JsonNode id) {
        ObjectNode resp = mapper.createObjectNode();
        resp.put("jsonrpc", "2.0");
        if (id != null) resp.set("id", id);

        ObjectNode result = resp.putObject("result");
        ArrayNode tools = result.putArray("tools");

        for (AssistantCapability cap : capabilities) {
            ObjectNode tool = tools.addObject();
            tool.put("name", cap.name());
            tool.put("description", cap.description());
            tool.set("inputSchema", mapper.valueToTree(cap.inputSchema()));
        }

        return resp;
    }

    private ObjectNode handleToolsCall(JsonNode request, JsonNode id) {
        JsonNode params = request.path("params");
        String toolName = params.path("name").asText("");
        JsonNode arguments = params.path("arguments");

        AssistantCapability cap = capabilities.stream()
                .filter(c -> c.name().equals(toolName))
                .findFirst()
                .orElse(null);

        if (cap == null) {
            return errorResponse(id, -32602, "Unknown tool: " + toolName);
        }

        try {
            Map<String, Object> paramsMap = new HashMap<>();
            if (arguments != null && arguments.isObject()) {
                var it = arguments.fields();
                while (it.hasNext()) {
                    var entry = it.next();
                    paramsMap.put(entry.getKey(), JsonNodeUtils.nodeToValue(entry.getValue()));
                }
            }

            String result = cap.execute(paramsMap);

            ObjectNode resp = mapper.createObjectNode();
            resp.put("jsonrpc", "2.0");
            if (id != null) resp.set("id", id);

            ObjectNode resultNode = resp.putObject("result");
            ArrayNode content = resultNode.putArray("content");
            ObjectNode textContent = content.addObject();
            textContent.put("type", "text");
            textContent.put("text", result);

            return resp;
        } catch (Exception e) {
            log.error("MCP tool call failed: {}", toolName, e);
            return errorResponse(id, -32000, "Tool execution failed. Check server logs for details.");
        }
    }

    private ObjectNode errorResponse(JsonNode id, int code, String message) {
        ObjectNode resp = mapper.createObjectNode();
        resp.put("jsonrpc", "2.0");
        if (id != null) resp.set("id", id);
        ObjectNode error = resp.putObject("error");
        error.put("code", code);
        error.put("message", message);
        return resp;
    }

}
