package com.aiassistant.config;

import com.aiassistant.controller.AiAssistantWebSocketHandler;
import org.springframework.boot.autoconfigure.condition.ConditionalOnClass;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.http.server.ServletServerHttpRequest;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;
import org.springframework.web.socket.server.HandshakeInterceptor;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Map;

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
        registry.addHandler(handler, path)
                .addInterceptors(new TokenHandshakeInterceptor(properties.getAccessToken()))
                .setAllowedOrigins(origins);
    }

    /**
     * Validates X-AI-Token during WebSocket handshake (via query param or header),
     * preventing unauthenticated access to the LLM streaming endpoint.
     */
    private static class TokenHandshakeInterceptor implements HandshakeInterceptor {
        private final String expectedToken;

        TokenHandshakeInterceptor(String expectedToken) {
            this.expectedToken = expectedToken;
        }

        @Override
        public boolean beforeHandshake(ServerHttpRequest request, ServerHttpResponse response,
                                       WebSocketHandler wsHandler, Map<String, Object> attributes) {
            if (expectedToken == null || expectedToken.isBlank()) return true;

            String token = null;
            if (request instanceof ServletServerHttpRequest servletReq) {
                token = servletReq.getServletRequest().getParameter("token");
                if (token == null) {
                    token = servletReq.getServletRequest().getHeader("X-AI-Token");
                }
            }

            if (token == null) {
                response.setStatusCode(org.springframework.http.HttpStatus.UNAUTHORIZED);
                return false;
            }

            byte[] expected = expectedToken.getBytes(StandardCharsets.UTF_8);
            byte[] got = token.getBytes(StandardCharsets.UTF_8);
            if (!MessageDigest.isEqual(expected, got)) {
                response.setStatusCode(org.springframework.http.HttpStatus.UNAUTHORIZED);
                return false;
            }
            return true;
        }

        @Override
        public void afterHandshake(ServerHttpRequest request, ServerHttpResponse response,
                                   WebSocketHandler wsHandler, Exception exception) {
        }
    }
}
