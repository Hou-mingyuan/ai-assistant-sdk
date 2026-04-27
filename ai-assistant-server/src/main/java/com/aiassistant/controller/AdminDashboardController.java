package com.aiassistant.controller;

import com.aiassistant.prompt.PromptTemplate;
import com.aiassistant.prompt.PromptTemplateRegistry;
import com.aiassistant.rag.RagService;
import com.aiassistant.routing.ModelRouter;
import com.aiassistant.stats.TokenUsageTracker;
import com.aiassistant.stats.UsageStats;
import com.aiassistant.tool.ToolRegistry;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Admin dashboard REST API for monitoring and managing the AI assistant.
 * Provides endpoints for usage stats, token tracking, prompt management,
 * knowledge base operations, and A/B test configuration.
 */
@RestController
@RequestMapping("${ai-assistant.context-path:/ai-assistant}/admin")
public class AdminDashboardController {

    private static final Logger log = LoggerFactory.getLogger(AdminDashboardController.class);

    private final UsageStats usageStats;
    private final TokenUsageTracker tokenTracker;
    private final ToolRegistry toolRegistry;
    private final PromptTemplateRegistry promptRegistry;
    private final RagService ragService;
    private final ModelRouter modelRouter;

    public AdminDashboardController(UsageStats usageStats,
                                     TokenUsageTracker tokenTracker,
                                     ToolRegistry toolRegistry,
                                     PromptTemplateRegistry promptRegistry,
                                     RagService ragService,
                                     ModelRouter modelRouter) {
        this.usageStats = usageStats;
        this.tokenTracker = tokenTracker;
        this.toolRegistry = toolRegistry;
        this.promptRegistry = promptRegistry;
        this.ragService = ragService;
        this.modelRouter = modelRouter;
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
    public Map<String, Object> setQuota(@RequestBody Map<String, Object> body) {
        String tenantId = (String) body.get("tenantId");
        long limit = ((Number) body.getOrDefault("dailyLimit", 0)).longValue();
        tokenTracker.setQuota(tenantId, limit);
        return Map.of("success", true, "tenantId", tenantId, "dailyLimit", limit);
    }

    @GetMapping("/prompts")
    public Map<String, Object> listPrompts() {
        Map<String, Object> result = new LinkedHashMap<>();
        promptRegistry.all().forEach((name, tpl) ->
                result.put(name, Map.of("name", name, "template", tpl.getTemplate())));
        return result;
    }

    @PostMapping("/prompts")
    public Map<String, Object> createPrompt(@RequestBody Map<String, String> body) {
        String name = body.get("name");
        String template = body.get("template");
        if (name == null || template == null) {
            return Map.of("success", false, "error", "name and template required");
        }
        promptRegistry.register(new PromptTemplate(name, template));
        return Map.of("success", true, "name", name);
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
            return ResponseEntity.badRequest().body(Map.of("error", "content is required"));
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
    public Map<String, Object> configureABTest(@RequestBody Map<String, Object> body) {
        String name = (String) body.get("name");
        String modelA = (String) body.get("modelA");
        String modelB = (String) body.get("modelB");
        int percentA = ((Number) body.getOrDefault("percentA", 50)).intValue();
        modelRouter.configureABTest(name, modelA, modelB, percentA);
        return Map.of("success", true, "test", name);
    }

    @GetMapping("/ab-test")
    public Map<String, ModelRouter.ABTestConfig> listABTests() {
        return modelRouter.getActiveABTests();
    }
}
