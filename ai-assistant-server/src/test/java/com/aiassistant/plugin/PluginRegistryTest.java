package com.aiassistant.plugin;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.aiassistant.tool.ToolRegistry;
import java.nio.file.Path;
import java.util.List;
import java.util.jar.Attributes;
import java.util.jar.JarOutputStream;
import java.util.jar.Manifest;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class PluginRegistryTest {

    @Test
    void reportsThePluginJarImplementationVersion(@TempDir Path tempDir) throws Exception {
        Manifest manifest = new Manifest();
        manifest.getMainAttributes().put(Attributes.Name.MANIFEST_VERSION, "1.0");
        manifest.getMainAttributes().put(Attributes.Name.IMPLEMENTATION_VERSION, "2.3.4");
        Path pluginJar = tempDir.resolve("sample-plugin.jar");
        try (JarOutputStream ignored =
                new JarOutputStream(java.nio.file.Files.newOutputStream(pluginJar), manifest)) {}

        PluginRegistry registry = new PluginRegistry(new ToolRegistry(List.of()), List.of());
        PluginDescriptor descriptor = registry.loadPlugin("sample", pluginJar.toFile());

        assertEquals("2.3.4", descriptor.version());
        assertTrue(registry.unloadPlugin("sample"));
    }
}
