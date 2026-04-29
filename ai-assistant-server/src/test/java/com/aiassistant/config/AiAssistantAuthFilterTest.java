package com.aiassistant.config;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

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
    void rejectsQueryTokenForRestRequestsByDefault() throws Exception {
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
    void allowsQueryTokenOnlyWhenExplicitlyEnabled() throws Exception {
        AiAssistantProperties properties = securedProperties();
        properties.setAllowQueryTokenAuth(true);
        AiAssistantAuthFilter filter = new AiAssistantAuthFilter(properties);
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/ai-assistant/chat");
        request.setParameter("token", "secret");
        MockHttpServletResponse response = new MockHttpServletResponse();
        AtomicBoolean called = new AtomicBoolean(false);

        filter.doFilter(request, response, (servletRequest, servletResponse) -> called.set(true));

        assertTrue(called.get());
        assertEquals(200, response.getStatus());
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
