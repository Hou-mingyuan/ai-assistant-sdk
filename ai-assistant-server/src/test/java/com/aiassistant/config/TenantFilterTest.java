package com.aiassistant.config;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

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

    @Test
    void acceptsSafeTenantHeader() throws Exception {
        TenantFilter filter = new TenantFilter("/ai-assistant");
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/ai-assistant/chat");
        request.addHeader("X-Tenant-Id", "tenant.prod-01");
        MockHttpServletResponse response = new MockHttpServletResponse();
        String[] seenTenant = new String[1];
        FilterChain chain = (req, res) -> seenTenant[0] = TenantContext.tenantId();

        filter.doFilter(request, response, chain);

        assertEquals("tenant.prod-01", seenTenant[0]);
    }

    @Test
    void rejectsUnsafeTenantHeader() throws Exception {
        TenantFilter filter = new TenantFilter("/ai-assistant");
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/ai-assistant/chat");
        request.addHeader("X-Tenant-Id", "tenant\nspoofed");
        MockHttpServletResponse response = new MockHttpServletResponse();
        String[] seenTenant = new String[1];
        FilterChain chain = (req, res) -> seenTenant[0] = TenantContext.tenantId();

        filter.doFilter(request, response, chain);

        assertEquals("default", seenTenant[0]);
    }

    @Test
    void ignoresPrefixLookalikePaths() throws Exception {
        TenantFilter filter = new TenantFilter("/ai-assistant");
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/ai-assistant2/chat");
        MockHttpServletResponse response = new MockHttpServletResponse();
        boolean[] hadTenant = new boolean[1];
        FilterChain chain = (req, res) -> hadTenant[0] = TenantContext.get() != null;

        filter.doFilter(request, response, chain);

        assertFalse(hadTenant[0]);
    }
}
