package com.aiassistant.plugin;

import java.util.List;

/**
 * Metadata describing a loaded plugin.
 */
public record PluginDescriptor(
        String id,
        String name,
        String version,
        String description,
        List<String> capabilities,
        long loadedAtMs
) {
    public PluginDescriptor(String id, String name, String version, String description, List<String> capabilities) {
        this(id, name, version, description, capabilities, System.currentTimeMillis());
    }
}
