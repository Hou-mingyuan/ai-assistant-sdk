package com.aiassistant.config;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.http.server.ServletServerHttpRequest;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.web.socket.WebSocketHandler;

import java.util.HashMap;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

class AiAssistantWebSocketConfigTest {

    @Test
    void acceptsHeaderToken() {
        AiAssistantWebSocketConfig.TokenHandshakeInterceptor interceptor =
                new AiAssistantWebSocketConfig.TokenHandshakeInterceptor("secret", false);
        MockHttpServletRequest servletRequest = new MockHttpServletRequest("GET", "/ai-assistant/ws");
        servletRequest.addHeader("X-AI-Token", "secret");
        ServerHttpResponse response = mock(ServerHttpResponse.class);

        boolean ok = interceptor.beforeHandshake(
                new ServletServerHttpRequest(servletRequest),
                response,
                mock(WebSocketHandler.class),
                new HashMap<>());

        assertTrue(ok);
    }

    @Test
    void rejectsQueryTokenByDefault() {
        AiAssistantWebSocketConfig.TokenHandshakeInterceptor interceptor =
                new AiAssistantWebSocketConfig.TokenHandshakeInterceptor("secret", false);
        MockHttpServletRequest servletRequest = new MockHttpServletRequest("GET", "/ai-assistant/ws");
        servletRequest.setParameter("token", "secret");
        ServerHttpResponse response = mock(ServerHttpResponse.class);

        boolean ok = interceptor.beforeHandshake(
                new ServletServerHttpRequest(servletRequest),
                response,
                mock(WebSocketHandler.class),
                new HashMap<>());

        assertFalse(ok);
        verify(response).setStatusCode(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void allowsQueryTokenOnlyWhenExplicitlyEnabled() {
        AiAssistantWebSocketConfig.TokenHandshakeInterceptor interceptor =
                new AiAssistantWebSocketConfig.TokenHandshakeInterceptor("secret", true);
        MockHttpServletRequest servletRequest = new MockHttpServletRequest("GET", "/ai-assistant/ws");
        servletRequest.setParameter("token", "secret");
        ServerHttpResponse response = mock(ServerHttpResponse.class);

        boolean ok = interceptor.beforeHandshake(
                new ServletServerHttpRequest(servletRequest),
                response,
                mock(WebSocketHandler.class),
                new HashMap<>());

        assertTrue(ok);
    }
}
