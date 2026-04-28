package com.aiassistant.controller;

import com.aiassistant.config.AiAssistantProperties;
import com.aiassistant.model.ChatInputLimits;
import com.aiassistant.model.ChatRequest;
import com.aiassistant.service.LlmService;
import com.aiassistant.stats.UsageStats;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.codec.ServerSentEvent;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import reactor.core.publisher.Flux;

import java.time.Duration;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Standardized SSE streaming endpoint with proper event types.
 * <pre>
 * Event types:
 *   event: message   — content delta chunk
 *   event: done      — stream complete (data: [DONE])
 *   event: error     — error occurred (data: error description)
 * </pre>
 */
@RestController
@RequestMapping("${ai-assistant.context-path:/ai-assistant}")
public class SseStreamController {

    private static final Logger log = LoggerFactory.getLogger(SseStreamController.class);

    private final LlmService llmService;
    private final UsageStats usageStats;
    private final AiAssistantProperties properties;
    private final AtomicLong eventCounter = new AtomicLong();

    public SseStreamController(LlmService llmService, UsageStats usageStats,
                                AiAssistantProperties properties) {
        this.llmService = llmService;
        this.usageStats = usageStats;
        this.properties = properties;
    }

    @PostMapping(value = "/sse", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public ResponseEntity<Flux<ServerSentEvent<String>>> sse(@Valid @RequestBody ChatRequest request) {
        String tooLarge = ChatInputLimits.validateTotalChars(request, properties.getChatMaxTotalChars());
        if (tooLarge != null) {
            Flux<ServerSentEvent<String>> errFlux = Flux.just(
                    ServerSentEvent.<String>builder()
                            .event("error")
                            .data(tooLarge)
                            .build());
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(errFlux);
        }

        String action = request.getAction() == null ? "chat" : request.getAction();
        usageStats.recordCall("sse_" + action);

        Flux<String> rawFlux = switch (action) {
            case "translate" -> llmService.translateStream(
                    request.getText(),
                    request.getTargetLang() != null ? request.getTargetLang() : "zh");
            case "summarize" -> llmService.summarizeStream(request.getText());
            default -> llmService.chatStream(
                    request.getText(), request.getHistory(), request.getSystemPrompt(),
                    request.getModel(), request.getImageData());
        };

        Flux<ServerSentEvent<String>> sseFlux = rawFlux
                .onBackpressureBuffer(256, dropped ->
                        log.warn("SSE backpressure: dropped chunk for slow client"))
                .timeout(Duration.ofMinutes(5))
                .map(chunk -> ServerSentEvent.<String>builder()
                        .id(String.valueOf(eventCounter.incrementAndGet()))
                        .event("message")
                        .data(chunk)
                        .build())
                .concatWith(Flux.just(
                        ServerSentEvent.<String>builder()
                                .event("done")
                                .data("[DONE]")
                                .build()))
                .onErrorResume(e -> {
                    usageStats.recordError();
                    log.warn("SSE stream failed", e);
                    return Flux.just(
                            ServerSentEvent.<String>builder()
                                    .event("error")
                                    .data("AI service encountered an error. Please try again.")
                                    .build());
                });

        return ResponseEntity.ok()
                .header("X-Accel-Buffering", "no")
                .header("Cache-Control", "no-cache")
                .body(sseFlux);
    }
}
