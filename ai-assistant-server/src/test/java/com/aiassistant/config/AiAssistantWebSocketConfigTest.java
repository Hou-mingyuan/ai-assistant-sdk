package com.aiassistant.config;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

import com.aiassistant.security.HmacTenantTokens;
import java.time.Instant;
import java.util.HashMap;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.http.server.ServletServerHttpRequest;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.web.socket.WebSocketHandler;

class AiAssistantWebSocketConfigTest {

    @Test
    void acceptsHeaderToken() {
        AiAssistantWebSocketConfig.TokenHandshakeInterceptor interceptor =
                new AiAssistantWebSocketConfig.TokenHandshakeInterceptor(securedProperties());
        MockHttpServletRequest servletRequest =
                new MockHttpServletRequest("GET", "/ai-assistant/ws");
        servletRequest.addHeader("X-AI-Token", "secret");
        ServerHttpResponse response = mock(ServerHttpResponse.class);

        boolean ok =
                interceptor.beforeHandshake(
                        new ServletServerHttpRequest(servletRequest),
                        response,
                        mock(WebSocketHandler.class),
                        new HashMap<>());

        assertTrue(ok);
    }

    @Test
    void rejectsQueryTokenUnconditionally() {
        AiAssistantWebSocketConfig.TokenHandshakeInterceptor interceptor =
                new AiAssistantWebSocketConfig.TokenHandshakeInterceptor(securedProperties());
        MockHttpServletRequest servletRequest =
                new MockHttpServletRequest("GET", "/ai-assistant/ws");
        servletRequest.setParameter("token", "secret");
        ServerHttpResponse response = mock(ServerHttpResponse.class);

        boolean ok =
                interceptor.beforeHandshake(
                        new ServletServerHttpRequest(servletRequest),
                        response,
                        mock(WebSocketHandler.class),
                        new HashMap<>());

        assertFalse(ok);
        verify(response).setStatusCode(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void hmacModeAcceptsSignedTenantTokenButNotSharedSecret() {
        AiAssistantProperties properties = securedProperties();
        properties.setAuthMode("hmac");
        AiAssistantWebSocketConfig.TokenHandshakeInterceptor interceptor =
                new AiAssistantWebSocketConfig.TokenHandshakeInterceptor(properties);

        MockHttpServletRequest signed =
                new MockHttpServletRequest("GET", "/ai-assistant/ws");
        signed.addHeader("X-AI-Token", HmacTenantTokens.issue("tenant-a", 3600, "secret", Instant.now()));
        ServerHttpResponse signedResponse = mock(ServerHttpResponse.class);
        assertTrue(
                interceptor.beforeHandshake(
                        new ServletServerHttpRequest(signed),
                        signedResponse,
                        mock(WebSocketHandler.class),
                        new HashMap<>()));

        MockHttpServletRequest shared =
                new MockHttpServletRequest("GET", "/ai-assistant/ws");
        shared.addHeader("X-AI-Token", "secret");
        ServerHttpResponse sharedResponse = mock(ServerHttpResponse.class);
        assertFalse(
                interceptor.beforeHandshake(
                        new ServletServerHttpRequest(shared),
                        sharedResponse,
                        mock(WebSocketHandler.class),
                        new HashMap<>()));
        verify(sharedResponse).setStatusCode(HttpStatus.UNAUTHORIZED);
    }

    private static AiAssistantProperties securedProperties() {
        AiAssistantProperties properties = new AiAssistantProperties();
        properties.setAccessToken("secret");
        return properties;
    }
}
