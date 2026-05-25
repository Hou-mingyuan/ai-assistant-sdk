package com.aiassistant.controller;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.aiassistant.config.AiAssistantProperties;
import com.aiassistant.model.ChatRequest;
import com.aiassistant.model.ModelCapabilityRegistry;
import com.aiassistant.service.LlmService;
import com.aiassistant.service.UrlFetchService;
import com.aiassistant.stats.UsageStats;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import reactor.core.publisher.Flux;

class AiAssistantControllerTest {

    private AiAssistantController controller;
    private LlmService llmService;
    private UsageStats usageStats;
    private UrlFetchService urlFetchService;
    private AiAssistantProperties props;

    @BeforeEach
    void setUp() {
        llmService = mock(LlmService.class);
        usageStats = new UsageStats();
        urlFetchService = mock(UrlFetchService.class);
        props = new AiAssistantProperties();
        controller =
                new AiAssistantController(
                        llmService,
                        usageStats,
                        urlFetchService,
                        props,
                        new ModelCapabilityRegistry());
    }

    @Test
    void chat_returnsOk_whenLlmSucceeds() {
        /* K26 + K53: controller now calls the 7-arg chat overload
         * (text, history, systemPrompt, model, imageDataList, sessionId, pageContext).
         * After K53 introduced a second 7-arg overload taking List<String> imageDataList
         * (instead of String imageData), we must disambiguate to that overload by
         * giving Mockito a typed List matcher for the 5th argument. */
        when(llmService.chat(anyString(), any(), any(), any(), any(List.class), any(), any()))
                .thenReturn("Hello!");
        ChatRequest req = new ChatRequest();
        req.setText("hi");
        req.setAction("chat");

        var response = controller.chat(req);
        assertEquals(200, response.getStatusCode().value());
        assertTrue(response.getBody().isSuccess());
        assertEquals("Hello!", response.getBody().getResult());
    }

    @Test
    void chat_returnsRuntimeMetadataForWhitelistedVisionModel() {
        props.setProvider("minimax");
        props.setModel("MiniMax-M2.5");
        props.setAllowedModels(java.util.List.of("MiniMax-M2.5", "MiniMax-M2.7"));
        when(llmService.chat(anyString(), any(), any(), any(), any(List.class), any(), any()))
                .thenReturn("Hello!");
        ChatRequest req = new ChatRequest();
        req.setText("hi");
        req.setAction("chat");
        req.setModel("MiniMax-M2.7");
        req.setImageDataList(java.util.List.of("data:image/png;base64,shot"));

        var response = controller.chat(req);

        assertEquals(200, response.getStatusCode().value());
        var meta = response.getBody().getMeta();
        assertEquals("MiniMax-M2.7", meta.getRequestedModel());
        assertEquals("MiniMax-M2.7", meta.getEffectiveModel());
        assertEquals("minimax", meta.getProvider());
        assertFalse(meta.isFallback());
        assertEquals(1, meta.getVisionInputCount());
        assertEquals("minimax-vlm", meta.getVisionRoute());
    }

    @Test
    void chat_returnsWebSearchRuntimeMetadataAndInjectsSearchContext() {
        when(urlFetchService.searchWeb("latest LNG"))
                .thenReturn(
                        new UrlFetchService.WebSearchResult(
                                "# 联网搜索结果\n来源：Tavily\n1. Result",
                                "Tavily",
                                false,
                                1,
                                Instant.parse("2026-05-25T04:00:00Z")));
        when(llmService.chat(anyString(), any(), any(), any(), any(List.class), any(), any()))
                .thenReturn("answer");
        ChatRequest req = new ChatRequest();
        req.setText("latest LNG");
        req.setAction("chat");
        req.setWebSearch(true);
        req.setPageContext("existing page");

        var response = controller.chat(req);

        assertEquals(200, response.getStatusCode().value());
        var meta = response.getBody().getMeta();
        assertTrue(meta.isWebSearchEnabled());
        assertEquals("Tavily", meta.getWebSearchProvider());
        assertFalse(meta.isWebSearchFallback());
        assertEquals(1, meta.getWebSearchResultCount());
        verify(llmService)
                .chat(
                        eq("latest LNG"),
                        any(),
                        any(),
                        any(),
                        any(List.class),
                        any(),
                        argThat(
                                context ->
                                        context.contains("existing page")
                                                && context.contains("# 联网搜索结果")));
    }

