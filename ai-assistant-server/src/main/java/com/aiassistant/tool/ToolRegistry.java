package com.aiassistant.tool;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Central registry for tools available to the LLM.
 * Auto-populated from all {@link ToolDefinition} beans; also supports programmatic registration.
 */
public class ToolRegistry {

    private static final Logger log = LoggerFactory.getLogger(ToolRegistry.class);
    private final ObjectMapper mapper = new ObjectMapper();
    private final Map<String, ToolDefinition> tools = new LinkedHashMap<>();

    public ToolRegistry(List<ToolDefinition> definitions) {
        if (definitions != null) {
            for (ToolDefinition d : definitions) {
                register(d);
            }
        }
        log.info("ToolRegistry initialized with {} tools: {}", tools.size(), tools.keySet());
    }

    public void register(ToolDefinition tool) {
        tools.put(tool.name(), tool);
    }

    public ToolDefinition get(String name) {
        return tools.get(name);
    }

    public boolean isEmpty() {
        return tools.isEmpty();
    }

    public Map<String, ToolDefinition> all() {
        return Collections.unmodifiableMap(tools);
    }

    /**
     * Build the OpenAI-compatible "tools" array for the request body.
     */
    public ArrayNode toOpenAiToolsArray() {
        ArrayNode arr = mapper.createArrayNode();
        for (ToolDefinition t : tools.values()) {
            ObjectNode tool = arr.addObject();
            tool.put("type", "function");
            ObjectNode fn = tool.putObject("function");
            fn.put("name", t.name());
            fn.put("description", t.description());
            JsonNode params = t.parametersSchema();
            if (params != null && !params.isNull()) {
                fn.set("parameters", params);
            } else {
                fn.putObject("parameters").put("type", "object");
            }
        }
        return arr;
    }

    /**
     * Execute a tool by name with the given arguments JSON.
     */
    public String execute(String toolName, JsonNode arguments) throws Exception {
        ToolDefinition tool = tools.get(toolName);
        if (tool == null) {
            throw new IllegalArgumentException("Unknown tool: " + toolName);
        }
        return tool.execute(arguments);
    }
}
