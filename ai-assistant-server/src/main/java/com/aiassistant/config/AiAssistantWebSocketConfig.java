package com.aiassistant.config;

import com.aiassistant.controller.AiAssistantWebSocketHandler;
import org.springframework.boot.autoconfigure.condition.ConditionalOnClass;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

@Configuration
@EnableWebSocket
@ConditionalOnClass(WebSocketConfigurer.class)
@ConditionalOnProperty(prefix = "ai-assistant", name = "websocket-enabled", havingValue = "true")
public class AiAssistantWebSocketConfig implements WebSocketConfigurer {

    private final AiAssistantWebSocketHandler handler;
    private final AiAssistantProperties properties;

    public AiAssistantWebSocketConfig(AiAssistantWebSocketHandler handler, AiAssistantProperties properties) {
        this.handler = handler;
        this.properties = properties;
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        String path = properties.getContextPath() + "/ws";
        String[] origins = properties.getAllowedOrigins().split(",");
        registry.addHandler(handler, path).setAllowedOrigins(origins);
    }
}
