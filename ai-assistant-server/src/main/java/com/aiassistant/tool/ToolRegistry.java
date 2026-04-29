package com.aiassistant.tool;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Central registry for tools available to the LLM. Auto-populated from all {@link ToolDefinition}
 * beans; also supports programmatic registration.
 */
public class ToolRegistry {

    private static final Logger log = LoggerFactory.getLogger(ToolRegistry.class);
    private final ObjectMapper mapper = new ObjectMapper();
    private final Map<String, ToolDefinition> tools = new ConcurrentHashMap<>();
    private volatile ArrayNode cachedToolsArray;

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
        cachedToolsArray = null;
    }

    public boolean unregister(String toolName) {
        boolean removed = tools.remove(toolName) != null;
        if (removed) cachedToolsArray = null;
        return removed;
    }

    public int unregisterByPrefix(String prefix) {
        List<String> toRemove =
                tools.keySet().stream().filter(name -> name.startsWith(prefix)).toList();
        toRemove.forEach(tools::remove);
        if (!toRemove.isEmpty()) cachedToolsArray = null;
        return toRemove.size();
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
     * Build the OpenAI-compatible "tools" array for the request body. Result is cached and
     * invalidated on register/unregister.
     */
    public ArrayNode toOpenAiToolsArray() {
        ArrayNode cached = cachedToolsArray;
        if (cached != null) return cached;

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
        cachedToolsArray = arr;
        return arr;
    }

    /**
     * Execute a tool by name with the given arguments JSON. Logs structured audit info: tool name,
     * args size, result size, and latency.
     */
    public String execute(String toolName, JsonNode arguments) throws Exception {
        ToolDefinition tool = tools.get(toolName);
        if (tool == null) {
            throw new IllegalArgumentException("Unknown tool: " + toolName);
        }
        long start = System.currentTimeMillis();
        try {
            String result = tool.execute(arguments);
            long elapsed = System.currentTimeMillis() - start;
            log.info(
                    "tool.call name={} argsSize={} resultSize={} latencyMs={} status=ok",
                    toolName,
                    arguments != null ? arguments.toString().length() : 0,
                    result != null ? result.length() : 0,
                    elapsed);
            return result;
        } catch (Exception e) {
            long elapsed = System.currentTimeMillis() - start;
            log.warn(
                    "tool.call name={} argsSize={} latencyMs={} status=error error={}",
                    toolName,
                    arguments != null ? arguments.toString().length() : 0,
                    elapsed,
                    e.getMessage());
            throw e;
        }
    }
}
