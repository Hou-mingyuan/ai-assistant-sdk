package com.aiassistant.controller;

import com.aiassistant.prompt.PromptTemplate;
import com.aiassistant.prompt.PromptTemplateRegistry;
import com.aiassistant.rag.RagService;
import com.aiassistant.routing.ModelRouter;
import com.aiassistant.stats.TokenUsageTracker;
import com.aiassistant.stats.UsageStats;
import com.aiassistant.tool.ToolRegistry;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * Admin dashboard REST API for monitoring and managing the AI assistant.
 * Provides endpoints for usage stats, token tracking, prompt management,
 * knowledge base operations, and A/B test configuration.
 */
@RestController
@RequestMapping("${ai-assistant.context-path:/ai-assistant}/admin")
public class AdminDashboardController {

    private static final Pattern SAFE_ID = Pattern.compile("[A-Za-z0-9_.:-]{1,80}");

    private final UsageStats usageStats;
    private final TokenUsageTracker tokenTracker;
    private final ToolRegistry toolRegistry;
    private final PromptTemplateRegistry promptRegistry;
    private final RagService ragService;
    private final ModelRouter modelRouter;
    private final com.aiassistant.plugin.PluginRegistry pluginRegistry;

    public AdminDashboardController(UsageStats usageStats,
                                     TokenUsageTracker tokenTracker,
                                     ToolRegistry toolRegistry,
                                     PromptTemplateRegistry promptRegistry,
                                     RagService ragService,
                                     ModelRouter modelRouter) {
        this(usageStats, tokenTracker, toolRegistry, promptRegistry, ragService, modelRouter, null);
    }

    public AdminDashboardController(UsageStats usageStats,
                                     TokenUsageTracker tokenTracker,
                                     ToolRegistry toolRegistry,
                                     PromptTemplateRegistry promptRegistry,
                                     RagService ragService,
                                     ModelRouter modelRouter,
                                     com.aiassistant.plugin.PluginRegistry pluginRegistry) {
        this.usageStats = usageStats;
        this.tokenTracker = tokenTracker;
        this.toolRegistry = toolRegistry;
        this.promptRegistry = promptRegistry;
        this.ragService = ragService;
        this.modelRouter = modelRouter;
        this.pluginRegistry = pluginRegistry;
    }

    @GetMapping("/overview")
    public Map<String, Object> overview() {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("usage", usageStats.getSnapshot());
        result.put("tokenUsage", tokenTracker.getGlobalSnapshot());
        result.put("registeredTools", toolRegistry.all().size());
        result.put("promptTemplates", promptRegistry.all().size());
        result.put("activeABTests", modelRouter.getActiveABTests().size());
        return result;
    }

    @GetMapping("/tokens")
    public Map<String, Object> tokenUsage(@RequestParam(required = false) String tenantId) {
        if (tenantId != null) {
            return tokenTracker.getSnapshot(tenantId);
        }
        return tokenTracker.getGlobalSnapshot();
    }

