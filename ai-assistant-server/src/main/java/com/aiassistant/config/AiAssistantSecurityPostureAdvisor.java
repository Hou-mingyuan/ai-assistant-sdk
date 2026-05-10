package com.aiassistant.config;

import java.util.ArrayList;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Evaluates security-sensitive configuration combinations and reports actionable startup warnings.
 */
public class AiAssistantSecurityPostureAdvisor {

    public static final String ADMIN_WITHOUT_ACCESS_TOKEN = "ADMIN_WITHOUT_ACCESS_TOKEN";
    public static final String CONNECTOR_MANAGEMENT_WITHOUT_ACCESS_TOKEN =
            "CONNECTOR_MANAGEMENT_WITHOUT_ACCESS_TOKEN";
    public static final String MCP_SERVER_WITHOUT_ACCESS_TOKEN = "MCP_SERVER_WITHOUT_ACCESS_TOKEN";
    public static final String QUERY_TOKEN_AUTH_ENABLED = "QUERY_TOKEN_AUTH_ENABLED";
    public static final String PUBLIC_BROWSER_ACCESS_WITHOUT_TOKEN =
            "PUBLIC_BROWSER_ACCESS_WITHOUT_TOKEN";
    public static final String MULTI_REPLICA_INPROCESS_RATE_LIMIT =
            "MULTI_REPLICA_INPROCESS_RATE_LIMIT";

    private static final Logger log =
            LoggerFactory.getLogger(AiAssistantSecurityPostureAdvisor.class);

    private final AiAssistantProperties properties;
    private final MultiReplicaEnvironmentProbe environmentProbe;

    public AiAssistantSecurityPostureAdvisor(AiAssistantProperties properties) {
        this(properties, new SystemEnvMultiReplicaEnvironmentProbe());
    }

    /**
     * Test-friendly constructor: lets unit tests inject a fake environment probe so the multi
     * replica detection can be exercised without manipulating real environment variables.
     */
    AiAssistantSecurityPostureAdvisor(
            AiAssistantProperties properties, MultiReplicaEnvironmentProbe environmentProbe) {
        this.properties = properties;
        this.environmentProbe = environmentProbe;
    }

    public List<String> warningCodes() {
        List<String> warnings = new ArrayList<>();
        boolean hasAccessToken = hasText(properties.getAccessToken());

        if (properties.isAdminEnabled() && !hasAccessToken) {
            warnings.add(ADMIN_WITHOUT_ACCESS_TOKEN);
        }
        if (properties.isConnectorManagementEnabled() && !hasAccessToken) {
            warnings.add(CONNECTOR_MANAGEMENT_WITHOUT_ACCESS_TOKEN);
        }
        if (properties.isMcpServerEnabled() && !hasAccessToken) {
            warnings.add(MCP_SERVER_WITHOUT_ACCESS_TOKEN);
        }
        if (properties.isAllowQueryTokenAuth()) {
            warnings.add(QUERY_TOKEN_AUTH_ENABLED);
        }
        if (isWildcardOrigin(properties.getAllowedOrigins()) && !hasAccessToken) {
            warnings.add(PUBLIC_BROWSER_ACCESS_WITHOUT_TOKEN);
        }
        if (properties.getRateLimit() > 0 && environmentProbe.looksLikeMultiReplica()) {
            warnings.add(MULTI_REPLICA_INPROCESS_RATE_LIMIT);
        }

        return List.copyOf(warnings);
    }

    public void logWarnings() {
        for (String warning : warningCodes()) {
            if (ADMIN_WITHOUT_ACCESS_TOKEN.equals(warning)) {
                log.warn(
                        "ai-assistant.admin-enabled=true is configured without ai-assistant.access-token. "
                                + "Configure X-AI-Token authentication before exposing the admin API.");
            } else if (CONNECTOR_MANAGEMENT_WITHOUT_ACCESS_TOKEN.equals(warning)) {
                log.warn(
                        "ai-assistant.connector-management-enabled=true is configured without "
                                + "ai-assistant.access-token. Dynamic connector management should be protected.");
            } else if (MCP_SERVER_WITHOUT_ACCESS_TOKEN.equals(warning)) {
                log.warn(
                        "ai-assistant.mcp-server-enabled=true is configured without ai-assistant.access-token. "
                                + "Protect MCP tool discovery and invocation before exposing this endpoint.");
            } else if (QUERY_TOKEN_AUTH_ENABLED.equals(warning)) {
                log.warn(
                        "ai-assistant.allow-query-token-auth=true allows tokens in URLs. "
                                + "Prefer the X-AI-Token header to avoid leaking tokens through logs or browser history.");
            } else if (PUBLIC_BROWSER_ACCESS_WITHOUT_TOKEN.equals(warning)) {
                log.warn(
                        "ai-assistant.allowed-origins='*' is configured without ai-assistant.access-token. "
                                + "Use explicit browser origins and configure X-AI-Token before exposing the service.");
            } else if (MULTI_REPLICA_INPROCESS_RATE_LIMIT.equals(warning)) {
                log.warn(
                        "ai-assistant.rate-limit={} is configured but the environment looks like a multi-replica deployment "
                                + "(detected via KUBERNETES_SERVICE_HOST / HOSTNAME pattern). The default rate limiter counts requests "
                                + "in-process, so each replica enforces the quota independently. "
                                + "For consistent enforcement register a RedisRateLimitFilter bean (see RedisRateLimitFilter) "
                                + "or move the quota check to your API gateway. "
                                + "Reference: docs/guide/deployment-checklists.md and docs/guide/production-checklist.md",
                        properties.getRateLimit());
            }
        }
    }

    private boolean hasText(String value) {
        return value != null && !value.isBlank();
    }

    private boolean isWildcardOrigin(String value) {
        return value != null && value.trim().equals("*");
    }

    /**
     * Probe abstraction so unit tests can inject deterministic results without touching real
     * environment variables. The default implementation looks at well-known K8s and PaaS markers.
     */
    interface MultiReplicaEnvironmentProbe {
        boolean looksLikeMultiReplica();
    }

    /**
     * Default probe: returns true if the JVM is running inside a Kubernetes pod (presence of
     * KUBERNETES_SERVICE_HOST) or if HOSTNAME matches the typical multi-replica patterns
     * "&lt;name&gt;-&lt;hash&gt;-&lt;suffix&gt;" used by Deployments / StatefulSets.
     */
    static class SystemEnvMultiReplicaEnvironmentProbe implements MultiReplicaEnvironmentProbe {
        @Override
        public boolean looksLikeMultiReplica() {
            if (hasEnv("KUBERNETES_SERVICE_HOST")) return true;
            String host = System.getenv("HOSTNAME");
            if (host == null || host.isBlank()) return false;
            // Deployment pod: name-replicasethash-suffix (e.g. ai-assistant-7d8b9c-2xq4l)
            // StatefulSet pod: name-N (e.g. ai-assistant-0)
            return host.matches(".+-[a-z0-9]{5,10}-[a-z0-9]{5}") || host.matches(".+-\\d+");
        }

        private static boolean hasEnv(String name) {
            String value = System.getenv(name);
            return value != null && !value.isBlank();
        }
    }
}
