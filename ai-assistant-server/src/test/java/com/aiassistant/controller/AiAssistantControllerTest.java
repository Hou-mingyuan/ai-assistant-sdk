package com.aiassistant.controller;

import com.aiassistant.config.AiAssistantProperties;
import com.aiassistant.model.ChatRequest;
import com.aiassistant.service.LlmService;
import com.aiassistant.service.UrlFetchService;
import com.aiassistant.stats.UsageStats;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import reactor.core.publisher.Flux;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

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
        controller = new AiAssistantController(llmService, usageStats, urlFetchService, props);
    }

    @Test
    void chat_returnsOk_whenLlmSucceeds() {
        when(llmService.chat(anyString(), any(), any(), any(), any())).thenReturn("Hello!");
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
        when(llmService.chat(anyString(), any(), any(), any(), any()))
                .thenThrow(new RuntimeException("API down"));
        ChatRequest req = new ChatRequest();
        req.setText("hi");

        var response = controller.chat(req);
        assertEquals(503, response.getStatusCode().value());
        assertFalse(response.getBody().isSuccess());
    }

    @Test
    void stream_returnsFlux_forChat() {
        when(llmService.chatStream(anyString(), any(), any(), any(), any()))
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
}
