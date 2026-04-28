package com.aiassistant.autoconfigure;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.lang.reflect.Method;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;

class AiAssistantAutoConfigurationTest {

    @Test
    void mcpServerRequiresExplicitOptIn() throws Exception {
        Method method = AiAssistantAutoConfiguration.class.getDeclaredMethod(
                "mcpServerController", ObjectProvider.class);

        ConditionalOnProperty condition = method.getAnnotation(ConditionalOnProperty.class);

        assertEquals("ai-assistant", condition.prefix());
        assertArrayEquals(new String[] {"mcp-server-enabled"}, condition.name());
        assertEquals("true", condition.havingValue());
        assertFalse(condition.matchIfMissing());
    }

    @Test
    void capabilityToolAdapterKeepsExistingDefault() throws Exception {
        Method method = AiAssistantAutoConfiguration.class.getDeclaredMethod(
                "capabilityToolAdapter", com.aiassistant.tool.ToolRegistry.class, ObjectProvider.class);

        ConditionalOnProperty condition = method.getAnnotation(ConditionalOnProperty.class);

        assertTrue(condition.matchIfMissing());
    }
}
