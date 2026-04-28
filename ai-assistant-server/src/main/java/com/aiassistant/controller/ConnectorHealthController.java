package com.aiassistant.controller;

import com.aiassistant.config.ConnectorProperties;
import com.aiassistant.config.ProviderConnectivityChecker;
import com.aiassistant.connector.ConnectorFactory;
import com.aiassistant.connector.ConnectorToolRegistrar;
import com.aiassistant.connector.DataConnector;
import com.aiassistant.tool.ToolRegistry;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CopyOnWriteArrayList;

/**
 * Exposes health status for all registered DataConnectors and AI provider connectivity.
 */
@RestController
@RequestMapping("${ai-assistant.context-path:/ai-assistant}")
@io.swagger.v3.oas.annotations.tags.Tag(name = "Connector Health", description = "Data connector health probes")
public class ConnectorHealthController {

    private static final Logger log = LoggerFactory.getLogger(ConnectorHealthController.class);
    private final List<DataConnector> connectors;
    private final ToolRegistry toolRegistry;
    private final ProviderConnectivityChecker connectivityChecker;
    private final boolean managementEnabled;

    public ConnectorHealthController(List<DataConnector> connectors, ToolRegistry toolRegistry) {
        this(connectors, toolRegistry, null, false);
    }

    public ConnectorHealthController(List<DataConnector> connectors, ToolRegistry toolRegistry,
                                     ProviderConnectivityChecker connectivityChecker) {
        this(connectors, toolRegistry, connectivityChecker, false);
    }

    public ConnectorHealthController(List<DataConnector> connectors, ToolRegistry toolRegistry,
                                     ProviderConnectivityChecker connectivityChecker, boolean managementEnabled) {
        this.connectors = connectors != null ? new CopyOnWriteArrayList<>(connectors) : new CopyOnWriteArrayList<>();
        this.toolRegistry = toolRegistry;
        this.connectivityChecker = connectivityChecker;
        this.managementEnabled = managementEnabled;
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

    @GetMapping("/health/provider")
    public Map<String, Object> providerHealth() {
        if (connectivityChecker == null) {
            return Map.of("status", "UNKNOWN", "message", "Connectivity checker not available");
        }
        ProviderConnectivityChecker.ConnectivityResult result = connectivityChecker.getLastResult();
        if (result == null) {
            return Map.of("status", "PENDING", "message", "Connectivity check not yet completed");
        }
        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("status", result.success() ? "UP" : "DOWN");
        resp.put("provider", result.provider());
        if (result.success()) {
            resp.put("maskedKey", result.maskedKey());
            resp.put("latencyMs", result.latencyMs());
            resp.put("httpStatus", result.httpStatus());
        } else {
            resp.put("error", result.errorMessage());
        }
        return resp;
    }

    @PostMapping("/health/provider/recheck")
    public Map<String, Object> recheckProvider() {
        if (connectivityChecker == null) {
            return Map.of("status", "UNKNOWN", "message", "Connectivity checker not available");
        }
        connectivityChecker.check();
        return providerHealth();
    }

    @PostMapping("/connectors/register")
    public Map<String, Object> registerConnector(
            @org.springframework.web.bind.annotation.RequestBody ConnectorProperties config) {
        if (!managementEnabled) {
            return Map.of(
                    "success", false,
                    "errorCode", "CONNECTOR_MANAGEMENT_DISABLED",
                    "error", "Connector management is disabled"
            );
        }
        if (config == null) return Map.of("success", false, "error", "config is null");
        DataConnector connector = ConnectorFactory.create(config);
        if (connector == null) {
            return Map.of("success", false, "error",
                    "Failed to create connector from config (type=" + config.getType() + ")");
        }
        connectors.add(connector);
        if (toolRegistry != null) {
            ConnectorToolRegistrar.register(connector, toolRegistry);
        }
        log.info("Dynamically registered connector: {}", connector.id());
        return Map.of("success", true, "connectorId", connector.id());
    }

    @DeleteMapping("/connectors/{connectorId}")
    public Map<String, Object> unregisterConnector(@PathVariable String connectorId) {
        if (!managementEnabled) {
            return Map.of(
                    "success", false,
                    "errorCode", "CONNECTOR_MANAGEMENT_DISABLED",
                    "error", "Connector management is disabled"
            );
        }
        boolean removed = connectors.removeIf(c -> c.id().equals(connectorId));
        int toolsRemoved = 0;
        if (removed && toolRegistry != null) {
            String prefix = connectorId.replaceAll("[^a-zA-Z0-9_]", "_").toLowerCase() + "_";
            toolsRemoved = toolRegistry.unregisterByPrefix(prefix);
        }
        log.info("Unregistered connector: {} (found={}, toolsRemoved={})", connectorId, removed, toolsRemoved);
        return Map.of("success", removed, "connectorId", connectorId, "toolsRemoved", toolsRemoved);
    }
}
