package com.aiassistant.config;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletRequest;
import jakarta.servlet.ServletResponse;
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

        filter.doFilter(request, response, chain(called));

        assertTrue(called.get());
        assertEquals(200, response.getStatus());
    }

    @Test
    void rejectsQueryTokenForRestRequests() throws Exception {
        AiAssistantAuthFilter filter = filter();
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/ai-assistant/chat");
        request.setParameter("token", "secret");
        MockHttpServletResponse response = new MockHttpServletResponse();
        AtomicBoolean called = new AtomicBoolean(false);

        filter.doFilter(request, response, chain(called));

        assertEquals(401, response.getStatus());
        assertEquals(false, called.get());
    }

    private static AiAssistantAuthFilter filter() {
        AiAssistantProperties properties = new AiAssistantProperties();
        properties.setContextPath("/ai-assistant");
        properties.setAccessToken("secret");
        return new AiAssistantAuthFilter(properties);
    }

    private static FilterChain chain(AtomicBoolean called) {
        return new FilterChain() {
            @Override
            public void doFilter(ServletRequest request, ServletResponse response) {
                called.set(true);
            }
        };
    }
}
