package com.aiassistant.controller;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.aiassistant.config.AiAssistantProperties;
import com.aiassistant.model.ChatRequest;
import com.aiassistant.service.LlmService;
import com.aiassistant.stats.UsageStats;
import java.util.List;
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
    void sse_chatEmitsTypedMessageAndDoneEvents() {
        when(llmService.chatStream(anyString(), any(), any(), any(), any(List.class), any(), any()))
                .thenReturn(Flux.just("hello", " world"));
        ChatRequest req = new ChatRequest();
        req.setText("hello");
        req.setAction("chat");

        var response = controller.sse(req);
        var events = response.getBody().collectList().block();

        assertEquals(200, response.getStatusCode().value());
        assertEquals("no", response.getHeaders().getFirst("X-Accel-Buffering"));
        assertEquals("no-cache", response.getHeaders().getFirst("Cache-Control"));
        assertNotNull(events);
        assertEquals(3, events.size());
        assertEquals("message", events.get(0).event());
        assertEquals("hello", events.get(0).data());
        assertEquals("1", events.get(0).id());
        assertEquals("message", events.get(1).event());
        assertEquals(" world", events.get(1).data());
        assertEquals("2", events.get(1).id());
        assertEquals("done", events.get(2).event());
        assertEquals("[DONE]", events.get(2).data());
    }

    @Test
    void sse_validationErrorEmitsTypedErrorEvent() {
        AiAssistantProperties limited = new AiAssistantProperties();
        limited.setChatMaxTotalChars(3);
        controller = new SseStreamController(llmService, new UsageStats(), limited);
        ChatRequest req = new ChatRequest();
        req.setText("too long");

        var response = controller.sse(req);
        var events = response.getBody().collectList().block();

        assertEquals(400, response.getStatusCode().value());
        assertNotNull(events);
        assertEquals(1, events.size());
        assertEquals("error", events.get(0).event());
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
