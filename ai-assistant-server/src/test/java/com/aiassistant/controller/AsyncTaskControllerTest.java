package com.aiassistant.controller;

import com.aiassistant.service.LlmService;
import com.aiassistant.stats.UsageStats;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class AsyncTaskControllerTest {

    private AsyncTaskController controller;
    private LlmService llmService;
    private UsageStats usageStats;

    @BeforeEach
    void setUp() {
        llmService = mock(LlmService.class);
        usageStats = new UsageStats();
        controller = new AsyncTaskController(llmService, usageStats);
    }

    @Test
    void submitChat_returnsTaskId() {
        when(llmService.chat(anyString())).thenReturn("result");
        var resp = controller.submitChat(Map.of("text", "hello"));
        assertEquals(202, resp.getStatusCode().value());
        var body = resp.getBody();
        assertNotNull(body);
        assertNotNull(body.get("taskId"));
        assertEquals("pending", body.get("status"));
    }

    @Test
    void submitChat_rejectsEmptyText() {
        var resp = controller.submitChat(Map.of("text", ""));
        assertEquals(400, resp.getStatusCode().value());
        assertNotNull(resp.getBody().get("error"));
    }

    @Test
    void submitChat_rejectsNullBody() {
        var resp = controller.submitChat(null);
        assertEquals(400, resp.getStatusCode().value());
        verifyNoInteractions(llmService);
    }

    @Test
    void submitChat_rejectsNonStringWebhookUrl() {
        var resp = controller.submitChat(Map.of("text", "hello", "webhookUrl", 123));
        assertEquals(400, resp.getStatusCode().value());
        verifyNoInteractions(llmService);
    }

    @Test
    void submitChat_rejectsUnsafeWebhookUrlBeforeSchedulingTask() {
        var resp = controller.submitChat(Map.of("text", "hello", "webhookUrl", "http://127.0.0.1:8080/hook"));
        assertEquals(400, resp.getStatusCode().value());
        verifyNoInteractions(llmService);
    }

    @Test
    void getStatus_returnsNotFound_forUnknownTask() {
        var resp = controller.getStatus("0123456789abcdef");
        assertEquals(404, resp.getStatusCode().value());
    }

    @Test
    void getStatus_rejectsInvalidTaskId() {
        var resp = controller.getStatus("../bad");
        assertEquals(400, resp.getStatusCode().value());
    }

    @Test
    void submitAndPoll_completesSuccessfully() throws Exception {
        when(llmService.chat("hello")).thenReturn("world");
        var submit = controller.submitChat(Map.of("text", "hello"));
        String taskId = (String) submit.getBody().get("taskId");

        Thread.sleep(500);

        var status = controller.getStatus(taskId);
        assertEquals(200, status.getStatusCode().value());
        assertEquals("completed", status.getBody().get("status"));
        assertEquals("world", status.getBody().get("result"));
    }

    @Test
    void submitAndPoll_handlesError() throws Exception {
        when(llmService.chat("fail")).thenThrow(new RuntimeException("boom"));
        var submit = controller.submitChat(Map.of("text", "fail"));
        String taskId = (String) submit.getBody().get("taskId");

        Thread.sleep(500);

        var status = controller.getStatus(taskId);
        assertEquals(200, status.getStatusCode().value());
        assertEquals("failed", status.getBody().get("status"));
        assertNotNull(status.getBody().get("error"));
    }
}
