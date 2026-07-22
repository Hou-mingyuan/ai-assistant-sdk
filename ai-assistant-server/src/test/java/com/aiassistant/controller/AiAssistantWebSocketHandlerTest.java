package com.aiassistant.controller;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.aiassistant.config.AiAssistantProperties;
import com.aiassistant.service.LlmService;
import com.aiassistant.stats.UsageStats;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketMessage;
import org.springframework.web.socket.WebSocketSession;
import reactor.core.publisher.Flux;

class AiAssistantWebSocketHandlerTest {

    private LlmService llmService;
    private AiAssistantWebSocketHandler handler;
    private WebSocketSession session;
    private List<String> sentPayloads;

    @BeforeEach
    void setUp() throws Exception {
        llmService = mock(LlmService.class);
        handler =
                new AiAssistantWebSocketHandler(
                        llmService, new UsageStats(), new AiAssistantProperties());
        session = mock(WebSocketSession.class);
        sentPayloads = new ArrayList<>();
        when(session.getAttributes()).thenReturn(new HashMap<>());
        when(session.isOpen()).thenReturn(true);
        when(session.getId()).thenReturn("test-session");
        doAnswer(
                        invocation -> {
                            WebSocketMessage<?> message = invocation.getArgument(0);
                            if (message instanceof TextMessage textMessage) {
                                sentPayloads.add(textMessage.getPayload());
                            }
                            return null;
                        })
                .when(session)
                .sendMessage(any());
    }

    @Test
    void rejectsInvalidJson() throws Exception {
        handler.handleMessage(session, new TextMessage("{"));

        assertEquals(List.of("{\"error\":\"invalid JSON\"}"), sentPayloads);
        verifyNoInteractions(llmService);
    }

    @Test
    void rejectsUnknownActionInsteadOfSilentlyChatting() throws Exception {
        handler.handleMessage(
                session, new TextMessage("{\"action\":\"delete\",\"text\":\"hello\"}"));

        assertEquals(1, sentPayloads.size());
        assertTrue(sentPayloads.get(0).contains("INVALID_REQUEST"));
        assertTrue(sentPayloads.get(0).contains("action must be one of"));
        verifyNoInteractions(llmService);
    }

    @Test
    void reportsInvalidTranslationLanguage() throws Exception {
        when(llmService.translateStream("hello", "bad target"))
                .thenThrow(new IllegalArgumentException("targetLang must be a valid language tag"));

        handler.handleMessage(
                session,
                new TextMessage(
                        "{\"action\":\"translate\",\"text\":\"hello\",\"targetLang\":\"bad target\"}"));

        assertEquals(1, sentPayloads.size());
        assertTrue(sentPayloads.get(0).contains("INVALID_REQUEST"));
        assertTrue(sentPayloads.get(0).contains("targetLang"));
    }

    @Test
    void streamsChunksAndDoneMarker() throws Exception {
        when(llmService.chatStream("hello", null, null, null, List.of(), null, null))
                .thenReturn(Flux.just("hello", " world"));

        handler.handleMessage(session, new TextMessage("{\"action\":\"chat\",\"text\":\"hello\"}"));

        assertEquals(List.of("hello", " world", "[DONE]"), sentPayloads);
    }
}
