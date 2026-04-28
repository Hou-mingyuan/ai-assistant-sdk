package com.aiassistant.controller;

import com.aiassistant.service.LlmService;
import com.aiassistant.stats.UsageStats;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
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

    private final LlmService llmService;
    private final UsageStats usageStats;

    public BatchController(LlmService llmService, UsageStats usageStats) {
        this.llmService = llmService;
        this.usageStats = usageStats;
    }

    @PostMapping
    @Operation(summary = "Submit a batch of chat/translate/summarize requests")
    public ResponseEntity<Map<String, Object>> batchProcess(@RequestBody Map<String, Object> body) {
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> requests = (List<Map<String, Object>>) body.get("requests");
        if (requests == null || requests.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "requests array is required"));
        }
        if (requests.size() > MAX_BATCH_SIZE) {
            return ResponseEntity.badRequest().body(Map.of("error", "Max batch size is " + MAX_BATCH_SIZE));
        }

        List<CompletableFuture<Map<String, Object>>> futures = new ArrayList<>();
        for (int i = 0; i < requests.size(); i++) {
            final int idx = i;
            final Map<String, Object> req = requests.get(i);
            futures.add(CompletableFuture.supplyAsync(() -> processSingle(idx, req)));
        }

        List<Map<String, Object>> results = futures.stream()
                .map(CompletableFuture::join)
                .toList();

        usageStats.recordCall("batch");
        return ResponseEntity.ok(Map.of("results", results, "count", results.size()));
    }

    private Map<String, Object> processSingle(int index, Map<String, Object> req) {
        String action = (String) req.getOrDefault("action", "chat");
        String text = (String) req.get("text");
        if (text == null || text.isBlank()) {
            return Map.of("index", index, "error", "text is required");
        }
        try {
            String result = switch (action) {
                case "translate" -> {
                    String lang = (String) req.getOrDefault("targetLang", "zh");
                    yield llmService.translate(text, lang);
                }
                case "summarize" -> llmService.summarize(text);
                default -> llmService.chat(text, null, null, null);
            };
            return Map.of("index", index, "result", result, "action", action);
        } catch (Exception e) {
            log.warn("Batch item {} failed: {}", index, e.getMessage());
            return Map.of("index", index, "error", "Processing failed");
        }
    }
}
