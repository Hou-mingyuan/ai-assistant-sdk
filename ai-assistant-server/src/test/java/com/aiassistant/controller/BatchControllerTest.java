package com.aiassistant.controller;

import com.aiassistant.service.LlmService;
import com.aiassistant.stats.UsageStats;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class BatchControllerTest {

    @Test
    void batchProcessRecordsBatchUsage() {
        LlmService llmService = mock(LlmService.class);
        UsageStats usageStats = new UsageStats();
        BatchController controller = new BatchController(llmService, usageStats);

        when(llmService.chat(eq("hello"), isNull(), isNull(), isNull())).thenReturn("world");

        var response = controller.batchProcess(Map.of(
                "requests", List.of(Map.of("action", "chat", "text", "hello"))));

        assertEquals(200, response.getStatusCode().value());
        assertNotNull(response.getBody());
        assertEquals(1, response.getBody().get("count"));

        @SuppressWarnings("unchecked")
        Map<String, Long> callsByAction =
                (Map<String, Long>) usageStats.getSnapshot().get("callsByAction");
        assertEquals(1L, callsByAction.get("batch"));
    }

    @Test
    void batchProcessRejectsNonArrayRequests() {
        LlmService llmService = mock(LlmService.class);
        BatchController controller = new BatchController(llmService, new UsageStats());

        var response = controller.batchProcess(Map.of("requests", "bad"));

        assertEquals(400, response.getStatusCode().value());
        verifyNoInteractions(llmService);
    }

    @Test
    void batchProcessRejectsNonObjectItems() {
        LlmService llmService = mock(LlmService.class);
        BatchController controller = new BatchController(llmService, new UsageStats());

        var response = controller.batchProcess(Map.of("requests", List.of("bad")));

        assertEquals(400, response.getStatusCode().value());
        verifyNoInteractions(llmService);
    }

    @Test
    void batchProcessRejectsUnsupportedActionPerItem() {
        LlmService llmService = mock(LlmService.class);
        BatchController controller = new BatchController(llmService, new UsageStats());

        var response = controller.batchProcess(Map.of(
                "requests", List.of(Map.of("action", "delete", "text", "hello"))));

        assertEquals(200, response.getStatusCode().value());
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> results = (List<Map<String, Object>>) response.getBody().get("results");
        assertEquals("unsupported action: delete", results.get(0).get("error"));
        verifyNoInteractions(llmService);
    }
}
