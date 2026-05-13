package com.aiassistant.controller;

import com.aiassistant.config.AiAssistantProperties;
import com.aiassistant.model.ChatInputLimits;
import com.aiassistant.model.ChatRequest;
import com.aiassistant.model.ChatResponse;
import com.aiassistant.model.ModelsListResponse;
import com.aiassistant.model.UrlPreviewResponse;
import com.aiassistant.service.LlmService;
import com.aiassistant.service.UrlFetchService;
import com.aiassistant.stats.UsageStats;
import jakarta.validation.Valid;
import java.util.concurrent.atomic.AtomicLong;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import reactor.core.publisher.Flux;

@RestController
@RequestMapping("${ai-assistant.context-path:/ai-assistant}")
@io.swagger.v3.oas.annotations.tags.Tag(
        name = "AI Assistant",
        description = "Chat, translate, summarize via LLM")
public class AiAssistantController {

    private static final Logger log = LoggerFactory.getLogger(AiAssistantController.class);

    private final LlmService llmService;
    private final UsageStats usageStats;
    private final UrlFetchService urlFetchService;
    private final AiAssistantProperties assistantProperties;

    public AiAssistantController(
            LlmService llmService,
            UsageStats usageStats,
            UrlFetchService urlFetchService,
            AiAssistantProperties assistantProperties) {
        this.llmService = llmService;
        this.usageStats = usageStats;
        this.urlFetchService = urlFetchService;
        this.assistantProperties = assistantProperties;
    }

