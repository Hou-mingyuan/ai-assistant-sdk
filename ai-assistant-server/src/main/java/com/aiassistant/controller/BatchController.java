package com.aiassistant.controller;

import com.aiassistant.service.LlmService;
import com.aiassistant.stats.UsageStats;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("${ai-assistant.context-path:/ai-assistant}/batch")
@Tag(name = "Batch API", description = "Submit multiple AI requests in one call")
public class BatchController {

    private static final Logger log = LoggerFactory.getLogger(BatchController.class);
    private static final int MAX_BATCH_SIZE = 20;
    private static final int MAX_ITEM_TEXT_CHARS = 300_000;

    private final LlmService llmService;
    private final UsageStats usageStats;

    /**
     * P0 hardening: batch items make blocking LLM calls, so they must never run on the JVM-wide
     * ForkJoinPool.commonPool — a burst of batch requests would starve parallel streams across
     * the whole process. Daemon threads so the JVM can still shut down.
     */
    private final ExecutorService batchExecutor =
            Executors.newFixedThreadPool(
                    Math.max(2, Math.min(8, Runtime.getRuntime().availableProcessors())),
                    r -> {
                        Thread t = new Thread(r, "ai-assistant-batch");
                        t.setDaemon(true);
                        return t;
                    });

    /** Hard deadline for the whole batch; one hung upstream call fails fast instead of hanging. */
    private static final long BATCH_TIMEOUT_SECONDS = 300;

    public BatchController(LlmService llmService, UsageStats usageStats) {
        this.llmService = llmService;
        this.usageStats = usageStats;
    }

    @jakarta.annotation.PreDestroy
    void shutdown() {
        batchExecutor.shutdownNow();
    }

    @PostMapping
    @Operation(summary = "Submit a batch of chat/translate/summarize requests")
    public ResponseEntity<Map<String, Object>> batchProcess(@RequestBody Map<String, Object> body) {
        if (body == null || !(body.get("requests") instanceof List<?> rawRequests)) {
            return ResponseEntity.badRequest().body(Map.of("error", "requests array is required"));
        }
        if (rawRequests.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "requests array is required"));
        }
        List<Map<String, Object>> requests = new ArrayList<>();
        for (Object rawRequest : rawRequests) {
            if (!(rawRequest instanceof Map<?, ?> requestMap)) {
                return ResponseEntity.badRequest()
                        .body(Map.of("error", "each request must be an object"));
            }
            Map<String, Object> normalized = new java.util.LinkedHashMap<>();
            for (Map.Entry<?, ?> entry : requestMap.entrySet()) {
                if (entry.getKey() instanceof String key) {
                    normalized.put(key, entry.getValue());
                }
            }
            requests.add(normalized);
        }
        if (requests.size() > MAX_BATCH_SIZE) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "Max batch size is " + MAX_BATCH_SIZE));
        }

        List<CompletableFuture<Map<String, Object>>> futures = new ArrayList<>();
        for (int i = 0; i < requests.size(); i++) {
            final int idx = i;
            final Map<String, Object> req = requests.get(i);
            futures.add(
                    CompletableFuture.supplyAsync(() -> processSingle(idx, req), batchExecutor));
        }

        // P0 hardening: join() with no timeout let one hung upstream LLM call hold the servlet
        // thread indefinitely. Fail the whole batch fast with 504 instead.
        try {
            CompletableFuture.allOf(futures.toArray(new CompletableFuture[0]))
                    .get(BATCH_TIMEOUT_SECONDS, TimeUnit.SECONDS);
        } catch (TimeoutException e) {
            futures.forEach(f -> f.cancel(true));
            log.warn("Batch timed out after {}s, cancelling {} in-flight items", BATCH_TIMEOUT_SECONDS, futures.size());
            return ResponseEntity.status(HttpStatus.GATEWAY_TIMEOUT)
                    .body(Map.of("error", "Batch processing timed out after " + BATCH_TIMEOUT_SECONDS + " seconds"));
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            futures.forEach(f -> f.cancel(true));
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Batch processing interrupted"));
        } catch (ExecutionException e) {
            futures.forEach(f -> f.cancel(true));
            log.warn("Batch failed: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Batch processing failed"));
        }

        List<Map<String, Object>> results = new ArrayList<>(futures.size());
        for (CompletableFuture<Map<String, Object>> f : futures) {
            results.add(f.join());
        }

        usageStats.recordCall("batch");
        return ResponseEntity.ok(Map.of("results", results, "count", results.size()));
    }

    private Map<String, Object> processSingle(int index, Map<String, Object> req) {
        Object rawAction = req.getOrDefault("action", "chat");
        if (!(rawAction instanceof String action)) {
            return Map.of("index", index, "error", "action must be a string");
        }
        action = action.trim().toLowerCase(java.util.Locale.ROOT);
        if (!List.of("chat", "translate", "summarize").contains(action)) {
            return Map.of("index", index, "error", "unsupported action: " + action);
        }
        Object rawText = req.get("text");
        if (!(rawText instanceof String text) || text.isBlank()) {
            return Map.of("index", index, "error", "text is required");
        }
        if (text.length() > MAX_ITEM_TEXT_CHARS) {
            return Map.of(
                    "index",
                    index,
                    "error",
                    "text exceeds maximum length of " + MAX_ITEM_TEXT_CHARS + " characters");
        }
        try {
            String result =
                    switch (action) {
                        case "translate" -> {
                            Object rawLang = req.getOrDefault("targetLang", "zh");
                            String lang = rawLang instanceof String s && !s.isBlank() ? s : "zh";
                            yield llmService.translate(text, lang);
                        }
                        case "summarize" -> llmService.summarize(text);
                        default -> llmService.chat(text, null, null, null);
                    };
            return Map.of("index", index, "result", result, "action", action);
        } catch (IllegalArgumentException e) {
            return Map.of("index", index, "code", "INVALID_REQUEST", "error", e.getMessage());
        } catch (Exception e) {
            log.warn("Batch item {} failed: {}", index, e.getMessage());
            return Map.of("index", index, "error", "Processing failed");
        }
    }
}