    @PostMapping("/tokens/quota")
    public ResponseEntity<Map<String, Object>> setQuota(@RequestBody Map<String, Object> body) {
        String tenantId = (String) body.get("tenantId");
        if (tenantId == null || tenantId.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "error", "tenantId is required"));
        }
        Object rawLimit = body.getOrDefault("dailyLimit", 0);
        if (!(rawLimit instanceof Number)) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "error", "dailyLimit must be a number"));
        }
        long limit = ((Number) rawLimit).longValue();
        if (limit < 0) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "error", "dailyLimit must be >= 0"));
        }
        tokenTracker.setQuota(tenantId, limit);
        return ResponseEntity.ok(Map.of("success", true, "tenantId", tenantId, "dailyLimit", limit));
    }

    @GetMapping("/prompts")
    public Map<String, Object> listPrompts() {
        Map<String, Object> result = new LinkedHashMap<>();
        promptRegistry.all().forEach((name, tpl) ->
                result.put(name, Map.of("name", name, "template", tpl.getTemplate())));
        return result;
    }

    @PostMapping("/prompts")
    public ResponseEntity<Map<String, Object>> createPrompt(@RequestBody Map<String, String> body) {
        String name = body.get("name");
        String template = body.get("template");
        if (name == null || template == null) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "error", "name and template required"));
        }
        promptRegistry.register(new PromptTemplate(name, template));
        return ResponseEntity.ok(Map.of("success", true, "name", name));
    }

    @GetMapping("/tools")
    public Map<String, Object> listTools() {
        Map<String, Object> result = new LinkedHashMap<>();
        toolRegistry.all().forEach((name, tool) ->
                result.put(name, Map.of("name", name, "description", tool.description())));
        return result;
    }

    @PostMapping("/rag/ingest")
    public ResponseEntity<Map<String, Object>> ingestDocument(@RequestBody Map<String, String> body) {
        String namespace = body.getOrDefault("namespace", "default");
        String content = body.get("content");
        String docId = body.get("docId");
        if (content == null || content.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "error", "content is required"));
        }
        int chunks = ragService.ingest(namespace, docId != null ? docId : java.util.UUID.randomUUID().toString(),
                content, Map.of());
        return ResponseEntity.ok(Map.of("success", true, "namespace", namespace, "chunks", chunks));
    }

    @GetMapping("/rag/stats")
    public Map<String, Object> ragStats(@RequestParam(defaultValue = "default") String namespace) {
        return Map.of("namespace", namespace, "documentCount", ragService.documentCount(namespace));
    }

    @PostMapping("/ab-test")
    public ResponseEntity<Map<String, Object>> configureABTest(@RequestBody Map<String, Object> body) {
        String name = body.get("name") instanceof String s ? s : null;
        String modelA = body.get("modelA") instanceof String s ? s : null;
        String modelB = body.get("modelB") instanceof String s ? s : null;
        if (name == null || modelA == null || modelB == null) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "error", "name, modelA, modelB are required"));
        }
        Object rawPercent = body.getOrDefault("percentA", 50);
        int percentA = rawPercent instanceof Number n ? n.intValue() : 50;
        if (percentA < 0 || percentA > 100) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "error", "percentA must be 0-100"));
        }
        modelRouter.configureABTest(name, modelA, modelB, percentA);
        return ResponseEntity.ok(Map.of("success", true, "test", name));
    }

    @GetMapping("/ab-test")
    public Map<String, ModelRouter.ABTestConfig> listABTests() {
        return modelRouter.getActiveABTests();
    }

    @PostMapping("/fallback-chain")
    public ResponseEntity<Map<String, Object>> setFallbackChain(@RequestBody Map<String, Object> body) {
        if (body == null || !(body.get("chain") instanceof List<?> rawChain) || rawChain.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "error", "chain list is required"));
        }
        List<String> chain = new ArrayList<>();
        for (Object item : rawChain) {
            if (!(item instanceof String modelId) || modelId.isBlank()) {
                return ResponseEntity.badRequest()
                        .body(Map.of("success", false, "error", "chain items must be non-blank strings"));
            }
            String normalized = modelId.trim();
            if (!isSafeId(normalized)) {
                return ResponseEntity.badRequest()
                        .body(Map.of("success", false, "error", "invalid model id in chain"));
            }
            chain.add(normalized);
        }
        modelRouter.setFallbackChain(chain);
        return ResponseEntity.ok(Map.of("success", true, "chain", chain));
    }

    @GetMapping("/fallback-chain")
    public Map<String, Object> getFallbackChain() {
        return Map.of("chain", modelRouter.getFallbackChain());
    }

    @GetMapping("/plugins")
    public Map<String, Object> listPlugins() {
        if (pluginRegistry == null) return Map.of("plugins", Map.of(), "enabled", false);
        return Map.of("plugins", pluginRegistry.listPlugins(), "enabled", true);
    }

    @PostMapping("/plugins/{pluginId}/unload")
    public ResponseEntity<Map<String, Object>> unloadPlugin(@PathVariable String pluginId) {
        if (!isSafeId(pluginId)) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "error", "invalid pluginId"));
        }
        if (pluginRegistry == null) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "error", "Plugin system not available"));
        }
        boolean removed = pluginRegistry.unloadPlugin(pluginId);
        return ResponseEntity.ok(Map.of("success", removed, "pluginId", pluginId));
    }

    @GetMapping("/system")
    public Map<String, Object> systemInfo() {
        Map<String, Object> info = new LinkedHashMap<>();
        info.put("javaVersion", System.getProperty("java.version"));
        info.put("osName", System.getProperty("os.name"));
        info.put("availableProcessors", Runtime.getRuntime().availableProcessors());
        info.put("maxMemoryMb", Runtime.getRuntime().maxMemory() / (1024 * 1024));
        info.put("freeMemoryMb", Runtime.getRuntime().freeMemory() / (1024 * 1024));
        info.put("totalMemoryMb", Runtime.getRuntime().totalMemory() / (1024 * 1024));
        info.put("registeredTools", toolRegistry.all().size());
        info.put("promptTemplates", promptRegistry.all().size());
        info.put("fallbackChain", modelRouter.getFallbackChain());
        if (pluginRegistry != null) {
            info.put("loadedPlugins", pluginRegistry.listPlugins().size());
        }
        return info;
    }

    private boolean isSafeId(String value) {
        return value != null && SAFE_ID.matcher(value).matches();
    }
}
