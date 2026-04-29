package com.aiassistant.audit;

import java.time.Instant;
import java.util.Map;

/** Immutable audit event record for tracking who did what and when. */
public record AuditEvent(
        String eventId,
        Instant timestamp,
        String action,
        String userId,
        String sessionId,
        String tenantId,
        String sourceIp,
        Map<String, Object> details,
        long durationMs,
        boolean success) {
    public AuditEvent(
            String action,
            String userId,
            String sessionId,
            String tenantId,
            String sourceIp,
            Map<String, Object> details,
            long durationMs,
            boolean success) {
        this(
                java.util.UUID.randomUUID().toString(),
                Instant.now(),
                action,
                userId,
                sessionId,
                tenantId,
                sourceIp,
                details,
                durationMs,
                success);
    }
}
