package com.aiassistant.controller;

import com.aiassistant.config.AiAssistantProperties;
import com.aiassistant.model.ChatRequest;
import com.aiassistant.service.LlmService;
import com.aiassistant.stats.UsageStats;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.ConcurrentWebSocketSessionDecorator;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import reactor.core.Disposable;

import java.io.IOException;
import java.nio.ByteBuffer;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;

/**
 * Optional WebSocket endpoint for streaming chat (alternative to SSE).
 * <p>Client sends JSON matching {@link ChatRequest}; server streams delta chunks as individual text frames,
 * then sends {@code [DONE]} and closes normally.</p>
 */
public class AiAssistantWebSocketHandler extends TextWebSocketHandler {

    private static final Logger log = LoggerFactory.getLogger(AiAssistantWebSocketHandler.class);
    private static final int WS_MAX_TEXT_CHARS = 300_000;
    private static final String SAFE_SESSION_KEY = "safeSendSession";
    private static final long HEARTBEAT_INTERVAL_MS = 30_000;
    private static final String HEARTBEAT_KEY = "heartbeatFuture";
    private final LlmService llmService;
    private final UsageStats usageStats;
    private final AiAssistantProperties properties;
    private final ObjectMapper mapper = new ObjectMapper();
    private final ScheduledExecutorService heartbeatScheduler =
            Executors.newSingleThreadScheduledExecutor(r -> {
                Thread t = new Thread(r, "ws-heartbeat");
                t.setDaemon(true);
                return t;
            });

    public AiAssistantWebSocketHandler(LlmService llmService, UsageStats usageStats,
                                       AiAssistantProperties properties) {
        this.llmService = llmService;
        this.usageStats = usageStats;
        this.properties = properties;
    }

    private WebSocketSession safeSend(WebSocketSession session) {
        Object cached = session.getAttributes().get(SAFE_SESSION_KEY);
        if (cached instanceof ConcurrentWebSocketSessionDecorator d) return d;
        var safe = new ConcurrentWebSocketSessionDecorator(session, 5_000, 512 * 1024);
        session.getAttributes().put(SAFE_SESSION_KEY, safe);
        return safe;
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        ScheduledFuture<?> hb = heartbeatScheduler.scheduleAtFixedRate(() -> {
            try {
                if (session.isOpen()) {
                    session.sendMessage(new org.springframework.web.socket.PingMessage(
                            ByteBuffer.wrap("hb".getBytes())));
                }
            } catch (IOException e) {
                log.debug("Heartbeat ping failed for session {}: {}", session.getId(), e.getMessage());
            }
        }, HEARTBEAT_INTERVAL_MS, HEARTBEAT_INTERVAL_MS, TimeUnit.MILLISECONDS);
        session.getAttributes().put(HEARTBEAT_KEY, hb);
        log.debug("ws connected: {}, heartbeat started", session.getId());
    }

    @Override
    protected void handleTextMessage(WebSocketSession rawSession, TextMessage message) throws Exception {
        WebSocketSession session = safeSend(rawSession);
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
        String systemPrompt = json.has("systemPrompt") ? json.get("systemPrompt").asText(null) : null;
        String model = json.has("model") ? json.get("model").asText(null) : null;

        if (text.isBlank()) {
            session.sendMessage(new TextMessage("{\"error\":\"text is required\"}"));
            return;
        }
        int maxChars = properties.getChatMaxTotalChars() > 0 ? properties.getChatMaxTotalChars() : WS_MAX_TEXT_CHARS;
        if (text.length() > maxChars) {
            session.sendMessage(new TextMessage("{\"error\":\"text exceeds " + maxChars + " characters\"}"));
            return;
        }

        List<ChatRequest.MessageItem> history = null;
        JsonNode historyNode = json.get("history");
        if (historyNode != null && historyNode.isArray()) {
            if (historyNode.size() > 500) {
                session.sendMessage(new TextMessage("{\"error\":\"history exceeds 500 messages\"}"));
                return;
            }
            history = new ArrayList<>();
            for (JsonNode h : historyNode) {
                ChatRequest.MessageItem item = new ChatRequest.MessageItem();
                item.setRole(h.has("role") ? h.get("role").asText("") : "");
                item.setContent(h.has("content") ? h.get("content").asText("") : "");
                history.add(item);
            }
        }

        usageStats.recordCall("ws_" + action);

        try {
            Object prev = session.getAttributes().get("streamDisposable");
            if (prev instanceof Disposable d && !d.isDisposed()) {
                d.dispose();
            }
            List<ChatRequest.MessageItem> hist = history;
            var flux = switch (action) {
                case "translate" -> {
                    String lang = json.has("targetLang") ? json.get("targetLang").asText("zh") : "zh";
                    yield llmService.translateStream(text, lang);
                }
                case "summarize" -> llmService.summarizeStream(text);
                default -> llmService.chatStream(text, hist, systemPrompt, model, imageData);
            };

            Disposable disposable = flux.doOnNext(chunk -> {
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
                usageStats.recordError();
                log.warn("ws stream error", e);
                try {
                    if (session.isOpen()) {
                        String errJson = mapper.writeValueAsString(Map.of("error",
                                "AI service encountered an error. Please try again."));
                        session.sendMessage(new TextMessage(errJson));
                    }
                } catch (Exception ex) {
                    log.debug("ws error send failed: {}", ex.getMessage());
                }
            }).subscribe();
            session.getAttributes().put("streamDisposable", disposable);
        } catch (Exception e) {
            usageStats.recordError();
            log.warn("ws handler error", e);
            if (session.isOpen()) {
                String errJson = mapper.writeValueAsString(Map.of("error",
                        "AI service encountered an error. Please try again."));
                session.sendMessage(new TextMessage(errJson));
            }
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        Object hb = session.getAttributes().get(HEARTBEAT_KEY);
        if (hb instanceof ScheduledFuture<?> future) {
            future.cancel(false);
        }
        Object d = session.getAttributes().get("streamDisposable");
        if (d instanceof Disposable disposable && !disposable.isDisposed()) {
            disposable.dispose();
        }
        log.debug("ws closed: {} {}", session.getId(), status);
    }
}
