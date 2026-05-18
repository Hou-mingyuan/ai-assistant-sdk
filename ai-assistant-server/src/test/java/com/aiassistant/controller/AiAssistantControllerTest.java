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
                java.util.List.of("MiniMax-M2.7", "gpt-4o-mini", "deepseek-v4-flash"));

        var response = controller.listModels();

        assertEquals(3, response.getModelDetails().size());
        var minimax =
                response.getModelDetails().stream()
                        .filter(m -> m.getId().equals("MiniMax-M2.7"))
                        .findFirst()
                        .orElseThrow();
        assertTrue(minimax.getCapabilities().contains("vision"));
        assertTrue(minimax.getCapabilities().contains("tools"));
        assertTrue(minimax.getCapabilities().contains("longContext"));
        assertEquals("registry", minimax.getSource());

        var deepseek =
                response.getModelDetails().stream()
                        .filter(m -> m.getId().equals("deepseek-v4-flash"))
                        .findFirst()
                        .orElseThrow();
        assertFalse(deepseek.getCapabilities().contains("vision"));
        assertTrue(deepseek.getCapabilities().contains("tools"));
    }
}
