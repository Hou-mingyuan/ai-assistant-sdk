package com.aiassistant.config;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.aiassistant.security.HmacTenantTokens;
import java.time.Instant;
import java.util.concurrent.atomic.AtomicBoolean;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

class AiAssistantAuthFilterTest {

    @Test
    void acceptsValidHeaderToken() throws Exception {
        AiAssistantAuthFilter filter = filter();
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/ai-assistant/chat");
        request.addHeader("X-AI-Token", "secret");
        MockHttpServletResponse response = new MockHttpServletResponse();
        AtomicBoolean called = new AtomicBoolean(false);

        filter.doFilter(request, response, (servletRequest, servletResponse) -> called.set(true));

        assertTrue(called.get());
        assertEquals(200, response.getStatus());
    }

    @Test
    void skipsAdminPathsSoDedicatedAdminTokenCanBeCheckedByAdminFilter() throws Exception {
        AiAssistantAuthFilter filter = filter();
        MockHttpServletRequest request =
                new MockHttpServletRequest("GET", "/ai-assistant/admin/overview");
        MockHttpServletResponse response = new MockHttpServletResponse();
        AtomicBoolean called = new AtomicBoolean(false);

        filter.doFilter(request, response, (servletRequest, servletResponse) -> called.set(true));

        assertTrue(called.get());
        assertEquals(200, response.getStatus());
    }

    @Test
    void rejectsQueryTokenForRestRequestsUnconditionally() throws Exception {
        AiAssistantAuthFilter filter = filter();
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/ai-assistant/chat");
        request.setParameter("token", "secret");
        MockHttpServletResponse response = new MockHttpServletResponse();
        AtomicBoolean called = new AtomicBoolean(false);

        filter.doFilter(request, response, (servletRequest, servletResponse) -> called.set(true));

        assertEquals(401, response.getStatus());
        assertFalse(called.get());
    }

    @Test
    void hmacModeAcceptsSignedTenantTokenAndExposesVerifiedTenant() throws Exception {
        AiAssistantProperties properties = securedProperties();
        properties.setAuthMode("hmac");
        AiAssistantAuthFilter filter = new AiAssistantAuthFilter(properties);
        String token = HmacTenantTokens.issue("tenant-a", 3600, "secret", Instant.now());
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/ai-assistant/chat");
        request.addHeader("X-AI-Token", token);
        MockHttpServletResponse response = new MockHttpServletResponse();
        AtomicBoolean called = new AtomicBoolean(false);

        filter.doFilter(request, response, (servletRequest, servletResponse) -> called.set(true));

        assertTrue(called.get());
        assertEquals(200, response.getStatus());
        assertEquals(
                "tenant-a",
                request.getAttribute(AiAssistantAuthFilter.VERIFIED_TENANT_ATTRIBUTE));
    }

    @Test
    void hmacModeRejectsSharedSecretUsedAsBearerAndTamperedTokens() throws Exception {
        AiAssistantProperties properties = securedProperties();
        properties.setAuthMode("hmac");
        AiAssistantAuthFilter filter = new AiAssistantAuthFilter(properties);

        MockHttpServletRequest sharedAsBearer = new MockHttpServletRequest("POST", "/ai-assistant/chat");
        sharedAsBearer.addHeader("X-AI-Token", "secret");
        MockHttpServletResponse sharedResponse = new MockHttpServletResponse();
        AtomicBoolean called = new AtomicBoolean(false);
        filter.doFilter(sharedAsBearer, sharedResponse, (req, res) -> called.set(true));
        assertEquals(401, sharedResponse.getStatus());
        assertFalse(called.get());

        String tampered = HmacTenantTokens.issue("tenant-a", 3600, "secret", java.time.Instant.now()) + "x";
        MockHttpServletRequest tamperedRequest = new MockHttpServletRequest("POST", "/ai-assistant/chat");
        tamperedRequest.addHeader("X-AI-Token", tampered);
        MockHttpServletResponse tamperedResponse = new MockHttpServletResponse();
        AtomicBoolean tamperedCalled = new AtomicBoolean(false);
        filter.doFilter(tamperedRequest, tamperedResponse, (req, res) -> tamperedCalled.set(true));
        assertEquals(401, tamperedResponse.getStatus());
        assertFalse(tamperedCalled.get());
    }

    @Test
    void ignoresPrefixLookalikePaths() throws Exception {
        AiAssistantAuthFilter filter = filter();
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/ai-assistant2/chat");
        MockHttpServletResponse response = new MockHttpServletResponse();
        AtomicBoolean called = new AtomicBoolean(false);

        filter.doFilter(request, response, (servletRequest, servletResponse) -> called.set(true));

        assertTrue(called.get());
        assertEquals(200, response.getStatus());
    }

    private static AiAssistantAuthFilter filter() {
        return new AiAssistantAuthFilter(securedProperties());
    }

    private static AiAssistantProperties securedProperties() {
        AiAssistantProperties properties = new AiAssistantProperties();
        properties.setContextPath("/ai-assistant");
        properties.setAccessToken("secret");
        return properties;
    }
}
