package com.aiassistant.controller;

import com.aiassistant.prompt.PromptTemplate;
import com.aiassistant.prompt.PromptTemplateRegistry;
import com.aiassistant.rag.RagService;
import com.aiassistant.routing.ModelRouter;
import com.aiassistant.stats.TokenUsageTracker;
import com.aiassistant.stats.UsageStats;
import com.aiassistant.tool.ToolDefinition;
import com.aiassistant.tool.ToolRegistry;
import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class AdminDashboardControllerTest {

    private UsageStats usageStats;
    private TokenUsageTracker tokenTracker;
    private ToolRegistry toolRegistry;
    private PromptTemplateRegistry promptRegistry;
    private RagService ragService;
    private ModelRouter modelRouter;
    private AdminDashboardController controller;

    @BeforeEach
    void setUp() {
        usageStats = new UsageStats();
        tokenTracker = new TokenUsageTracker();
        promptRegistry = new PromptTemplateRegistry();

        ToolDefinition dummyTool = new ToolDefinition() {
            @Override public String name() { return "test_tool"; }
            @Override public String description() { return "A test tool"; }
            @Override public JsonNode parametersSchema() { return null; }
            @Override public String execute(JsonNode arguments) { return "ok"; }
        };
        toolRegistry = new ToolRegistry(List.of(dummyTool));

        modelRouter = new ModelRouter("gpt-4");

        ragService = new NoOpRagService();

        controller = new AdminDashboardController(
                usageStats, tokenTracker, toolRegistry,
                promptRegistry, ragService, modelRouter);
    }

    @Test
    void overview_returnsAllSections() {
        usageStats.recordCall("chat");
        tokenTracker.recordUsage("t1", "gpt-4", 100, 50);

        Map<String, Object> overview = controller.overview();

        assertNotNull(overview.get("usage"));
        assertNotNull(overview.get("tokenUsage"));
        assertEquals(1, overview.get("registeredTools"));
        assertTrue((int) overview.get("promptTemplates") > 0);
        assertEquals(0, overview.get("activeABTests"));
    }

    @Test
    void tokenUsage_globalSnapshot() {
        tokenTracker.recordUsage("t1", "gpt-4", 200, 100);
        tokenTracker.recordUsage("t2", "gpt-3.5", 50, 25);

        Map<String, Object> global = controller.tokenUsage(null);
        assertNotNull(global.get("_globalTotalTokens"));
        assertEquals(375L, global.get("_globalTotalTokens"));
    }

    @Test
    void tokenUsage_tenantSnapshot() {
        tokenTracker.recordUsage("tenant-A", "gpt-4", 300, 200);

        Map<String, Object> snap = controller.tokenUsage("tenant-A");
        assertEquals("tenant-A", snap.get("tenantId"));
        assertEquals(500L, snap.get("totalTokens"));
    }

    @Test
    void tokenUsage_unknownTenant_returnsZero() {
        Map<String, Object> snap = controller.tokenUsage("nonexistent");
        assertEquals(0, snap.get("totalTokens"));
    }

    @Test
    void setQuota_success() {
        ResponseEntity<Map<String, Object>> resp =
                controller.setQuota(Map.of("tenantId", "t1", "dailyLimit", 10000));

        assertEquals(200, resp.getStatusCode().value());
        assertTrue((boolean) resp.getBody().get("success"));
        assertEquals("t1", resp.getBody().get("tenantId"));
    }

    @Test
    void setQuota_missingTenantId_returnsBadRequest() {
        ResponseEntity<Map<String, Object>> resp =
                controller.setQuota(Map.of("dailyLimit", 5000));

        assertEquals(400, resp.getStatusCode().value());
        assertFalse((boolean) resp.getBody().get("success"));
    }

    @Test
    void setQuota_blankTenantId_returnsBadRequest() {
        ResponseEntity<Map<String, Object>> resp =
                controller.setQuota(Map.of("tenantId", "  ", "dailyLimit", 5000));

        assertEquals(400, resp.getStatusCode().value());
    }

    @Test
    void listPrompts_containsDefaults() {
        Map<String, Object> prompts = controller.listPrompts();
        assertFalse(prompts.isEmpty());
        assertTrue(prompts.containsKey("general"));
    }

    @Test
    @SuppressWarnings("unchecked")
    void createPrompt_addsNewTemplate() {
        ResponseEntity<Map<String, Object>> resp = controller.createPrompt(
                Map.of("name", "custom", "template", "Hello {{user}}"));

        assertEquals(200, resp.getStatusCode().value());
        assertTrue((boolean) resp.getBody().get("success"));
        assertEquals("custom", resp.getBody().get("name"));

        Map<String, Object> prompts = controller.listPrompts();
        assertTrue(prompts.containsKey("custom"));
        Map<String, Object> entry = (Map<String, Object>) prompts.get("custom");
        assertEquals("Hello {{user}}", entry.get("template"));
    }

    @Test
    void createPrompt_missingFields_returnsError() {
        ResponseEntity<Map<String, Object>> resp = controller.createPrompt(Map.of("name", "incomplete"));
        assertEquals(400, resp.getStatusCode().value());
        assertFalse((boolean) resp.getBody().get("success"));
    }

    @Test
    void listTools_containsRegisteredTool() {
        Map<String, Object> tools = controller.listTools();
        assertTrue(tools.containsKey("test_tool"));
    }

    @Test
    void ingestDocument_success() {
        ResponseEntity<Map<String, Object>> resp = controller.ingestDocument(
                Map.of("content", "Some knowledge text for RAG ingestion",
                        "namespace", "test-ns",
                        "docId", "doc-1"));

        assertEquals(200, resp.getStatusCode().value());
        assertTrue((boolean) resp.getBody().get("success"));
        assertEquals("test-ns", resp.getBody().get("namespace"));
    }

    @Test
    void ingestDocument_emptyContent_returnsBadRequest() {
        ResponseEntity<Map<String, Object>> resp = controller.ingestDocument(
                Map.of("content", "  "));

        assertEquals(400, resp.getStatusCode().value());
        assertNotNull(resp.getBody().get("error"));
    }

    @Test
    void ingestDocument_missingContent_returnsBadRequest() {
        ResponseEntity<Map<String, Object>> resp = controller.ingestDocument(
                Map.of("namespace", "ns"));

        assertEquals(400, resp.getStatusCode().value());
    }

    @Test
    void ragStats_returnsCount() {
        Map<String, Object> stats = controller.ragStats("default");
        assertEquals("default", stats.get("namespace"));
        assertEquals(0L, stats.get("documentCount"));
    }

    @Test
    void configureABTest_success() {
        ResponseEntity<Map<String, Object>> resp = controller.configureABTest(
                Map.of("name", "test1", "modelA", "gpt-4", "modelB", "gpt-3.5", "percentA", 70));

        assertEquals(200, resp.getStatusCode().value());
        assertTrue((boolean) resp.getBody().get("success"));
    }

    @Test
    void configureABTest_missingName_returnsBadRequest() {
        ResponseEntity<Map<String, Object>> resp = controller.configureABTest(
                Map.of("modelA", "gpt-4", "modelB", "gpt-3.5"));

        assertEquals(400, resp.getStatusCode().value());
    }

    @Test
    void configureABTest_missingModel_returnsBadRequest() {
        ResponseEntity<Map<String, Object>> resp = controller.configureABTest(
                Map.of("name", "test1", "modelA", "gpt-4"));

        assertEquals(400, resp.getStatusCode().value());
    }

    @Test
    void listABTests_afterConfigure() {
        controller.configureABTest(
                Map.of("name", "experiment", "modelA", "a", "modelB", "b", "percentA", 50));

        Map<String, ModelRouter.ABTestConfig> tests = controller.listABTests();
        assertEquals(1, tests.size());
        assertTrue(tests.containsKey("experiment"));
    }

    /**
     * No-op RagService for testing without embedding dependencies.
     */
    private static class NoOpRagService extends RagService {
        NoOpRagService() {
            super(new NoOpEmbeddingProvider(), new NoOpVectorStore());
        }
    }

    private static class NoOpEmbeddingProvider implements com.aiassistant.rag.EmbeddingProvider {
        @Override public float[] embed(String text) { return new float[0]; }
        @Override public List<float[]> embedBatch(List<String> texts) {
            return texts.stream().map(t -> new float[0]).toList();
        }
        @Override public int dimensions() { return 0; }
    }

    private static class NoOpVectorStore implements com.aiassistant.rag.VectorStore {
        @Override public void upsert(List<Document> docs) {}
        @Override public List<SearchResult> search(float[] queryVector, int topK, String namespace) {
            return List.of();
        }
        @Override public void delete(String namespace, List<String> docIds) {}
        @Override public long count(String namespace) { return 0; }
    }
}
