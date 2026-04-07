package com.aiassistant.controller;

import com.aiassistant.service.LlmService;
import com.aiassistant.stats.UsageStats;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

/**
 * Optional WebSocket endpoint for streaming chat (alternative to SSE).
 * <p>Client sends JSON matching {@link ChatRequest}; server streams delta chunks as individual text frames,
 * then sends {@code [DONE]} and closes normally.</p>
 */
public class AiAssistantWebSocketHandler extends TextWebSocketHandler {

    private static final Logger log = LoggerFactory.getLogger(AiAssistantWebSocketHandler.class);
    private final LlmService llmService;
    private final UsageStats usageStats;
    private final ObjectMapper mapper = new ObjectMapper();

    public AiAssistantWebSocketHandler(LlmService llmService, UsageStats usageStats) {
        this.llmService = llmService;
        this.usageStats = usageStats;
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        JsonNode json;
        try {
            json = mapper.readTree(message.getPayload());
        } catch (Exception e) {
            session.sendMessage(new TextMessage("{\"error\":\"invalid JSON\"}"));
            return;
        }

        String action = json.has("action") ? json.get("action").asText("chat") : "chat";
        String text = json.has("text") ? json.get("text").asText("") : "";
        String imageData = json.has("imageData") ? json.get("imageData").asText(null) : null;

        if (text.isBlank()) {
            session.sendMessage(new TextMessage("{\"error\":\"text is required\"}"));
            return;
        }

        usageStats.recordCall("ws_" + action);

        try {
            var flux = switch (action) {
                case "translate" -> {
                    String lang = json.has("targetLang") ? json.get("targetLang").asText("zh") : "zh";
                    yield llmService.translateStream(text, lang);
                }
                case "summarize" -> llmService.summarizeStream(text);
                default -> llmService.chatStream(text, null, null, null, imageData);
            };

            flux.doOnNext(chunk -> {
                try {
                    if (session.isOpen()) {
                        session.sendMessage(new TextMessage(chunk));
                    }
                } catch (Exception e) {
                    log.debug("ws send failed: {}", e.getMessage());
                }
            }).doOnComplete(() -> {
                try {
                    if (session.isOpen()) {
                        session.sendMessage(new TextMessage("[DONE]"));
                    }
                } catch (Exception e) {
                    log.debug("ws done send failed: {}", e.getMessage());
                }
            }).doOnError(e -> {
                log.warn("ws stream error", e);
                try {
                    if (session.isOpen()) {
                        String escaped = (e.getMessage() != null ? e.getMessage() : "unknown error")
                                .replace("\\", "\\\\").replace("\"", "\\\"");
                        session.sendMessage(new TextMessage("{\"error\":\"" + escaped + "\"}"));
                    }
                } catch (Exception ex) {
                    log.debug("ws error send failed: {}", ex.getMessage());
                }
            }).subscribe();
        } catch (Exception e) {
            usageStats.recordError();
            log.warn("ws handler error", e);
            if (session.isOpen()) {
                String escaped = (e.getMessage() != null ? e.getMessage() : "unknown error")
                        .replace("\\", "\\\\").replace("\"", "\\\"");
                session.sendMessage(new TextMessage("{\"error\":\"" + escaped + "\"}"));
            }
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        log.debug("ws closed: {} {}", session.getId(), status);
    }
}
