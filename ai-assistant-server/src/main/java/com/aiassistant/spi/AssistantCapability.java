package com.aiassistant.spi;

import java.util.List;
import java.util.Map;

/**
 * Declares a capability that the assistant can expose (e.g., via MCP Server or API discovery).
 * Register as a Spring Bean to make the capability available.
 */
public interface AssistantCapability {

    String name();

    String description();

    /** JSON Schema describing the input parameters. */
    Map<String, Object> inputSchema();

    /**
     * Execute the capability with given parameters.
     *
     * @return result as a string (can be JSON)
     */
    String execute(Map<String, Object> params) throws Exception;

    default List<String> tags() {
        return List.of();
    }
}
