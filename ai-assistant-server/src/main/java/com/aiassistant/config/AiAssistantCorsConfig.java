package com.aiassistant.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

public class AiAssistantCorsConfig implements WebMvcConfigurer {

    private static final Logger log = LoggerFactory.getLogger(AiAssistantCorsConfig.class);

    private final AiAssistantProperties properties;

    public AiAssistantCorsConfig(AiAssistantProperties properties) {
        this.properties = properties;
        if ("*".equals(properties.getAllowedOrigins())) {
            log.warn("ai-assistant.allowed-origins is set to '*'. "
                    + "This is insecure for production. Set explicit origins via ai-assistant.allowed-origins.");
        }
    }

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        String pattern = properties.getContextPath() + "/**";
        String[] origins = properties.getAllowedOrigins().split(",");
        registry.addMapping(pattern)
                .allowedOrigins(origins)
                .allowedMethods("GET", "POST", "OPTIONS")
                .allowedHeaders("*")
                .exposedHeaders("Content-Disposition")
                .maxAge(3600);
    }
}
