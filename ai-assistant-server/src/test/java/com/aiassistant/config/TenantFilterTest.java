package com.aiassistant.config;

import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class TenantFilterTest {

    @Test
    void tokenFallbackTenantDoesNotExposeRawToken() throws Exception {
        TenantFilter filter = new TenantFilter("/ai-assistant");
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/ai-assistant/chat");
        request.addHeader("X-AI-Token", "secret-token-value");
        MockHttpServletResponse response = new MockHttpServletResponse();
        String[] seenTenant = new String[1];
        FilterChain chain = (req, res) -> seenTenant[0] = TenantContext.tenantId();

        filter.doFilter(request, response, chain);

        assertTrue(seenTenant[0].startsWith("token:"));
        assertFalse(seenTenant[0].contains("secret-token-value"));
    }
}
