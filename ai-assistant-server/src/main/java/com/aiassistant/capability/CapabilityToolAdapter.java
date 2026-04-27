package com.aiassistant.capability;

import com.aiassistant.spi.AssistantCapability;
import com.aiassistant.tool.ToolDefinition;
import com.aiassistant.tool.ToolRegistry;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Bridges {@link AssistantCapability} SPI with the {@link ToolRegistry},
 * making all registered capabilities available to the LLM via function calling.
 */
public class CapabilityToolAdapter {

    private static final Logger log = LoggerFactory.getLogger(CapabilityToolAdapter.class);
    private static final String TOOL_PREFIX = "cap_";
    private final ObjectMapper mapper = new ObjectMapper();

    public CapabilityToolAdapter(ToolRegistry toolRegistry, List<AssistantCapability> capabilities) {
        if (toolRegistry == null || capabilities == null || capabilities.isEmpty()) {
            return;
        }
        for (AssistantCapability cap : capabilities) {
            String toolName = TOOL_PREFIX + cap.name();
            ToolDefinition tool = new CapabilityToolDefinition(cap, toolName, mapper);
            toolRegistry.register(tool);
            log.info("Registered capability as tool: {} -> {}", cap.name(), toolName);
        }
    }

    private record CapabilityToolDefinition(
            AssistantCapability capability,
            String toolName,
            ObjectMapper mapper
    ) implements ToolDefinition {

        @Override
        public String name() {
            return toolName;
        }

        @Override
        public String description() {
            return capability.description();
        }

        @Override
        public JsonNode parametersSchema() {
            return mapper.valueToTree(capability.inputSchema());
        }

        @Override
        public String execute(JsonNode arguments) throws Exception {
            Map<String, Object> params = new HashMap<>();
            if (arguments != null && arguments.isObject()) {
                var it = arguments.fields();
                while (it.hasNext()) {
                    var entry = it.next();
                    params.put(entry.getKey(), nodeToValue(entry.getValue()));
                }
            }
            return capability.execute(params);
        }

        private static Object nodeToValue(JsonNode node) {
            if (node.isTextual()) return node.asText();
            if (node.isInt()) return node.asInt();
            if (node.isLong()) return node.asLong();
            if (node.isDouble()) return node.asDouble();
            if (node.isBoolean()) return node.asBoolean();
            if (node.isNull()) return null;
            return node.toString();
        }
    }
}
