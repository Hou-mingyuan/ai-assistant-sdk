package com.aiassistant.config;

import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

public class AiAssistantCorsConfig implements WebMvcConfigurer {

    private final AiAssistantProperties properties;

    public AiAssistantCorsConfig(AiAssistantProperties properties) {
        this.properties = properties;
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