    @Test
    void chat_translate_delegatesToTranslate() {
        when(llmService.translate(anyString(), anyString(), any())).thenReturn("你好");
        ChatRequest req = new ChatRequest();
        req.setText("hello");
        req.setAction("translate");
        req.setTargetLang("zh");

        var response = controller.chat(req);
        assertEquals(200, response.getStatusCode().value());
        assertEquals("你好", response.getBody().getResult());
        verify(llmService).translate("hello", "zh", null);
    }

    @Test
    void chat_translatePassesRequestedModelAndReturnsRuntimeMetadata() {
        props.setProvider("minimax");
        props.setModel("MiniMax-M2.5");
        props.setAllowedModels(java.util.List.of("MiniMax-M2.5", "MiniMax-M2.7"));
        when(llmService.translate(anyString(), anyString(), anyString())).thenReturn("你好");
        ChatRequest req = new ChatRequest();
        req.setText("hello");
        req.setAction("translate");
        req.setTargetLang("zh");
        req.setModel("MiniMax-M2.7");

        var response = controller.chat(req);

        assertEquals(200, response.getStatusCode().value());
        assertEquals("你好", response.getBody().getResult());
        verify(llmService).translate("hello", "zh", "MiniMax-M2.7");
        var meta = response.getBody().getMeta();
        assertEquals("MiniMax-M2.7", meta.getRequestedModel());
        assertEquals("MiniMax-M2.7", meta.getEffectiveModel());
        assertFalse(meta.isFallback());
    }

    @Test
    void chat_summarize_delegatesToSummarize() {
        when(llmService.summarize(anyString(), any())).thenReturn("Summary here");
        ChatRequest req = new ChatRequest();
        req.setText("long text...");
        req.setAction("summarize");

        var response = controller.chat(req);
        assertEquals(200, response.getStatusCode().value());
        assertEquals("Summary here", response.getBody().getResult());
        verify(llmService).summarize("long text...", null);
    }

    @Test
    void chat_returns503_whenLlmThrows() {
        /* K26 + K53: match the 7-arg List<String> overload (see comment above). */
        when(llmService.chat(anyString(), any(), any(), any(), any(List.class), any(), any()))
                .thenThrow(new RuntimeException("API down"));
        ChatRequest req = new ChatRequest();
        req.setText("hi");

        var response = controller.chat(req);
        assertEquals(503, response.getStatusCode().value());
        assertFalse(response.getBody().isSuccess());
    }

    @Test
    void stream_returnsFlux_forChat() {
        /* K26 + K53: match the 7-arg List<String> chatStream overload. */
        when(llmService.chatStream(anyString(), any(), any(), any(), any(List.class), any(), any()))
                .thenReturn(Flux.just("chunk1", "chunk2"));
        ChatRequest req = new ChatRequest();
        req.setText("hello");
        req.setAction("chat");

        var response = controller.stream(req);
        assertEquals(200, response.getStatusCode().value());
        var chunks = response.getBody().collectList().block();
        assertNotNull(chunks);
        assertEquals(2, chunks.size());
        assertEquals("chunk1", chunks.get(0));
    }

    @Test
    void stream_returnsRuntimeMetadataHeaders() {
        props.setProvider("minimax");
        props.setModel("MiniMax-M2.5");
        props.setAllowedModels(java.util.List.of("MiniMax-M2.5", "MiniMax-M2.7"));
        when(llmService.chatStream(anyString(), any(), any(), any(), any(List.class), any(), any()))
                .thenReturn(Flux.just("chunk"));
        ChatRequest req = new ChatRequest();
        req.setText("hello");
        req.setAction("chat");
        req.setModel("MiniMax-M2.7");
        req.setImageDataList(java.util.List.of("data:image/png;base64,shot"));

        var response = controller.stream(req);

        assertEquals("MiniMax-M2.7", response.getHeaders().getFirst("X-AI-Requested-Model"));
        assertEquals("MiniMax-M2.7", response.getHeaders().getFirst("X-AI-Effective-Model"));
        assertEquals("minimax", response.getHeaders().getFirst("X-AI-Provider"));
        assertEquals("false", response.getHeaders().getFirst("X-AI-Fallback"));
        assertEquals("1", response.getHeaders().getFirst("X-AI-Vision-Input-Count"));
        assertEquals("minimax-vlm", response.getHeaders().getFirst("X-AI-Vision-Route"));
    }

