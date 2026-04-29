package com.aiassistant.tool;

import com.fasterxml.jackson.databind.JsonNode;

/**
 * A tool that the LLM can invoke via function calling. Register as a Spring Bean; the framework
 * auto-discovers all implementations.
 */
public interface ToolDefinition {

    /** Unique tool name (must match OpenAI function name rules: ^[a-zA-Z0-9_-]+$). */
    String name();

    /** Human-readable description for the LLM (helps it decide when to call). */
    String description();

    /**
     * JSON Schema of the parameters object (OpenAI function parameters format). Return null or
     * empty object if the tool takes no arguments.
     */
    JsonNode parametersSchema();

    /**
     * Execute the tool with the given arguments (parsed from LLM's function call). Return a string
     * result that will be sent back to the LLM as the tool response.
     */
    String execute(JsonNode arguments) throws Exception;
}
