package com.aiassistant.config;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;

class AiAssistantCorsConfigTest {

    @Test
    void scopesOriginsAndNeverEnablesBrowserCredentials() {
        AiAssistantProperties properties = new AiAssistantProperties();
        properties.setContextPath("/assistant");
        properties.setAllowedOrigins("https://app.example.com, https://admin.example.com");
        InspectableCorsRegistry registry = new InspectableCorsRegistry();

        new AiAssistantCorsConfig(properties).addCorsMappings(registry);

        Map<String, CorsConfiguration> mappings = registry.configurations();
        assertEquals(1, mappings.size());
        CorsConfiguration cors = mappings.get("/assistant/**");
        assertEquals(
                List.of("https://app.example.com", "https://admin.example.com"),
                cors.getAllowedOrigins());
        assertEquals(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS"), cors.getAllowedMethods());
        assertEquals(List.of("*"), cors.getAllowedHeaders());
        assertFalse(Boolean.TRUE.equals(cors.getAllowCredentials()));
        assertEquals(
                List.of("Content-Disposition", "X-Request-Id", "X-Trace-Id"),
                cors.getExposedHeaders());
        assertEquals(3600L, cors.getMaxAge());
    }

    private static final class InspectableCorsRegistry extends CorsRegistry {
        private Map<String, CorsConfiguration> configurations() {
            return getCorsConfigurations();
        }
    }
}
