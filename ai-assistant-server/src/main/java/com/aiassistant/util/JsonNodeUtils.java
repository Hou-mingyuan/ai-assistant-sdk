package com.aiassistant.util;

import com.fasterxml.jackson.databind.JsonNode;

/** Utilities for converting Jackson {@link JsonNode} to plain Java objects. */
public final class JsonNodeUtils {

    private JsonNodeUtils() {}

    /**
     * Convert a single JsonNode to a Java primitive/String. Arrays and objects are returned as
     * their JSON string representation.
     */
    public static Object nodeToValue(JsonNode node) {
        if (node == null || node.isNull()) return null;
        if (node.isTextual()) return node.asText();
        if (node.isInt()) return node.asInt();
        if (node.isLong()) return node.asLong();
        if (node.isDouble()) return node.asDouble();
        if (node.isBoolean()) return node.asBoolean();
        return node.toString();
    }
}
