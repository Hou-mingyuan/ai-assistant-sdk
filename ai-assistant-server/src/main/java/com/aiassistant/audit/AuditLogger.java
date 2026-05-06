package com.aiassistant.audit;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CopyOnWriteArrayList;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Structured audit logger. Logs audit events as JSON to a dedicated logger category. Also keeps a
 * rolling in-memory buffer for dashboard/admin queries.
 */
public class AuditLogger {

    private static final Logger auditLog = LoggerFactory.getLogger("com.aiassistant.AUDIT");
    private static final int MAX_BUFFER_SIZE = 1000;

    private final ObjectMapper mapper;
    private final CopyOnWriteArrayList<AuditEvent> buffer = new CopyOnWriteArrayList<>();

    public AuditLogger() {
        this.mapper = new ObjectMapper();
        this.mapper.registerModule(new JavaTimeModule());
    }

    public void log(AuditEvent event) {
        try {
            String json = mapper.writeValueAsString(event);
            auditLog.info(json);
        } catch (Exception e) {
            auditLog.warn("Failed to serialize audit event: {}", e.getMessage());
        }

        buffer.add(event);
        while (buffer.size() > MAX_BUFFER_SIZE) {
            buffer.remove(0);
        }
    }

    public void log(
            String action,
            String userId,
            String sessionId,
            String tenantId,
            String sourceIp,
            Map<String, Object> details,
            long durationMs,
            boolean success) {
        Map<String, String> meta = new java.util.LinkedHashMap<>();
        if (sessionId != null) meta.put("sessionId", sessionId);
        if (sourceIp != null) meta.put("sourceIp", sourceIp);
        if (details != null) {
            details.forEach((k, v) -> meta.put(k, v != null ? v.toString() : ""));
        }
        log(AuditEvent.builder()
                .tenantId(tenantId != null ? tenantId : "default")
                .userId(userId)
                .action(action)
                .latencyMs(durationMs)
                .outcome(success ? AuditEvent.Outcome.SUCCESS : AuditEvent.Outcome.ERROR)
                .metadata(meta)
                .build());
    }

    public List<AuditEvent> getRecentEvents(int limit) {
        int size = buffer.size();
        int from = Math.max(0, size - limit);
        return List.copyOf(buffer.subList(from, size));
    }

    public List<AuditEvent> getEventsByUser(String userId, int limit) {
        return buffer.stream()
                .filter(e -> userId.equals(e.userId()))
                .sorted((a, b) -> b.timestamp().compareTo(a.timestamp()))
                .limit(limit)
                .toList();
    }
}