    @Test
    void stream_returnsWebSearchRuntimeMetadataHeaders() {
        when(urlFetchService.searchWeb("current news"))
                .thenReturn(
                        new UrlFetchService.WebSearchResult(
                                "# 联网搜索结果\n来源：DuckDuckGo fallback\n1. Result",
                                "DuckDuckGo fallback",
                                true,
                                1,
                                Instant.parse("2026-05-25T04:00:00Z")));
        when(llmService.chatStream(anyString(), any(), any(), any(), any(List.class), any(), any()))
                .thenReturn(Flux.just("chunk"));
        ChatRequest req = new ChatRequest();
        req.setText("current news");
        req.setAction("chat");
        req.setWebSearch(true);

        var response = controller.stream(req);

        assertEquals("true", response.getHeaders().getFirst("X-AI-Web-Search"));
        assertEquals("DuckDuckGo fallback", response.getHeaders().getFirst("X-AI-Web-Search-Provider"));
        assertEquals("true", response.getHeaders().getFirst("X-AI-Web-Search-Fallback"));
        assertEquals("1", response.getHeaders().getFirst("X-AI-Web-Search-Result-Count"));
    }

    @Test
    void stream_returnsTopWebSearchSourceUrlsHeader() {
        when(urlFetchService.searchWeb("current news"))
                .thenReturn(
                        new UrlFetchService.WebSearchResult(
                                "# 联网搜索结果\n来源：Tavily\n1. Result",
                                "Tavily",
                                false,
                                2,
                                Instant.parse("2026-05-25T04:00:00Z"),
                                java.util.List.of(
                                        "https://example.com/a",
                                        "https://example.com/b?x=1&y=2")));
        when(llmService.chatStream(anyString(), any(), any(), any(), any(List.class), any(), any()))
                .thenReturn(Flux.just("chunk"));
        ChatRequest req = new ChatRequest();
        req.setText("current news");
        req.setAction("chat");
        req.setWebSearch(true);

        var response = controller.stream(req);

        assertEquals(
                "https%3A%2F%2Fexample.com%2Fa,https%3A%2F%2Fexample.com%2Fb%3Fx%3D1%26y%3D2",
                response.getHeaders().getFirst("X-AI-Web-Search-Source-Urls"));
    }

    @Test
    void stream_returnsWebSearchFailureAndTimingHeaders() {
        when(urlFetchService.searchWeb("rare topic"))
                .thenReturn(
                        new UrlFetchService.WebSearchResult(
                                "",
                                "DuckDuckGo fallback",
                                true,
                                0,
                                Instant.parse("2026-05-25T04:00:00Z"),
                                java.util.List.of(),
                                java.util.List.of(),
                                "no_results",
                                321,
                                120,
                                201));
        when(llmService.chatStream(anyString(), any(), any(), any(), any(List.class), any(), any()))
                .thenReturn(Flux.just("chunk"));
        ChatRequest req = new ChatRequest();
        req.setText("rare topic");
        req.setAction("chat");
        req.setWebSearch(true);

        var response = controller.stream(req);

        assertEquals("no_results", response.getHeaders().getFirst("X-AI-Web-Search-Failure"));
        assertEquals("321", response.getHeaders().getFirst("X-AI-Web-Search-Duration-Ms"));
        assertEquals("120", response.getHeaders().getFirst("X-AI-Web-Search-Stable-Duration-Ms"));
        assertEquals("201", response.getHeaders().getFirst("X-AI-Web-Search-Fallback-Duration-Ms"));
    }

