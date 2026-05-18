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
        when(llmService.chat(
                        anyString(), any(), any(), any(), any(List.class), any(), any()))
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
    void chat_translate_delegatesToTranslate() {
        when(llmService.translate(anyString(), anyString())).thenReturn("你好");
        ChatRequest req = new ChatRequest();
        req.setText("hello");
        req.setAction("translate");
        req.setTargetLang("zh");

        var response = controller.chat(req);
        assertEquals(200, response.getStatusCode().value());
        assertEquals("你好", response.getBody().getResult());
        verify(llmService).translate("hello", "zh");
    }

    @Test
    void chat_summarize_delegatesToSummarize() {
        when(llmService.summarize(anyString())).thenReturn("Summary here");
        ChatRequest req = new ChatRequest();
        req.setText("long text...");
        req.setAction("summarize");

        var response = controller.chat(req);
        assertEquals(200, response.getStatusCode().value());
        assertEquals("Summary here", response.getBody().getResult());
    }

    @Test
    void chat_returns503_whenLlmThrows() {
        /* K26 + K53: match the 7-arg List<String> overload (see comment above). */
        when(llmService.chat(
                        anyString(), any(), any(), any(), any(List.class), any(), any()))
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
        when(llmService.chatStream(
                        anyString(), any(), any(), any(), any(List.class), any(), any()))
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
    void health_returnsRunning() {
        var result = controller.health(false);
        assertEquals(true, result.get("success"));
        assertEquals("running", result.get("status"));
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
                .chat(anyString(), any(), any(), eq("company-router"), any(List.class), any(), any());
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
