package com.aiassistant.event;

import java.util.Map;
import org.springframework.context.ApplicationEvent;

/**
 * Base event for all AI assistant lifecycle events. Subscribe with {@code @EventListener} or
 * implement {@link org.springframework.context.ApplicationListener}.
 */
public class AiAssistantEvent extends ApplicationEvent {

    private final EventType type;
    private final String operation;
    private final String tenantId;
    private final String modelId;
    private final String sessionId;
    private final long durationMs;
    private final Map<String, Object> metadata;

    public AiAssistantEvent(
            Object source,
            EventType type,
            String operation,
            String tenantId,
            String modelId,
            String sessionId,
            long durationMs,
            Map<String, Object> metadata) {
        super(source);
        this.type = type;
        this.operation = operation;
        this.tenantId = tenantId;
        this.modelId = modelId;
        this.sessionId = sessionId;
        this.durationMs = durationMs;
        this.metadata = metadata != null ? Map.copyOf(metadata) : Map.of();
    }

    public enum EventType {
        CHAT_STARTED,
        CHAT_COMPLETED,
        CHAT_FAILED,
        TRANSLATE_COMPLETED,
        SUMMARIZE_COMPLETED,
        TOOL_CALLED,
        MODEL_FALLBACK,
        QUOTA_EXCEEDED,
        CAPABILITY_INVOKED
    }

    public EventType getType() {
        return type;
    }

    public String getOperation() {
        return operation;
    }

    public String getTenantId() {
        return tenantId;
    }

    public String getModelId() {
        return modelId;
    }

    public String getSessionId() {
        return sessionId;
    }

    public long getDurationMs() {
        return durationMs;
    }

    public Map<String, Object> getMetadata() {
        return metadata;
    }
}
