package com.aiassistant.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;


/**
 * Per-IP / per-token sliding-window rate limiter.
 * <p><b>Deployment note:</b> client IP is derived from {@code X-Forwarded-For} when present,
 * which can be spoofed if the application is directly exposed without a trusted reverse proxy.
 * In production, deploy behind a proxy (Nginx / ALB / etc.) that overwrites {@code X-Forwarded-For}.</p>
 */
public class RateLimitFilter implements Filter {

    private final String contextPath;
    private final int maxRequestsPerMinute;
    private final AiAssistantProperties properties;
    private final ConcurrentHashMap<String, RateEntry> counters = new ConcurrentHashMap<>();
    private final ObjectMapper objectMapper = new ObjectMapper();

    public RateLimitFilter(AiAssistantProperties properties) {
        this.contextPath = properties.getContextPath();
        this.maxRequestsPerMinute = properties.getRateLimit();
        this.properties = properties;
    }

    private volatile long lastCleanup = System.currentTimeMillis();

    @Override
    public void doFilter(ServletRequest req, ServletResponse res, FilterChain chain)
            throws IOException, ServletException {

        cleanupIfNeeded();

        boolean hasPerAction = properties.getRateLimitPerAction() != null && !properties.getRateLimitPerAction().isEmpty();
        if (maxRequestsPerMinute <= 0 && !hasPerAction) {
            chain.doFilter(req, res);
            return;
        }

        HttpServletRequest request = (HttpServletRequest) req;
        String path = request.getRequestURI();

        if (!path.startsWith(contextPath) || path.endsWith("/health") || path.endsWith("/stats")) {
            chain.doFilter(req, res);
            return;
        }

        if ("OPTIONS".equalsIgnoreCase(request.getMethod())) {
            chain.doFilter(req, res);
            return;
        }
        // 大多数 GET 不经统计；url-preview 可被滥用拉外网，纳入与 POST 相同的每分钟配额
        if ("GET".equalsIgnoreCase(request.getMethod()) && !path.endsWith("/url-preview")) {
            chain.doFilter(req, res);
            return;
        }

        String action = inferAction(path, request);
        int effectiveLimit = properties.resolveRateLimit(action);
        if (effectiveLimit <= 0) effectiveLimit = maxRequestsPerMinute;
        if (effectiveLimit <= 0) {
            chain.doFilter(req, res);
            return;
        }

        String clientKey = getClientKey(request) + ":" + action;
        RateEntry entry = counters.computeIfAbsent(clientKey, k -> new RateEntry());

        if (!entry.tryAcquire(effectiveLimit)) {
            HttpServletResponse response = (HttpServletResponse) res;
            response.setStatus(429);
            response.setContentType("application/json;charset=UTF-8");
            objectMapper.writeValue(response.getOutputStream(),
                    Map.of("success", false, "error", "Rate limit exceeded for " + action + ". Max " + effectiveLimit + " requests/min."));
            return;
        }

        chain.doFilter(req, res);
    }

    private static String inferAction(String path, HttpServletRequest request) {
        if (path.endsWith("/chat")) return "chat";
        if (path.endsWith("/stream")) return "stream";
        if (path.endsWith("/export")) return "export";
        if (path.endsWith("/url-preview")) return "url-preview";
        if (path.contains("/file/")) return "file";
        return "other";
    }

    private String getClientKey(HttpServletRequest request) {
        String token = request.getHeader("X-AI-Token");
        if (token != null && !token.isBlank()) return "token:" + token;

        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null) return "ip:" + forwarded.split(",")[0].trim();

        return "ip:" + request.getRemoteAddr();
    }

    private void cleanupIfNeeded() {
        long now = System.currentTimeMillis();
        if (now - lastCleanup > 300_000) {
            lastCleanup = now;
            counters.entrySet().removeIf(e -> now - e.getValue().windowStart > 120_000);
        }
    }

    private static class RateEntry {
        private int count;
        volatile long windowStart = System.currentTimeMillis();

        synchronized boolean tryAcquire(int max) {
            long now = System.currentTimeMillis();
            if (now - windowStart > 60_000) {
                count = 0;
                windowStart = now;
            }
            if (count >= max) {
                return false;
            }
            count++;
            return true;
        }
    }
}
