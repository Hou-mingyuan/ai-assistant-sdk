package com.aiassistant.config;

import jakarta.servlet.*;
import jakarta.servlet.http.HttpServletRequest;

import java.io.IOException;

/**
 * Extracts tenant identity from request headers and populates {@link TenantContext}.
 * Override the {@code resolveTenantId} method or replace this bean to integrate
 * with your own tenant resolution logic (JWT claims, database lookup, etc.).
 */
public class TenantFilter implements Filter {

    private final String contextPath;

    public TenantFilter(String contextPath) {
        this.contextPath = contextPath;
    }

    @Override
    public void doFilter(ServletRequest req, ServletResponse res, FilterChain chain)
            throws IOException, ServletException {
        HttpServletRequest request = (HttpServletRequest) req;
        String path = request.getRequestURI();
        if (path.startsWith(contextPath)) {
            String tenantId = resolveTenantId(request);
            TenantContext.set(new TenantContext.TenantInfo(tenantId));
        }
        try {
            chain.doFilter(req, res);
        } finally {
            TenantContext.clear();
        }
    }

    protected String resolveTenantId(HttpServletRequest request) {
        String tenant = request.getHeader("X-Tenant-Id");
        if (tenant != null && !tenant.isBlank()) return tenant.trim();
        String token = request.getHeader("X-AI-Token");
        if (token != null && !token.isBlank()) {
            return "token:" + com.aiassistant.util.ClientIdentity.tokenFingerprint(token);
        }
        return "default";
    }
}
