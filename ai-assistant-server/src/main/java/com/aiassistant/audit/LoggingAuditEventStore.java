package com.aiassistant.audit;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ConcurrentLinkedDeque;
import java.util.concurrent.atomic.AtomicInteger;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Default {@link AuditEventStore}: structured SLF4J logging + bounded in-memory ring buffer
 * for recent query support via admin API.
 */
public class LoggingAuditEventStore implements AuditEventStore {

    private static final Logger log = LoggerFactory.getLogger(LoggingAuditEventStore.class);
    private static final int MAX_RING_SIZE = 2000;
    private final ConcurrentLinkedDeque<AuditEvent> ring = new ConcurrentLinkedDeque<>();
    private final AtomicInteger ringSize = new AtomicInteger(0);

    @Override
    public void record(AuditEvent event) {
        log.info("audit.event id={} tenant={} action={} model={} tokens={}/{} latency={}ms outcome={}",
                event.id(), event.tenantId(), event.action(), event.modelId(),
                event.promptTokens(), event.completionTokens(),
                event.latencyMs(), event.outcome());
        ring.addLast(event);
        if (ringSize.incrementAndGet() > MAX_RING_SIZE) {
            if (ring.pollFirst() != null) {
                ringSize.decrementAndGet();
            }
        }
    }

    @Override
    public List<AuditEvent> query(String tenantId, Instant from, Instant to, int limit) {
        List<AuditEvent> result = new ArrayList<>();
        for (AuditEvent e : ring) {
            if (tenantId != null && !tenantId.equals(e.tenantId())) continue;
            if (from != null && e.timestamp().isBefore(from)) continue;
            if (to != null && e.timestamp().isAfter(to)) continue;
            result.add(e);
            if (result.size() >= limit) break;
        }
        return result;
    }

    @Override
    public long count(String tenantId, Instant from, Instant to) {
        return ring.stream()
                .filter(e -> tenantId == null || tenantId.equals(e.tenantId()))
                .filter(e -> from == null || !e.timestamp().isBefore(from))
                .filter(e -> to == null || !e.timestamp().isAfter(to))
                .count();
    }
}
