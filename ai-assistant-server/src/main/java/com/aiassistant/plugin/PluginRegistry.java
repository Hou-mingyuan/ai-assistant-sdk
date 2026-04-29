package com.aiassistant.plugin;

import com.aiassistant.spi.AssistantCapability;
import com.aiassistant.tool.ToolDefinition;
import com.aiassistant.tool.ToolRegistry;
import java.io.File;
import java.net.URL;
import java.net.URLClassLoader;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.ServiceLoader;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Manages runtime loading/unloading of plugin JARs. Plugins can contribute {@link ToolDefinition}
 * and {@link AssistantCapability} implementations discovered via {@link ServiceLoader}.
 */
public class PluginRegistry {

    private static final Logger log = LoggerFactory.getLogger(PluginRegistry.class);
    private final ToolRegistry toolRegistry;
    private final List<AssistantCapability> globalCapabilities;
    private final Map<String, LoadedPlugin> plugins = new ConcurrentHashMap<>();

    public PluginRegistry(ToolRegistry toolRegistry, List<AssistantCapability> capabilities) {
        this.toolRegistry = toolRegistry;
        this.globalCapabilities =
                capabilities != null
                        ? new CopyOnWriteArrayList<>(capabilities)
                        : new CopyOnWriteArrayList<>();
    }

    /**
     * Load a plugin JAR at runtime. Discovers ToolDefinition and AssistantCapability via
     * ServiceLoader. Synchronized to prevent concurrent loading of the same pluginId.
     */
    public synchronized PluginDescriptor loadPlugin(String pluginId, File jarFile)
            throws Exception {
        if (plugins.containsKey(pluginId)) {
            throw new IllegalStateException("Plugin already loaded: " + pluginId);
        }
        if (!jarFile.exists() || !jarFile.getName().endsWith(".jar")) {
            throw new IllegalArgumentException("Invalid JAR file: " + jarFile);
        }

        URL jarUrl = jarFile.toURI().toURL();
        URLClassLoader classLoader =
                new URLClassLoader(new URL[] {jarUrl}, getClass().getClassLoader());

        List<ToolDefinition> tools = new ArrayList<>();
        ServiceLoader.load(ToolDefinition.class, classLoader)
                .forEach(
                        tool -> {
                            toolRegistry.register(tool);
                            tools.add(tool);
                            log.info("Plugin [{}] registered tool: {}", pluginId, tool.name());
                        });

        List<AssistantCapability> caps = new ArrayList<>();
        ServiceLoader.load(AssistantCapability.class, classLoader)
                .forEach(
                        cap -> {
                            globalCapabilities.add(cap);
                            caps.add(cap);
                            log.info("Plugin [{}] registered capability: {}", pluginId, cap.name());
                        });

        List<String> capNames = new ArrayList<>();
        tools.forEach(t -> capNames.add("tool:" + t.name()));
        caps.forEach(c -> capNames.add("capability:" + c.name()));

        PluginDescriptor descriptor =
                new PluginDescriptor(
                        pluginId,
                        jarFile.getName(),
                        "1.0.0",
                        "Loaded from " + jarFile.getAbsolutePath(),
                        capNames);

        plugins.put(pluginId, new LoadedPlugin(descriptor, classLoader, tools, caps));
        log.info(
                "Plugin loaded: {} with {} tools and {} capabilities",
                pluginId,
                tools.size(),
                caps.size());
        return descriptor;
    }

    /** Unload a plugin and remove its tools/capabilities. */
    public synchronized boolean unloadPlugin(String pluginId) {
        LoadedPlugin loaded = plugins.remove(pluginId);
        if (loaded == null) return false;

        for (ToolDefinition tool : loaded.tools) {
            toolRegistry.unregister(tool.name());
        }
        for (AssistantCapability cap : loaded.capabilities) {
            globalCapabilities.remove(cap);
        }
        try {
            loaded.classLoader.close();
        } catch (Exception e) {
            log.warn("Failed to close classloader for plugin {}: {}", pluginId, e.getMessage());
        }
        log.info("Plugin unloaded: {}", pluginId);
        return true;
    }

    public Map<String, PluginDescriptor> listPlugins() {
        Map<String, PluginDescriptor> result = new LinkedHashMap<>();
        plugins.forEach((k, v) -> result.put(k, v.descriptor));
        return result;
    }

    public boolean isLoaded(String pluginId) {
        return plugins.containsKey(pluginId);
    }

    private record LoadedPlugin(
            PluginDescriptor descriptor,
            URLClassLoader classLoader,
            List<ToolDefinition> tools,
            List<AssistantCapability> capabilities) {}
}
