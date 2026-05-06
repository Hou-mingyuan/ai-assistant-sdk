package com.aiassistant.audit;

import java.time.Instant;
import java.util.List;

/**
 * SPI for persisting audit events. Default implementation logs to SLF4J;
 * replace with JDBC / Kafka / Elasticsearch for production use.
 */
public interface AuditEventStore {

    void record(AuditEvent event);

    default List<AuditEvent> query(String tenantId, Instant from, Instant to, int limit) {
        return List.of();
    }

    default long count(String tenantId, Instant from, Instant to) {
        return 0;
    }
}