    @Test
    void stream_reportsWebSearchAttemptEvenWhenNoResultsAreFound() {
        when(urlFetchService.searchWeb("rare topic"))
                .thenReturn(
                        new UrlFetchService.WebSearchResult(
                                "",
                                "DuckDuckGo fallback",
                                true,
                                0,
                                Instant.parse("2026-05-25T04:00:00Z")));
        when(llmService.chatStream(anyString(), any(), any(), any(), any(List.class), any(), any()))
                .thenReturn(Flux.just("chunk"));
        ChatRequest req = new ChatRequest();
        req.setText("rare topic");
        req.setAction("chat");
        req.setWebSearch(true);

        var response = controller.stream(req);

        assertEquals("true", response.getHeaders().getFirst("X-AI-Web-Search"));
        assertEquals(
                "DuckDuckGo fallback",
                response.getHeaders().getFirst("X-AI-Web-Search-Provider"));
        assertEquals("true", response.getHeaders().getFirst("X-AI-Web-Search-Fallback"));
        assertEquals("0", response.getHeaders().getFirst("X-AI-Web-Search-Result-Count"));
    }

    @Test
    void stream_returnsFriendlyErrorChunkWhenLlmStreamFails() {
        when(llmService.chatStream(anyString(), any(), any(), any(), any(List.class), any(), any()))
                .thenReturn(Flux.error(new RuntimeException("HTTP 429 upstream rate limit")));
        ChatRequest req = new ChatRequest();
        req.setText("hello");
        req.setAction("chat");

        var response = controller.stream(req);
        var chunks = response.getBody().collectList().block();

        assertEquals(200, response.getStatusCode().value());
        assertNotNull(chunks);
        assertEquals(List.of("[RATE_LIMITED] HTTP 429 upstream rate limit"), chunks);
    }

    @Test
    void stream_returnsValidationErrorChunkForOversizedInput() {
        props.setChatMaxTotalChars(3);
        ChatRequest req = new ChatRequest();
        req.setText("too long");

        var response = controller.stream(req);
        var chunks = response.getBody().collectList().block();

        assertEquals(400, response.getStatusCode().value());
        assertEquals(
                org.springframework.http.MediaType.TEXT_EVENT_STREAM,
                response.getHeaders().getContentType());
        assertNotNull(chunks);
        assertEquals(1, chunks.size());
        assertTrue(chunks.get(0).startsWith("[VALIDATION_ERROR] "));
    }

    @Test
    void stream_translatePassesRequestedModelAndReturnsRuntimeMetadataHeaders() {
        props.setProvider("minimax");
        props.setModel("MiniMax-M2.5");
        props.setAllowedModels(java.util.List.of("MiniMax-M2.5", "MiniMax-M2.7"));
        when(llmService.translateStream(anyString(), anyString(), anyString()))
                .thenReturn(Flux.just("你好"));
        ChatRequest req = new ChatRequest();
        req.setText("hello");
        req.setAction("translate");
        req.setTargetLang("zh");
        req.setModel("MiniMax-M2.7");

        var response = controller.stream(req);

        verify(llmService).translateStream("hello", "zh", "MiniMax-M2.7");
        assertEquals("MiniMax-M2.7", response.getHeaders().getFirst("X-AI-Requested-Model"));
        assertEquals("MiniMax-M2.7", response.getHeaders().getFirst("X-AI-Effective-Model"));
        assertEquals("false", response.getHeaders().getFirst("X-AI-Fallback"));
    }

    @Test
    void health_returnsRunning() {
        var result = controller.health(false);
        assertEquals(true, result.get("success"));
        assertEquals("running", result.get("status"));
    }

    @Test
    void health_reportsWebSearchConfiguration() {
        props.getUrlFetch().setWebSearchProvider("tavily");
        props.getUrlFetch().setWebSearchApiKey("tvly-test");
        props.getUrlFetch().setWebSearchMaxResults(7);

        var result = controller.health(false);

        assertEquals("tavily", result.get("webSearchProvider"));
        assertEquals(true, result.get("webSearchStableProviderConfigured"));
        assertEquals(7, result.get("webSearchMaxResults"));
    }

    @Test
    void health_deep_checksLlm() {
        when(llmService.chat("ping")).thenReturn("pong");
        var result = controller.health(true);
        assertEquals(true, result.get("llmReachable"));
    }

    @Test
    void models_returnsModelsList() {
        props.setAllowedModels(java.util.List.of("gpt-4", "gpt-3.5-turbo"));
        var response = controller.listModels();
        assertTrue(response.isSuccess());
        assertNotNull(response.getModels());
    }

