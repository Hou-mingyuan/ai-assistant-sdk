package com.aiassistant.controller;

import com.aiassistant.tool.ToolRegistry;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.LinkedHashMap;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * UI-driven, read-only tool execution.
 *
 * <p>The chat UI renders structured {@code *_query_data} results (paged table). When the user flips
 * pages or changes the page size the UI re-runs the same query tool with a new {@code
 * pageIndex}/{@code pageSize} through this endpoint instead of asking the model again.
 *
 * <p>Only {@code *_query_data} tools are accepted; write tools ({@code _create_record}, {@code
 * _update_record}, {@code _delete_record}) and any host-defined tools stay model-only.
 */
@RestController
@RequestMapping("${ai-assistant.context-path:/ai-assistant}")
@io.swagger.v3.oas.annotations.tags.Tag(
        name = "Tools",
        description = "Read-only tool execution for the chat UI (result paging)")
public class ToolExecuteController {

    private static final Logger log = LoggerFactory.getLogger(ToolExecuteController.class);

    /** Tool-name suffix that marks a tool as safe for UI-driven execution. */
    static final String ALLOWED_SUFFIX = "_query_data";

    private final ToolRegistry toolRegistry;
    private final ObjectMapper objectMapper;

    public ToolExecuteController(ToolRegistry toolRegistry, ObjectMapper objectMapper) {
        this.toolRegistry = toolRegistry;
        this.objectMapper = objectMapper;
    }

    /** Request body: tool name plus the full argument object (same shape the model sends). */
    public record ToolExecuteRequest(String name, JsonNode arguments) {}

    @PostMapping("/tools/execute")
    public Map<String, Object> execute(@RequestBody ToolExecuteRequest request) {
        String name = request == null || request.name() == null ? "" : request.name().trim();
        if (name.isEmpty()) {
            return error("name is required", "TOOL_NAME_REQUIRED");
        }
        if (!name.endsWith(ALLOWED_SUFFIX)) {
            return error(
                    "Only *" + ALLOWED_SUFFIX + " tools can be executed from the UI",
                    "TOOL_NOT_ALLOWED");
        }
        JsonNode arguments =
                request.arguments() == null || request.arguments().isNull()
                        ? objectMapper.createObjectNode()
                        : request.arguments();
        if (!arguments.isObject()) {
            return error("arguments must be a JSON object", "TOOL_ARGUMENTS_INVALID");
        }

        try {
            String json = toolRegistry.execute(name, arguments);
            JsonNode result =
                    json == null || json.isBlank()
                            ? objectMapper.createObjectNode()
                            : objectMapper.readTree(json);
            // Connector tools report failures as {"error": "..."} inside a 200 response.
            if (result.isObject() && result.hasNonNull("error") && !result.has("records")) {
                return error(result.get("error").asText(), "TOOL_ERROR");
            }
            Map<String, Object> body = new LinkedHashMap<>();
            body.put("success", true);
            body.put("result", result);
            return body;
        } catch (IllegalArgumentException e) {
            // ToolRegistry.execute throws this for an unknown tool name.
            return error(e.getMessage(), "TOOL_NOT_FOUND");
        } catch (Exception e) {
            log.warn("tools.execute name={} failed: {}", name, e.toString());
            return error(
                    e.getMessage() == null ? e.getClass().getSimpleName() : e.getMessage(),
                    "TOOL_ERROR");
        }
    }

    private static Map<String, Object> error(String message, String errorCode) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("success", false);
        body.put("error", message);
        body.put("errorCode", errorCode);
        return body;
    }
}
