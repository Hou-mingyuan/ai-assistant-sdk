package com.aiassistant.controller;

import com.aiassistant.connector.DataConnector;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.*;

/**
 * Exposes health status for all registered DataConnectors.
 * Each connector is probed by calling {@code listModules()}; if it returns
 * without error the connector is reported as UP.
 */
@RestController
@RequestMapping("${ai-assistant.context-path:/ai-assistant}")
@io.swagger.v3.oas.annotations.tags.Tag(name = "Connector Health", description = "Data connector health probes")
public class ConnectorHealthController {

    private static final Logger log = LoggerFactory.getLogger(ConnectorHealthController.class);
    private final List<DataConnector> connectors;

    public ConnectorHealthController(List<DataConnector> connectors) {
        this.connectors = connectors != null ? connectors : List.of();
    }

    @GetMapping("/health/connectors")
    public Map<String, Object> connectorHealth() {
        List<Map<String, Object>> statuses = new ArrayList<>();
        boolean allUp = true;

        for (DataConnector connector : connectors) {
            Map<String, Object> entry = new LinkedHashMap<>();
            entry.put("id", connector.id());
            entry.put("displayName", connector.displayName());
            long start = System.currentTimeMillis();
            try {
                int moduleCount = connector.listModules().size();
                entry.put("status", "UP");
                entry.put("modules", moduleCount);
                entry.put("latencyMs", System.currentTimeMillis() - start);
            } catch (Exception e) {
                entry.put("status", "DOWN");
                entry.put("error", e.getMessage());
                entry.put("latencyMs", System.currentTimeMillis() - start);
                allUp = false;
                log.warn("Connector health check failed for {}: {}", connector.id(), e.getMessage());
            }
            statuses.add(entry);
        }

        return Map.of(
                "status", allUp ? "UP" : "DEGRADED",
                "connectors", statuses
        );
    }
}
