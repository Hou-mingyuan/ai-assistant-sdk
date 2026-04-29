package com.aiassistant.controller;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.aiassistant.config.AiAssistantProperties;
import com.aiassistant.config.AiAssistantSecurityPostureAdvisor;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class RuntimeConfigControllerTest {

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void returnsSafeDefaultRuntimeConfig() {
        AiAssistantProperties properties = new AiAssistantProperties();
        RuntimeConfigController controller = controller(properties);

        Map<String, Object> result = controller.runtimeConfig();

        assertEquals(true, result.get("success"));
        Map<?, ?> service = (Map<?, ?>) result.get("service");
        Map<?, ?> security = (Map<?, ?>) result.get("security");
        assertEquals("/ai-assistant", service.get("contextPath"));
        assertEquals("openai", service.get("provider"));
        assertEquals(false, security.get("accessTokenConfigured"));
        assertEquals("wildcard", security.get("allowedOriginsMode"));
        assertTrue(
                ((List<?>) security.get("securityWarnings"))
                        .contains(
                                AiAssistantSecurityPostureAdvisor
                                        .PUBLIC_BROWSER_ACCESS_WITHOUT_TOKEN));
    }

    @Test
    void doesNotExposeSecrets() throws Exception {
        AiAssistantProperties properties = new AiAssistantProperties();
        properties.setApiKey("sk-secret-value");
        properties.setAccessToken("very-secret-token");
        properties.setBaseUrl("https://internal-gateway.example.com/v1");
        RuntimeConfigController controller = controller(properties);

        String json = objectMapper.writeValueAsString(controller.runtimeConfig());

        assertFalse(json.contains("sk-secret-value"));
        assertFalse(json.contains("very-secret-token"));
        assertFalse(json.contains("internal-gateway"));
        assertTrue(json.contains("\"apiKeyConfigured\":true"));
        assertTrue(json.contains("\"accessTokenConfigured\":true"));
        assertTrue(json.contains("\"customBaseUrlConfigured\":true"));
    }

    @Test
    void reportsFeatureFlagsAndLimits() {
        AiAssistantProperties properties = new AiAssistantProperties();
        properties.setAccessToken("secret");
        properties.setAllowedOrigins("https://example.com,https://admin.example.com");
        properties.setProvider("ollama");
        properties.setModel("llama3.1");
        properties.setRateLimit(30);
        properties.setWebsocketEnabled(true);
        properties.setMcpServerEnabled(true);
        properties.setAllowedModels(List.of("llama3.1", "qwen2.5"));
        RuntimeConfigController controller = controller(properties);

        Map<String, Object> result = controller.runtimeConfig();

        Map<?, ?> service = (Map<?, ?>) result.get("service");
        Map<?, ?> security = (Map<?, ?>) result.get("security");
        Map<?, ?> features = (Map<?, ?>) result.get("features");
        Map<?, ?> limits = (Map<?, ?>) result.get("limits");

        assertEquals("ollama", service.get("provider"));
        assertEquals("llama3.1", service.get("model"));
        assertEquals("explicit", security.get("allowedOriginsMode"));
        assertEquals(2, security.get("allowedOriginsCount"));
        assertEquals(true, features.get("websocketEnabled"));
        assertEquals(true, features.get("mcpServerEnabled"));
        assertEquals(true, features.get("allowedModelsConfigured"));
        assertEquals(30, limits.get("rateLimitPerMinute"));
    }

    private RuntimeConfigController controller(AiAssistantProperties properties) {
        return new RuntimeConfigController(
                properties, new AiAssistantSecurityPostureAdvisor(properties));
    }
}
