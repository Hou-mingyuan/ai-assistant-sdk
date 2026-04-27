package com.aiassistant.connector;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.*;

/**
 * Periodically probes all registered {@link DataConnector} instances
 * and maintains an availability set. Unhealthy connectors are temporarily
 * excluded from tool registration until they recover.
 */
public class ConnectorHealthScheduler {

    private static final Logger log = LoggerFactory.getLogger(ConnectorHealthScheduler.class);

    private final List<DataConnector> connectors;
    private final Set<String> unhealthyIds = ConcurrentHashMap.newKeySet();
    private final ScheduledExecutorService scheduler;
    private final long intervalMs;

    public ConnectorHealthScheduler(List<DataConnector> connectors, long intervalMs) {
        this.connectors = connectors != null ? connectors : List.of();
        this.intervalMs = Math.max(30_000, intervalMs);
        this.scheduler = Executors.newSingleThreadScheduledExecutor(r -> {
            Thread t = new Thread(r, "connector-health");
            t.setDaemon(true);
            return t;
        });
    }

    public void start() {
        scheduler.scheduleAtFixedRate(this::probe, intervalMs, intervalMs, TimeUnit.MILLISECONDS);
        log.info("ConnectorHealthScheduler started: interval={}ms, connectors={}", intervalMs, connectors.size());
    }

    public void stop() {
        scheduler.shutdownNow();
    }

    private void probe() {
        for (DataConnector c : connectors) {
            try {
                c.listModules();
                if (unhealthyIds.remove(c.id())) {
                    log.info("Connector [{}] recovered → healthy", c.id());
                }
            } catch (Exception e) {
                if (unhealthyIds.add(c.id())) {
                    log.warn("Connector [{}] marked unhealthy: {}", c.id(), e.getMessage());
                }
            }
        }
    }

    public boolean isHealthy(String connectorId) {
        return !unhealthyIds.contains(connectorId);
    }

    public Set<String> getUnhealthyIds() {
        return Set.copyOf(unhealthyIds);
    }
}
