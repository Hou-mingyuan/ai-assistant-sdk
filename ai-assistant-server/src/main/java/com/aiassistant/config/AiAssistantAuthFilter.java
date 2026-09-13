package com.aiassistant.config;

import com.aiassistant.security.HmacTenantTokens;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.Map;

/**
 * Access-token filter.
 *
 * <p>{@code shared} mode (default): every caller presents the same static token via the
 * {@code X-AI-Token} header. {@code hmac} mode: callers present a signed tenant token issued
 * through {@code POST <context>/admin/tenant-tokens}; the signature is verified here and the
 * verified tenant id is exposed as the {@link #VERIFIED_TENANT_ATTRIBUTE} request attribute so
 * {@link TenantFilter} can derive tenant identity from it instead of trusting client headers.
 * The query-string token channel ({@code ?token=...}) has been removed: URLs end up in logs,
 * history and Referer headers, so bearer credentials are only accepted from headers.
 */
public class AiAssistantAuthFilter implements Filter {

    /** Request attribute carrying the tenant id verified from a signed token (hmac mode). */
    public static final String VERIFIED_TENANT_ATTRIBUTE = "ai-assistant.verified-tenant";

    private final String contextPath;
    private final String accessToken;
    private final boolean hmacMode;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public AiAssistantAuthFilter(AiAssistantProperties properties) {
        this.contextPath = properties.getContextPath();
        this.accessToken = properties.getAccessToken();
        this.hmacMode = "hmac".equalsIgnoreCase(properties.getAuthMode());
    }

    @Override
    public void doFilter(ServletRequest req, ServletResponse res, FilterChain chain)
            throws IOException, ServletException {

        if (accessToken == null || accessToken.isBlank()) {
            chain.doFilter(req, res);
            return;
        }

        HttpServletRequest request = (HttpServletRequest) req;
        String path = request.getRequestURI();

        if (!RequestPathMatcher.matchesContextPath(path, contextPath)) {
            chain.doFilter(req, res);
            return;
        }

        if (RequestPathMatcher.matchesContextPath(path, contextPath + "/admin")) {
            chain.doFilter(req, res);
            return;
        }

        if (path.equals(contextPath + "/health") && !"true".equals(request.getParameter("deep"))) {
            chain.doFilter(req, res);
            return;
        }

        if ("OPTIONS".equalsIgnoreCase(request.getMethod())) {
            chain.doFilter(req, res);
            return;
        }

        String token = request.getHeader("X-AI-Token");
        boolean authorized = hmacMode ? verifyHmacToken(request, token) : verifySharedToken(token);

        if (!authorized) {
            HttpServletResponse response = (HttpServletResponse) res;
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            response.setContentType("application/json;charset=UTF-8");
            objectMapper.writeValue(
                    response.getOutputStream(),
                    Map.of(
                            "success",
                            false,
                            "error",
                            "Unauthorized: invalid or missing X-AI-Token header"));
            return;
        }

        chain.doFilter(req, res);
    }

    private boolean verifySharedToken(String token) {
        byte[] expected = accessToken.getBytes(StandardCharsets.UTF_8);
        byte[] got = token == null ? null : token.getBytes(StandardCharsets.UTF_8);
        return got != null && MessageDigest.isEqual(expected, got);
    }

    private boolean verifyHmacToken(HttpServletRequest request, String token) {
        // In hmac mode the static secret is the signing key, never a bearer value, so only
        // signature verification is performed here.
        String tenantId = HmacTenantTokens.verify(token, accessToken, Instant.now());
        if (tenantId == null) {
            return false;
        }
        request.setAttribute(VERIFIED_TENANT_ATTRIBUTE, tenantId);
        return true;
    }
}
