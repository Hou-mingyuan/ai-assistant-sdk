package com.aiassistant.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Map;

/**
 * Guards {@code /admin/**} endpoints with a dedicated admin token. When no admin-specific token is
 * configured the filter falls back to the main {@code access-token}.
 */
public class AdminAuthFilter implements Filter {

    private final String adminPathPrefix;
    private final String adminToken;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public AdminAuthFilter(String contextPath, String adminToken) {
        this.adminPathPrefix = contextPath + "/admin";
        this.adminToken = adminToken;
    }

    @Override
    public void doFilter(ServletRequest req, ServletResponse res, FilterChain chain)
            throws IOException, ServletException {

        HttpServletRequest request = (HttpServletRequest) req;
        String path = request.getRequestURI();

        if (!RequestPathMatcher.matchesContextPath(path, adminPathPrefix)) {
            chain.doFilter(req, res);
            return;
        }

        if ("OPTIONS".equalsIgnoreCase(request.getMethod())) {
            chain.doFilter(req, res);
            return;
        }

        if (adminToken == null || adminToken.isBlank()) {
            reject(res, "Admin API is not configured with an admin token");
            return;
        }

        String token = request.getHeader("X-Admin-Token");
        if (token == null || token.isBlank()) {
            token = request.getHeader("X-AI-Token");
        }

        byte[] expected = adminToken.getBytes(StandardCharsets.UTF_8);
        byte[] got = token == null ? null : token.getBytes(StandardCharsets.UTF_8);
        if (got == null || !MessageDigest.isEqual(expected, got)) {
            reject(res, "Unauthorized: invalid or missing admin token");
            return;
        }

        chain.doFilter(req, res);
    }

    private void reject(ServletResponse res, String message) throws IOException {
        HttpServletResponse response = (HttpServletResponse) res;
        response.setStatus(HttpServletResponse.SC_FORBIDDEN);
        response.setContentType("application/json;charset=UTF-8");
        objectMapper.writeValue(
                response.getOutputStream(), Map.of("success", false, "error", message));
    }
}
