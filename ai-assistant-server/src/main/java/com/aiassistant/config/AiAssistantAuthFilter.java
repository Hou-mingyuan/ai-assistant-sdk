package com.aiassistant.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Map;

public class AiAssistantAuthFilter implements Filter {

    private final String contextPath;
    private final String accessToken;
    private final boolean allowQueryTokenAuth;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public AiAssistantAuthFilter(AiAssistantProperties properties) {
        this.contextPath = properties.getContextPath();
        this.accessToken = properties.getAccessToken();
        this.allowQueryTokenAuth = properties.isAllowQueryTokenAuth();
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

        if (path.equals(contextPath + "/health") && !"true".equals(request.getParameter("deep"))) {
            chain.doFilter(req, res);
            return;
        }

        if ("OPTIONS".equalsIgnoreCase(request.getMethod())) {
            chain.doFilter(req, res);
            return;
        }

        String token = request.getHeader("X-AI-Token");
        if (allowQueryTokenAuth && (token == null || token.isBlank())) {
            token = request.getParameter("token");
        }

        byte[] expected = accessToken.getBytes(StandardCharsets.UTF_8);
        byte[] got = token == null ? null : token.getBytes(StandardCharsets.UTF_8);
        if (got == null || !MessageDigest.isEqual(expected, got)) {
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
}
