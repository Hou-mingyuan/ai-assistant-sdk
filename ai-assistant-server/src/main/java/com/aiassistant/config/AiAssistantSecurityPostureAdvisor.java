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

    private static final Logger log =
            LoggerFactory.getLogger(AiAssistantSecurityPostureAdvisor.class);

    private final AiAssistantProperties properties;

    public AiAssistantSecurityPostureAdvisor(AiAssistantProperties properties) {
        this.properties = properties;
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
            }
        }
    }

    private boolean hasText(String value) {
        return value != null && !value.isBlank();
    }

    private boolean isWildcardOrigin(String value) {
        return value != null && value.trim().equals("*");
    }
}