    @Test
    void models_returnsCapabilityDetailsForLatestKnownModels() {
        props.setProvider("minimax");
        props.setAllowedModels(
                java.util.List.of(
                        "MiniMax-M2.7",
                        "gpt-5.4",
                        "gemini-3.1-pro",
                        "qwen3.5-omni",
                        "kimi-k2.6",
                        "deepseek-v4-flash",
                        "gpt-realtime-2",
                        "text-embedding-3-large",
                        "bge-reranker-v2-m3"));

        var response = controller.listModels();

        assertEquals(9, response.getModelDetails().size());
        var minimax =
                response.getModelDetails().stream()
                        .filter(m -> m.getId().equals("MiniMax-M2.7"))
                        .findFirst()
                        .orElseThrow();
        assertTrue(minimax.getCapabilities().contains("vision"));
        assertTrue(minimax.getCapabilities().contains("tools"));
        assertTrue(minimax.getCapabilities().contains("longContext"));
        assertEquals("registry", minimax.getSource());

        var gemini =
                response.getModelDetails().stream()
                        .filter(m -> m.getId().equals("gemini-3.1-pro"))
                        .findFirst()
                        .orElseThrow();
        assertTrue(gemini.getCapabilities().contains("vision"));
        assertTrue(gemini.getCapabilities().contains("audio"));
        assertTrue(gemini.getCapabilities().contains("video"));
        assertTrue(gemini.getCapabilities().contains("reasoning"));

        var omni =
                response.getModelDetails().stream()
                        .filter(m -> m.getId().equals("qwen3.5-omni"))
                        .findFirst()
                        .orElseThrow();
        assertTrue(omni.getCapabilities().contains("vision"));
        assertTrue(omni.getCapabilities().contains("audio"));
        assertTrue(omni.getCapabilities().contains("video"));
        assertTrue(omni.getCapabilities().contains("speech"));

        var realtime =
                response.getModelDetails().stream()
                        .filter(m -> m.getId().equals("gpt-realtime-2"))
                        .findFirst()
                        .orElseThrow();
        assertTrue(realtime.getCapabilities().contains("audio"));
        assertTrue(realtime.getCapabilities().contains("speech"));

        var embedding =
                response.getModelDetails().stream()
                        .filter(m -> m.getId().equals("text-embedding-3-large"))
                        .findFirst()
                        .orElseThrow();
        assertTrue(embedding.getCapabilities().contains("embedding"));

        var reranker =
                response.getModelDetails().stream()
                        .filter(m -> m.getId().equals("bge-reranker-v2-m3"))
                        .findFirst()
                        .orElseThrow();
        assertTrue(reranker.getCapabilities().contains("rerank"));

        var deepseek =
                response.getModelDetails().stream()
                        .filter(m -> m.getId().equals("deepseek-v4-flash"))
                        .findFirst()
                        .orElseThrow();
        assertFalse(deepseek.getCapabilities().contains("vision"));
        assertTrue(deepseek.getCapabilities().contains("tools"));
    }

    @Test
    void models_probeRefreshesAndCachesVisionCapabilityForOpaqueModels() {
        props.setAllowedModels(java.util.List.of("company-router"));
        when(llmService.chat(
                        anyString(),
                        any(),
                        any(),
                        eq("company-router"),
                        any(List.class),
                        any(),
                        any()))
                .thenReturn("ok");

        var first = controller.listModels(true);
        var second = controller.listModels(true);

        var detail = first.getModelDetails().get(0);
        assertEquals("company-router", detail.getId());
        assertTrue(detail.getCapabilities().contains("vision"));
        assertEquals("probe", detail.getSource());
        verify(llmService, times(1))
                .chat(
                        anyString(),
                        any(),
                        any(),
                        eq("company-router"),
                        any(List.class),
                        any(),
                        any());
        assertEquals("probe", second.getModelDetails().get(0).getSource());
    }

    @Test
    void models_probeDoesNotDowngradeRegistryVisionModelsWhenProbeWouldFail() {
        props.setProvider("minimax");
        props.setAllowedModels(java.util.List.of("MiniMax-M2.7"));

        var response = controller.listModels(true);

        var detail = response.getModelDetails().get(0);
        assertEquals("MiniMax-M2.7", detail.getId());
        assertTrue(detail.getCapabilities().contains("vision"));
        assertEquals("registry", detail.getSource());
        verify(llmService, never())
                .chat(anyString(), any(), any(), anyString(), any(List.class), any(), any());
    }
}
