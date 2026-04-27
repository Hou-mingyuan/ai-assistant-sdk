package com.aiassistant.controller;

import com.aiassistant.service.LlmService;
import com.aiassistant.stats.UsageStats;
import com.aiassistant.util.UrlFetchSafety;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import com.aiassistant.config.TenantContext;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.*;

/**
 * Async task submission with optional webhook callback.
 * Supports long-running operations (file summarize, batch translate)
 * without holding the HTTP connection open.
 */
@RestController
@RequestMapping("${ai-assistant.context-path:/ai-assistant}/async")
public class AsyncTaskController {

    private static final Logger log = LoggerFactory.getLogger(AsyncTaskController.class);
    private static final int MAX_PENDING_TASKS = 100;

    private static final long TASK_TTL_MS = 30 * 60 * 1000L;
    private static final long PENDING_TIMEOUT_MS = 10 * 60 * 1000L;

    private final LlmService llmService;
    private final UsageStats usageStats;
    private final ObjectMapper mapper = new ObjectMapper();
    private final ConcurrentHashMap<String, TaskEntry> tasks = new ConcurrentHashMap<>();
    private final HttpClient webhookClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5)).build();
    private final ExecutorService executor = Executors.newFixedThreadPool(4, r -> {
        Thread t = new Thread(r, "async-task");
        t.setDaemon(true);
        return t;
    });

    public AsyncTaskController(LlmService llmService, UsageStats usageStats) {
        this.llmService = llmService;
        this.usageStats = usageStats;
    }

    @jakarta.annotation.PreDestroy
    void shutdown() {
        executor.shutdownNow();
    }

    @PostMapping("/chat")
    public ResponseEntity<Map<String, Object>> submitChat(@RequestBody Map<String, Object> body) {
        evictExpiredTasks();
        if (tasks.size() >= MAX_PENDING_TASKS) {
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                    .body(Map.of("error", "Too many pending tasks"));
        }
        Object rawText = body.getOrDefault("text", "");
        if (!(rawText instanceof String text) || text.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "text is required and must be a string"));
        }
        Object rawWebhookUrl = body.get("webhookUrl");
        String webhookUrl = rawWebhookUrl instanceof String s ? s : null;

        String taskId = UUID.randomUUID().toString().replace("-", "").substring(0, 16);
        TaskEntry entry = new TaskEntry(taskId);
        tasks.put(taskId, entry);

        var tenantInfo = TenantContext.get();
        executor.submit(() -> {
            if (tenantInfo != null) TenantContext.set(tenantInfo);
            try {
                String result = llmService.chat(text);
                entry.complete(result);
                usageStats.recordCall("async_chat");
                if (webhookUrl != null) {
                    sendWebhook(webhookUrl, taskId, result, null);
                }
            } catch (Exception e) {
                entry.fail(e.getMessage());
                usageStats.recordError();
                if (webhookUrl != null) {
                    sendWebhook(webhookUrl, taskId, null, e.getMessage());
                }
            } finally {
                TenantContext.clear();
            }
        });

        return ResponseEntity.accepted().body(Map.of("taskId", taskId, "status", "pending"));
    }

    @GetMapping("/{taskId}")
    public ResponseEntity<Map<String, Object>> getStatus(@PathVariable String taskId) {
        TaskEntry entry = tasks.get(taskId);
        if (entry == null) {
            return ResponseEntity.notFound().build();
        }
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("taskId", taskId);
        result.put("status", entry.status);
        if ("completed".equals(entry.status)) result.put("result", entry.result);
        if ("failed".equals(entry.status)) result.put("error", entry.error);
        return ResponseEntity.ok(result);
    }

    private void sendWebhook(String url, String taskId, String result, String error) {
        try {
            URI uri = URI.create(url);
            UrlFetchSafety.validateHttpUrlForServerSideFetch(uri);
            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("taskId", taskId);
            payload.put("status", error == null ? "completed" : "failed");
            if (result != null) payload.put("result", result);
            if (error != null) payload.put("error", error);

            HttpRequest req = HttpRequest.newBuilder()
                    .uri(uri)
                    .timeout(Duration.ofSeconds(10))
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(payload)))
                    .build();
            webhookClient.send(req, HttpResponse.BodyHandlers.discarding());
            log.info("Webhook delivered: taskId={} url={}", taskId, url);
        } catch (Exception e) {
            log.warn("Webhook delivery failed: taskId={} url={} error={}", taskId, url, e.getMessage());
        }
    }

    private void evictExpiredTasks() {
        long now = System.currentTimeMillis();
        tasks.entrySet().removeIf(e -> {
            TaskEntry t = e.getValue();
            if ("pending".equals(t.status)) {
                if (now - t.createdAt > PENDING_TIMEOUT_MS) {
                    t.fail("Task timed out after " + (PENDING_TIMEOUT_MS / 60_000) + " minutes");
                    return false;
                }
                return false;
            }
            return now - t.createdAt > TASK_TTL_MS;
        });
    }

    private static class TaskEntry {
        final String id;
        volatile String status = "pending";
        volatile String result;
        volatile String error;
        final long createdAt = System.currentTimeMillis();

        TaskEntry(String id) { this.id = id; }

        void complete(String result) {
            this.result = result;
            this.status = "completed";
        }

        void fail(String error) {
            this.error = error;
            this.status = "failed";
        }
    }
}
