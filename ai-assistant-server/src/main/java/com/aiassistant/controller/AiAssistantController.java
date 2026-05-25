package com.aiassistant.controller;

import com.aiassistant.config.AiAssistantProperties;
import com.aiassistant.model.ChatInputLimits;
import com.aiassistant.model.ChatRequest;
import com.aiassistant.model.ChatResponse;
import com.aiassistant.model.ModelCapabilityRegistry;
import com.aiassistant.model.ModelsListResponse;
import com.aiassistant.model.UrlPreviewResponse;
import com.aiassistant.service.LlmService;
import com.aiassistant.service.UrlFetchService;
import com.aiassistant.stats.UsageStats;
import jakarta.validation.Valid;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.concurrent.atomic.AtomicLong;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
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
    private static final int MAX_WEB_SEARCH_SOURCE_URL_HEADERS = 3;
    private static final String VISION_PROBE_IMAGE =
            "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=";

    private final LlmService llmService;
    private final UsageStats usageStats;
    private final UrlFetchService urlFetchService;
    private final AiAssistantProperties assistantProperties;
    private final ModelCapabilityRegistry modelCapabilityRegistry;

    public AiAssistantController(
            LlmService llmService,
            UsageStats usageStats,
            UrlFetchService urlFetchService,
            AiAssistantProperties assistantProperties,
            ModelCapabilityRegistry modelCapabilityRegistry) {
        this.llmService = llmService;
        this.usageStats = usageStats;
        this.urlFetchService = urlFetchService;
        this.assistantProperties = assistantProperties;
        this.modelCapabilityRegistry = modelCapabilityRegistry;
    }

    @io.swagger.v3.oas.annotations.Operation(
            summary = "Synchronous chat / translate / summarize",
            description =
                    "Performs a single-turn LLM call. The `action` field selects the mode: "
                            + "`chat` (default), `translate`, or `summarize`.")
    @io.swagger.v3.oas.annotations.responses.ApiResponses({
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
                responseCode = "200",
                description = "LLM response"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
                responseCode = "400",
                description = "Input too large or invalid"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
                responseCode = "429",
                description = "Token quota exceeded"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
                responseCode = "503",
                description = "LLM service unavailable")
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
            EffectivePageContext pageContext = effectivePageContext(request, action);
            ChatResponse.RuntimeMeta meta = runtimeMeta(request, action, pageContext.webSearch());
            String result =
                    switch (action) {
                        case "translate" ->
                                llmService.translate(
                                        request.getText(),
                                        request.getTargetLang() != null
                                                ? request.getTargetLang()
                                                : "zh",
                                        request.getModel());
                        case "summarize" ->
                                llmService.summarize(request.getText(), request.getModel());
                        default ->
                                llmService.chat(
                                        request.getText(),
                                        request.getHistory(),
                                        request.getSystemPrompt(),
                                        request.getModel(),
                                        request.resolveImageDataList(),
                                        request.getSessionId(),
                                        pageContext.value());
                    };
            usageStats.recordCall(action);
            return ResponseEntity.ok(ChatResponse.ok(result, meta));
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
            description =
                    "`/stream` is the compatibility streaming endpoint used by the official UI "
                            + "and Java client. It returns unnamed SSE data frames where each "
                            + "`data:` value is a partial LLM token. Use `/sse` when consumers "
                            + "need typed `message` / `done` / `error` events.")
    @io.swagger.v3.oas.annotations.responses.ApiResponses({
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
                responseCode = "200",
                description = "SSE stream of LLM tokens"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
                responseCode = "400",
                description = "Input too large or invalid")
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
        EffectivePageContext pageContext = effectivePageContext(request, action);
        ChatResponse.RuntimeMeta meta = runtimeMeta(request, action, pageContext.webSearch());
        usageStats.recordCall("stream_" + action);
        Flux<String> flux =
                switch (action) {
                    case "translate" ->
                            llmService.translateStream(
                                    request.getText(),
                                    request.getTargetLang() != null
                                            ? request.getTargetLang()
                                            : "zh",
                                    request.getModel());
                    case "summarize" ->
                            llmService.summarizeStream(request.getText(), request.getModel());
                    default ->
                            llmService.chatStream(
                                    request.getText(),
                                    request.getHistory(),
                                    request.getSystemPrompt(),
                                    request.getModel(),
                                    request.resolveImageDataList(),
                                    request.getSessionId(),
                                    pageContext.value());
                };
        return ResponseEntity.ok()
                .contentType(MediaType.TEXT_EVENT_STREAM)
                .headers(runtimeHeaders(meta))
                .body(fluxWithFriendlyErrors(flux));
    }

    private ChatResponse.RuntimeMeta runtimeMeta(
            ChatRequest request, String action, UrlFetchService.WebSearchResult webSearch) {
        ChatResponse.RuntimeMeta meta = new ChatResponse.RuntimeMeta();
        meta.setProvider(assistantProperties.getProvider());
        String requestedModel =
                request.getModel() != null && !request.getModel().isBlank()
                        ? request.getModel().trim()
                        : null;
        meta.setRequestedModel(requestedModel);
        String effectiveModel = assistantProperties.resolveEffectiveModel(requestedModel);
        meta.setEffectiveModel(effectiveModel);
        meta.setFallback(
                requestedModel != null
                        && effectiveModel != null
                        && !requestedModel.equals(effectiveModel));
        List<String> imageDataList =
                "chat".equals(action) ? request.resolveImageDataList() : java.util.List.of();
        meta.setVisionInputCount(imageDataList.size());
        if (!imageDataList.isEmpty()) {
            meta.setVisionRoute(
                    "minimax".equalsIgnoreCase(assistantProperties.getProvider())
                            ? "minimax-vlm"
                            : "openai-compatible-vision");
        }
        if (webSearch != null && webSearch.hasAttempt()) {
            meta.setWebSearchEnabled(true);
            meta.setWebSearchProvider(webSearch.provider());
            meta.setWebSearchFallback(webSearch.fallback());
            meta.setWebSearchResultCount(webSearch.resultCount());
            meta.setWebSearchSourceUrls(webSearch.sourceUrls());
            meta.setWebSearchFailureReason(webSearch.failureReason());
            meta.setWebSearchDurationMs(webSearch.durationMs());
            meta.setWebSearchStableDurationMs(webSearch.stableProviderDurationMs());
            meta.setWebSearchFallbackDurationMs(webSearch.fallbackDurationMs());
        }
        return meta;
    }

    private EffectivePageContext effectivePageContext(ChatRequest request, String action) {
        String pageContext = request.getPageContext();
        if (!"chat".equals(action) || !request.isWebSearch()) {
            return new EffectivePageContext(pageContext, null);
        }
        UrlFetchService.WebSearchResult search = urlFetchService.searchWeb(request.getText());
        if (search == null || !search.hasAttempt()) {
            return new EffectivePageContext(pageContext, null);
        }
        if (!search.hasResults()) {
            return new EffectivePageContext(pageContext, search);
        }
        String value =
                java.util.stream.Stream.of(pageContext, search.markdown())
                .filter(s -> s != null && !s.isBlank())
                .collect(java.util.stream.Collectors.joining("\n\n"));
        return new EffectivePageContext(value, search);
    }

    private record EffectivePageContext(
            String value, UrlFetchService.WebSearchResult webSearch) {}

    private HttpHeaders runtimeHeaders(ChatResponse.RuntimeMeta meta) {
        HttpHeaders headers = new HttpHeaders();
        addHeader(headers, "X-AI-Requested-Model", meta.getRequestedModel());
        addHeader(headers, "X-AI-Effective-Model", meta.getEffectiveModel());
        addHeader(headers, "X-AI-Provider", meta.getProvider());
        headers.add("X-AI-Fallback", String.valueOf(meta.isFallback()));
        headers.add("X-AI-Vision-Input-Count", String.valueOf(meta.getVisionInputCount()));
        addHeader(headers, "X-AI-Vision-Route", meta.getVisionRoute());
        if (meta.isWebSearchEnabled()) {
            headers.add("X-AI-Web-Search", "true");
            addHeader(headers, "X-AI-Web-Search-Provider", meta.getWebSearchProvider());
            headers.add("X-AI-Web-Search-Fallback", String.valueOf(meta.isWebSearchFallback()));
            headers.add(
                    "X-AI-Web-Search-Result-Count",
                    String.valueOf(meta.getWebSearchResultCount()));
            String encodedSourceUrls = encodeWebSearchSourceUrls(meta.getWebSearchSourceUrls());
            addHeader(headers, "X-AI-Web-Search-Source-Urls", encodedSourceUrls);
            addHeader(headers, "X-AI-Web-Search-Failure", meta.getWebSearchFailureReason());
            addNonNegativeLongHeader(
                    headers, "X-AI-Web-Search-Duration-Ms", meta.getWebSearchDurationMs());
            addNonNegativeLongHeader(
                    headers,
                    "X-AI-Web-Search-Stable-Duration-Ms",
                    meta.getWebSearchStableDurationMs());
            addNonNegativeLongHeader(
                    headers,
                    "X-AI-Web-Search-Fallback-Duration-Ms",
                    meta.getWebSearchFallbackDurationMs());
        }
        headers.add(
                HttpHeaders.ACCESS_CONTROL_EXPOSE_HEADERS,
                "X-AI-Requested-Model, X-AI-Effective-Model, X-AI-Provider, X-AI-Fallback, X-AI-Vision-Input-Count, X-AI-Vision-Route, X-AI-Web-Search, X-AI-Web-Search-Provider, X-AI-Web-Search-Fallback, X-AI-Web-Search-Result-Count, X-AI-Web-Search-Source-Urls, X-AI-Web-Search-Failure, X-AI-Web-Search-Duration-Ms, X-AI-Web-Search-Stable-Duration-Ms, X-AI-Web-Search-Fallback-Duration-Ms");
        return headers;
    }

    private static String encodeWebSearchSourceUrls(List<String> urls) {
        if (urls == null || urls.isEmpty()) {
            return null;
        }
        return urls.stream()
                .filter(url -> url != null && !url.isBlank())
                .limit(MAX_WEB_SEARCH_SOURCE_URL_HEADERS)
                .map(url -> URLEncoder.encode(url, StandardCharsets.UTF_8))
                .collect(java.util.stream.Collectors.joining(","));
    }

    private static void addHeader(HttpHeaders headers, String name, String value) {
        if (value != null && !value.isBlank()) {
            headers.add(name, value);
        }
    }

    private static void addNonNegativeLongHeader(HttpHeaders headers, String name, long value) {
        if (value >= 0) {
            headers.add(name, String.valueOf(value));
        }
    }

    private final AtomicLong lastDeepHealthMs = new AtomicLong();

    @io.swagger.v3.oas.annotations.Operation(
            summary = "Health check",
            description =
                    "Returns service status. Pass `deep=true` to probe LLM reachability (rate-limited to once per minute).")
    @GetMapping("/health")
    public java.util.Map<String, Object> health(
            @RequestParam(value = "deep", required = false, defaultValue = "false") boolean deep) {
        java.util.Map<String, Object> result = new java.util.LinkedHashMap<>();
        result.put("success", true);
        result.put("status", "running");
        result.put("provider", assistantProperties.getProvider());
        result.put("model", assistantProperties.resolveModel());
        String webSearchProvider = assistantProperties.getUrlFetch().getWebSearchProvider();
        result.put("webSearchProvider", webSearchProvider);
        result.put("webSearchMaxResults", assistantProperties.getUrlFetch().getWebSearchMaxResults());
        result.put(
                "webSearchStableProviderConfigured",
                "tavily".equalsIgnoreCase(webSearchProvider)
                        && assistantProperties.getUrlFetch().getWebSearchApiKey() != null
                        && !assistantProperties.getUrlFetch().getWebSearchApiKey().isBlank());
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
            description =
                    "Returns models allowed by `ai-assistant.allowed-models` config; "
                            + "falls back to the single default model when not configured.")
    @GetMapping("/models")
    public ModelsListResponse listModels(
            @RequestParam(value = "probe", required = false, defaultValue = "false")
                    boolean probe) {
        var models = assistantProperties.listModelsForClient();
        if (probe) {
            return ModelsListResponse.ok(
                    models,
                    assistantProperties.resolveModel(),
                    modelCapabilityRegistry.describeAllWithVisionProbe(
                            assistantProperties.getProvider(),
                            models,
                            this::probeVisionCapability));
        }
        return ModelsListResponse.ok(
                models,
                assistantProperties.resolveModel(),
                modelCapabilityRegistry.describeAll(assistantProperties.getProvider(), models));
    }

    public ModelsListResponse listModels() {
        return listModels(false);
    }

    private boolean probeVisionCapability(String modelId) {
        try {
            String result =
                    llmService.chat(
                            "Capability probe: reply with OK if this image input request is accepted.",
                            null,
                            null,
                            modelId,
                            java.util.List.of(VISION_PROBE_IMAGE),
                            null,
                            null);
            return result != null;
        } catch (Exception e) {
            log.debug("vision capability probe failed for model {}: {}", modelId, e.getMessage());
            return false;
        }
    }

    @io.swagger.v3.oas.annotations.Operation(
            summary = "URL preview / link unfurl",
            description =
                    "Extracts og:image, title, and summary from a URL for rich link previews.")
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
                    if (msg != null
                            && (msg.contains("429") || msg.toLowerCase().contains("rate limit"))) {
                        return Flux.just("[RATE_LIMITED] " + msg);
                    }
                    if (msg != null && (msg.contains("timeout") || msg.contains("timed out"))) {
                        return Flux.just("[TIMEOUT] " + msg);
                    }
                    return Flux.just(
                            "[LLM_ERROR] AI service error. Check server logs for details.");
                });
    }
}