    @io.swagger.v3.oas.annotations.Operation(
            summary = "Synchronous chat / translate / summarize",
            description = "Performs a single-turn LLM call. The `action` field selects the mode: "
                    + "`chat` (default), `translate`, or `summarize`.")
    @io.swagger.v3.oas.annotations.responses.ApiResponses({
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "200", description = "LLM response"),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "400", description = "Input too large or invalid"),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "429", description = "Token quota exceeded"),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "503", description = "LLM service unavailable")
    })
    @PostMapping("/chat")
    public ResponseEntity<ChatResponse> chat(@Valid @RequestBody ChatRequest request) {
        try {
            String tooLarge =
                    ChatInputLimits.validateTotalChars(
                            request, assistantProperties.getChatMaxTotalChars());
            if (tooLarge != null) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                        .body(ChatResponse.fail("INPUT_TOO_LARGE", tooLarge));
            }
            String action = request.getAction() == null ? "chat" : request.getAction();
            String result =
                    switch (action) {
                        case "translate" ->
                                llmService.translate(
                                        request.getText(),
                                        request.getTargetLang() != null
                                                ? request.getTargetLang()
                                                : "zh");
                        case "summarize" -> llmService.summarize(request.getText());
                        default ->
                                llmService.chat(
                                        request.getText(),
                                        request.getHistory(),
                                        request.getSystemPrompt(),
                                        request.getModel(),
                                        request.getImageData(),
                                        request.getSessionId(),
                                        request.getPageContext());
                    };
            usageStats.recordCall(action);
            return ResponseEntity.ok(ChatResponse.ok(result));
        } catch (LlmService.QuotaExceededException e) {
            usageStats.recordError();
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                    .body(ChatResponse.fail("QUOTA_EXCEEDED", e.getMessage()));
        } catch (Exception e) {
            usageStats.recordError();
            log.warn("POST /chat failed", e);
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(
                            ChatResponse.fail(
                                    "LLM_UNAVAILABLE",
                                    "AI service error. Check server logs for details."));
        }
    }

    @io.swagger.v3.oas.annotations.Operation(
            summary = "Streaming chat / translate / summarize (SSE)",
            description = "Same logic as `/chat` but returns an SSE text/event-stream. "
                    + "Each event carries a partial LLM token.")
    @io.swagger.v3.oas.annotations.responses.ApiResponses({
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "200", description = "SSE stream of LLM tokens"),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "400", description = "Input too large or invalid")
    })
    @PostMapping(value = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public ResponseEntity<Flux<String>> stream(@Valid @RequestBody ChatRequest request) {
        String tooLarge =
                ChatInputLimits.validateTotalChars(
                        request, assistantProperties.getChatMaxTotalChars());
        if (tooLarge != null) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .contentType(MediaType.TEXT_EVENT_STREAM)
                    .body(Flux.just("[VALIDATION_ERROR] " + tooLarge));
        }
        String action = request.getAction() == null ? "chat" : request.getAction();
        usageStats.recordCall("stream_" + action);
        Flux<String> flux =
                switch (action) {
                    case "translate" ->
                            llmService.translateStream(
                                    request.getText(),
                                    request.getTargetLang() != null
                                            ? request.getTargetLang()
                                            : "zh");
                    case "summarize" -> llmService.summarizeStream(request.getText());
                    default ->
                            llmService.chatStream(
                                    request.getText(),
                                    request.getHistory(),
                                    request.getSystemPrompt(),
                                    request.getModel(),
                                    request.getImageData(),
                                    request.getSessionId(),
                                    request.getPageContext());
                };
        return ResponseEntity.ok()
                .contentType(MediaType.TEXT_EVENT_STREAM)
                .body(fluxWithFriendlyErrors(flux));
    }

    private final AtomicLong lastDeepHealthMs = new AtomicLong();

    @io.swagger.v3.oas.annotations.Operation(
            summary = "Health check",
            description = "Returns service status. Pass `deep=true` to probe LLM reachability (rate-limited to once per minute).")
    @GetMapping("/health")
    public java.util.Map<String, Object> health(
            @RequestParam(value = "deep", required = false, defaultValue = "false") boolean deep) {
        java.util.Map<String, Object> result = new java.util.LinkedHashMap<>();
        result.put("success", true);
        result.put("status", "running");
        result.put("provider", assistantProperties.getProvider());
        result.put("model", assistantProperties.resolveModel());
        if (deep) {
            long now = System.currentTimeMillis();
            long prev = lastDeepHealthMs.get();
            if (now - prev < 60_000) {
                result.put("llmReachable", "rate-limited (1 deep check per minute)");
            } else if (lastDeepHealthMs.compareAndSet(prev, now)) {
                boolean llmReachable = false;
                try {
                    String test = llmService.chat("ping");
                    llmReachable = test != null && !test.isBlank();
                } catch (Exception e) {
                    log.debug("deep health check failed: {}", e.getMessage());
                }
                result.put("llmReachable", llmReachable);
            } else {
                result.put("llmReachable", "rate-limited (1 deep check per minute)");
            }
        }
        return result;
    }

    @io.swagger.v3.oas.annotations.Operation(
            summary = "List available models",
            description = "Returns models allowed by `ai-assistant.allowed-models` config; "
                    + "falls back to the single default model when not configured.")
    @GetMapping("/models")
    public ModelsListResponse listModels() {
        return ModelsListResponse.ok(
                assistantProperties.listModelsForClient(), assistantProperties.resolveModel());
    }

    @io.swagger.v3.oas.annotations.Operation(
            summary = "URL preview / link unfurl",
            description = "Extracts og:image, title, and summary from a URL for rich link previews.")
    @GetMapping("/url-preview")
    public UrlPreviewResponse urlPreview(
            @RequestParam(value = "url", required = false) String url) {
        return urlFetchService.previewUrl(url);
    }

    /**
     * LLM 流中途失败时若直接抛错，Servlet 往往整条 /stream 变成 HTTP 500，前端只能看到 statusText。 转为 200 SSE
     * 单段文案，便于展示具体原因（如上游 429/5xx 信息）。
     */
    private Flux<String> fluxWithFriendlyErrors(Flux<String> flux) {
        return flux.onErrorResume(
                e -> {
                    usageStats.recordError();
                    log.warn("Assistant stream failed", e);
                    if (e instanceof LlmService.QuotaExceededException) {
                        return Flux.just("[QUOTA_EXCEEDED] " + e.getMessage());
                    }
                    String msg = e.getMessage();
                    if (msg != null && (msg.contains("429") || msg.toLowerCase().contains("rate limit"))) {
                        return Flux.just("[RATE_LIMITED] " + msg);
                    }
                    if (msg != null && (msg.contains("timeout") || msg.contains("timed out"))) {
                        return Flux.just("[TIMEOUT] " + msg);
                    }
                    return Flux.just("[LLM_ERROR] AI service error. Check server logs for details.");
                });
    }
}
