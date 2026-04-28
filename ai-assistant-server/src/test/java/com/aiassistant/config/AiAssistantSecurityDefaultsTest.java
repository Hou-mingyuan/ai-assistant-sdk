package com.aiassistant.config;

import static org.junit.jupiter.api.Assertions.assertFalse;

import org.junit.jupiter.api.Test;

class AiAssistantSecurityDefaultsTest {

    @Test
    void sensitiveManagementSurfacesAreDisabledByDefault() {
        AiAssistantProperties properties = new AiAssistantProperties();

        assertFalse(properties.isAdminEnabled());
        assertFalse(properties.isConnectorManagementEnabled());
        assertFalse(properties.isAllowQueryTokenAuth());
        assertFalse(properties.isMcpServerEnabled());
    }
}
