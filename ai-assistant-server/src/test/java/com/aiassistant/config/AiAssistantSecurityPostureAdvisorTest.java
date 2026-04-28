package com.aiassistant.config;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import org.junit.jupiter.api.Test;

class AiAssistantSecurityPostureAdvisorTest {

    @Test
    void defaultsDoNotProduceManagementWarnings() {
        AiAssistantSecurityPostureAdvisor advisor =
                new AiAssistantSecurityPostureAdvisor(new AiAssistantProperties());

        assertTrue(advisor.warningCodes().isEmpty());
    }

    @Test
    void warnsWhenAdminIsEnabledWithoutAccessToken() {
        AiAssistantProperties properties = new AiAssistantProperties();
        properties.setAdminEnabled(true);

        AiAssistantSecurityPostureAdvisor advisor = new AiAssistantSecurityPostureAdvisor(properties);

        assertEquals(List.of(AiAssistantSecurityPostureAdvisor.ADMIN_WITHOUT_ACCESS_TOKEN),
                advisor.warningCodes());
    }

    @Test
    void warnsWhenConnectorManagementIsEnabledWithoutAccessToken() {
        AiAssistantProperties properties = new AiAssistantProperties();
        properties.setConnectorManagementEnabled(true);

        AiAssistantSecurityPostureAdvisor advisor = new AiAssistantSecurityPostureAdvisor(properties);

        assertEquals(List.of(AiAssistantSecurityPostureAdvisor.CONNECTOR_MANAGEMENT_WITHOUT_ACCESS_TOKEN),
                advisor.warningCodes());
    }

    @Test
    void warnsWhenMcpServerIsEnabledWithoutAccessToken() {
        AiAssistantProperties properties = new AiAssistantProperties();
        properties.setMcpServerEnabled(true);

        AiAssistantSecurityPostureAdvisor advisor = new AiAssistantSecurityPostureAdvisor(properties);

        assertEquals(List.of(AiAssistantSecurityPostureAdvisor.MCP_SERVER_WITHOUT_ACCESS_TOKEN),
                advisor.warningCodes());
    }

    @Test
    void warnsWhenQueryTokenAuthCompatibilityIsEnabled() {
        AiAssistantProperties properties = new AiAssistantProperties();
        properties.setAccessToken("secret");
        properties.setAllowQueryTokenAuth(true);

        AiAssistantSecurityPostureAdvisor advisor = new AiAssistantSecurityPostureAdvisor(properties);

        assertEquals(List.of(AiAssistantSecurityPostureAdvisor.QUERY_TOKEN_AUTH_ENABLED),
                advisor.warningCodes());
    }
}
