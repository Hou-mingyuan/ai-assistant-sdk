package com.aiassistant.event;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.ApplicationEventPublisher;

import java.util.Map;

/**
 * Facade for publishing AI assistant events.
 * Wraps {@link ApplicationEventPublisher} with convenience methods for each event type.
 */
public class AiAssistantEventPublisher {

    private static final Logger log = LoggerFactory.getLogger(AiAssistantEventPublisher.class);
    private final ApplicationEventPublisher publisher;

    public AiAssistantEventPublisher(ApplicationEventPublisher publisher) {
        this.publisher = publisher;
    }

    public void chatCompleted(String tenantId, String modelId, String sessionId,
                               long durationMs, Map<String, Object> metadata) {
        publish(AiAssistantEvent.EventType.CHAT_COMPLETED, "chat", tenantId, modelId, sessionId, durationMs, metadata);
    }

    public void chatFailed(String tenantId, String modelId, String sessionId,
                            long durationMs, String error) {
        publish(AiAssistantEvent.EventType.CHAT_FAILED, "chat", tenantId, modelId, sessionId, durationMs,
                Map.of("error", error != null ? error : "unknown"));
    }

    public void translateCompleted(String tenantId, String modelId, long durationMs) {
        publish(AiAssistantEvent.EventType.TRANSLATE_COMPLETED, "translate", tenantId, modelId, null, durationMs, null);
    }

    public void summarizeCompleted(String tenantId, String modelId, long durationMs) {
        publish(AiAssistantEvent.EventType.SUMMARIZE_COMPLETED, "summarize", tenantId, modelId, null, durationMs, null);
    }

    public void modelFallback(String failedModel, String fallbackModel, String reason) {
        publish(AiAssistantEvent.EventType.MODEL_FALLBACK, "fallback", null, fallbackModel, null, 0,
                Map.of("failedModel", failedModel, "reason", reason != null ? reason : ""));
    }

    public void toolCalled(String toolName, long durationMs, boolean success) {
        publish(AiAssistantEvent.EventType.TOOL_CALLED, "tool", null, null, null, durationMs,
                Map.of("toolName", toolName, "success", success));
    }

    public void capabilityInvoked(String capabilityName, long durationMs, boolean success) {
        publish(AiAssistantEvent.EventType.CAPABILITY_INVOKED, "capability", null, null, null, durationMs,
                Map.of("capabilityName", capabilityName, "success", success));
    }

    private void publish(AiAssistantEvent.EventType type, String operation,
                          String tenantId, String modelId, String sessionId,
                          long durationMs, Map<String, Object> metadata) {
        try {
            publisher.publishEvent(new AiAssistantEvent(
                    this, type, operation, tenantId, modelId, sessionId, durationMs, metadata));
        } catch (Exception e) {
            log.debug("Event publish failed for {}: {}", type, e.getMessage());
        }
    }
}
