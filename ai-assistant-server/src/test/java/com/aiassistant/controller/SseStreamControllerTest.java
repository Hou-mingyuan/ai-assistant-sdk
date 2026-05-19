package com.aiassistant.controller;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.aiassistant.config.AiAssistantProperties;
import com.aiassistant.model.ChatRequest;
import com.aiassistant.service.LlmService;
import com.aiassistant.stats.UsageStats;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import reactor.core.publisher.Flux;

class SseStreamControllerTest {

    private SseStreamController controller;
    private LlmService llmService;

    @BeforeEach
    void setUp() {
        llmService = mock(LlmService.class);
        controller =
                new SseStreamController(llmService, new UsageStats(), new AiAssistantProperties());
    }

    @Test
    void sse_translatePassesRequestedModel() {
        when(llmService.translateStream("hello", "zh")).thenReturn(Flux.just("你好"));
        when(llmService.translateStream("hello", "zh", "MiniMax-M2.7")).thenReturn(Flux.just("你好"));
        ChatRequest req = new ChatRequest();
        req.setText("hello");
        req.setAction("translate");
        req.setTargetLang("zh");
        req.setModel("MiniMax-M2.7");

        var response = controller.sse(req);

        assertEquals(200, response.getStatusCode().value());
        verify(llmService).translateStream("hello", "zh", "MiniMax-M2.7");
    }

    @Test
    void sse_summarizePassesRequestedModel() {
        when(llmService.summarizeStream("long text")).thenReturn(Flux.just("summary"));
        when(llmService.summarizeStream("long text", "MiniMax-M2.7"))
                .thenReturn(Flux.just("summary"));
        ChatRequest req = new ChatRequest();
        req.setText("long text");
        req.setAction("summarize");
        req.setModel("MiniMax-M2.7");

        var response = controller.sse(req);

        assertEquals(200, response.getStatusCode().value());
        verify(llmService).summarizeStream("long text", "MiniMax-M2.7");
    }
}
