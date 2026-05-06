package com.aiassistant.audit;

import java.time.Instant;
import java.util.Map;

/**
 * Immutable audit event capturing who did what and when in the AI assistant.
 * Emitted by core services; consumed by {@link AuditEventStore} implementations.
 */
public record AuditEvent(
        String id,
        Instant timestamp,
        String tenantId,
        String userId,
        String action,
        String modelId,
        int promptTokens,
        int completionTokens,
        long latencyMs,
        String outcome,
        Map<String, String> metadata) {

    public enum Outcome {
        SUCCESS,
        ERROR,
        QUOTA_EXCEEDED,
        FILTERED
    }

    public static Builder builder() {
        return new Builder();
    }

    public static final class Builder {
        private String tenantId = "default";
        private String userId;
        private String action;
        private String modelId;
        private int promptTokens;
        private int completionTokens;
        private long latencyMs;
        private String outcome = Outcome.SUCCESS.name();
        private Map<String, String> metadata = Map.of();

        public Builder tenantId(String v) { this.tenantId = v; return this; }
        public Builder userId(String v) { this.userId = v; return this; }
        public Builder action(String v) { this.action = v; return this; }
        public Builder modelId(String v) { this.modelId = v; return this; }
        public Builder promptTokens(int v) { this.promptTokens = v; return this; }
        public Builder completionTokens(int v) { this.completionTokens = v; return this; }
        public Builder latencyMs(long v) { this.latencyMs = v; return this; }
        public Builder outcome(String v) { this.outcome = v; return this; }
        public Builder outcome(Outcome v) { this.outcome = v.name(); return this; }
        public Builder metadata(Map<String, String> v) { this.metadata = v; return this; }

        public AuditEvent build() {
            String id = java.util.UUID.randomUUID().toString().replace("-", "").substring(0, 16);
            return new AuditEvent(
                    id, Instant.now(), tenantId, userId, action, modelId,
                    promptTokens, completionTokens, latencyMs, outcome, metadata);
        }
    }
}
