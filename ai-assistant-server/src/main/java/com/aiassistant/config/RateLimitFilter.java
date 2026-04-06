package com.aiassistant.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

public class RateLimitFilter implements Filter {

    private final String contextPath;
    private final int maxRequestsPerMinute;
    private final ConcurrentHashMap<String, RateEntry> counters = new ConcurrentHashMap<>();
    private final ObjectMapper objectMapper = new ObjectMapper();

    public RateLimitFilter(AiAssistantProperties properties) {
        this.contextPath = properties.getContextPath();
        this.maxRequestsPerMinute = properties.getRateLimit();
    }

    private volatile long lastCleanup = System.currentTimeMillis();

    @Override
    public void doFilter(ServletRequest req, ServletResponse res, FilterChain chain)
            throws IOException, ServletException {

        cleanupIfNeeded();

        if (maxRequestsPerMinute <= 0) {
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

        String clientKey = getClientKey(request);
        RateEntry entry = counters.computeIfAbsent(clientKey, k -> new RateEntry());

        if (entry.isExceeded(maxRequestsPerMinute)) {
            HttpServletResponse response = (HttpServletResponse) res;
            response.setStatus(429);
            response.setContentType("application/json;charset=UTF-8");
            objectMapper.writeValue(response.getOutputStream(),
                    Map.of("success", false, "error", "Rate limit exceeded. Max " + maxRequestsPerMinute + " requests/min."));
            return;
        }

        entry.increment();
        chain.doFilter(req, res);
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
        private final AtomicInteger count = new AtomicInteger(0);
        private volatile long windowStart = System.currentTimeMillis();

        boolean isExceeded(int max) {
            resetIfNeeded();
            return count.get() >= max;
        }

        void increment() {
            resetIfNeeded();
            count.incrementAndGet();
        }

        private void resetIfNeeded() {
            long now = System.currentTimeMillis();
            if (now - windowStart > 60_000) {
                synchronized (this) {
                    if (now - windowStart > 60_000) {
                        count.set(0);
                        windowStart = now;
                    }
                }
            }
        }
    }
}
