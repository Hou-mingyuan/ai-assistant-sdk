package com.aiassistant.config;

import com.aiassistant.controller.AiAssistantWebSocketHandler;
import com.aiassistant.security.HmacTenantTokens;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.Map;
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

@Configuration
@EnableWebSocket
@ConditionalOnClass(WebSocketConfigurer.class)
@ConditionalOnProperty(prefix = "ai-assistant", name = "websocket-enabled", havingValue = "true")
public class AiAssistantWebSocketConfig implements WebSocketConfigurer {

    private final AiAssistantWebSocketHandler handler;
    private final AiAssistantProperties properties;

    public AiAssistantWebSocketConfig(
            AiAssistantWebSocketHandler handler, AiAssistantProperties properties) {
        this.handler = handler;
        this.properties = properties;
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        String path = properties.getContextPath() + "/ws";
        String[] origins = properties.resolveAllowedOrigins();
        registry.addHandler(handler, path)
                .addInterceptors(new TokenHandshakeInterceptor(properties))
                .setAllowedOrigins(origins);
    }

    /**
     * Validates X-AI-Token during WebSocket handshake, preventing unauthenticated access to the LLM
     * streaming endpoint. Accepts the shared static token in {@code shared} mode and signed tenant
     * tokens in {@code hmac} mode; the query-string token channel has been removed (credentials in
     * URLs leak through logs, history and Referer headers).
     */
    static class TokenHandshakeInterceptor implements HandshakeInterceptor {
        private final AiAssistantProperties properties;

        TokenHandshakeInterceptor(AiAssistantProperties properties) {
            this.properties = properties;
        }

        @Override
        public boolean beforeHandshake(
                ServerHttpRequest request,
                ServerHttpResponse response,
                WebSocketHandler wsHandler,
                Map<String, Object> attributes) {
            String expectedToken = properties.getAccessToken();
            if (expectedToken == null || expectedToken.isBlank()) return true;

            String token = null;
            if (request instanceof ServletServerHttpRequest servletReq) {
                token = servletReq.getServletRequest().getHeader("X-AI-Token");
            }

            if (token == null) {
                response.setStatusCode(org.springframework.http.HttpStatus.UNAUTHORIZED);
                return false;
            }

            boolean hmacMode = "hmac".equalsIgnoreCase(properties.getAuthMode());
            boolean authorized =
                    hmacMode
                            ? HmacTenantTokens.verify(token, expectedToken, Instant.now()) != null
                            : MessageDigest.isEqual(
                                    expectedToken.getBytes(StandardCharsets.UTF_8),
                                    token.getBytes(StandardCharsets.UTF_8));
            if (!authorized) {
                response.setStatusCode(org.springframework.http.HttpStatus.UNAUTHORIZED);
                return false;
            }
            return true;
        }

        @Override
        public void afterHandshake(
                ServerHttpRequest request,
                ServerHttpResponse response,
                WebSocketHandler wsHandler,
                Exception exception) {}
    }
}
