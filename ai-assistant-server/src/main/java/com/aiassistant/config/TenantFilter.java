package com.aiassistant.config;

import jakarta.servlet.*;
import jakarta.servlet.http.HttpServletRequest;
import java.io.IOException;
import java.util.regex.Pattern;

/**
 * Extracts tenant identity from the request and populates {@link TenantContext}.
 *
 * <p>{@code shared} auth mode (default): tenant id comes from the client-supplied
 * {@code X-Tenant-Id} header — convenient for local and trusted-network use, but self-reported
 * and therefore forgeable. {@code hmac} auth mode: tenant id is derived from the signed tenant
 * token that {@link AiAssistantAuthFilter} already verified and exposed as the
 * {@link AiAssistantAuthFilter#VERIFIED_TENANT_ATTRIBUTE} request attribute; the client-supplied
 * header is ignored. Override {@link #resolveTenantId} or replace this bean to integrate with
 * your own tenant resolution logic (JWT claims, database lookup, etc.).
 */
public class TenantFilter implements Filter {

    private static final Pattern SAFE_TENANT_ID = Pattern.compile("[a-zA-Z0-9_.:-]{1,64}");

    private final String contextPath;
    private final boolean hmacMode;

    public TenantFilter(String contextPath) {
        this(contextPath, false);
    }

    public TenantFilter(String contextPath, boolean hmacMode) {
        this.contextPath = contextPath;
        this.hmacMode = hmacMode;
    }

    @Override
    public void doFilter(ServletRequest req, ServletResponse res, FilterChain chain)
            throws IOException, ServletException {
        HttpServletRequest request = (HttpServletRequest) req;
        String path = request.getRequestURI();
        if (RequestPathMatcher.matchesContextPath(path, contextPath)) {
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
        if (hmacMode) {
            Object verified = request.getAttribute(AiAssistantAuthFilter.VERIFIED_TENANT_ATTRIBUTE);
            if (verified instanceof String tenantId && !tenantId.isBlank()) {
                return tenantId;
            }
            // No verified token attribute: either auth is disabled (no access token) or the
            // request skipped auth. Fall through to the legacy self-reported resolution.
        }
        String tenant = request.getHeader("X-Tenant-Id");
        if (tenant != null && !tenant.isBlank()) {
            String normalized = tenant.trim();
            if (SAFE_TENANT_ID.matcher(normalized).matches()) {
                return normalized;
            }
            return "default";
        }
        String token = request.getHeader("X-AI-Token");
        if (token != null && !token.isBlank()) {
            return "token:" + com.aiassistant.util.ClientIdentity.tokenFingerprint(token);
        }
        return "default";
    }
}
