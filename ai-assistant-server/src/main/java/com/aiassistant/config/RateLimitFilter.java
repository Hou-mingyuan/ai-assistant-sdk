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
 *
 * <p>Client identity is resolved as: (1) {@code X-AI-Token} header if present; (2) a trusted client
 * IP derived from {@code X-Forwarded-For} only when {@code
 * ai-assistant.security.trusted-proxy-hops} is set; (3) {@code request.getRemoteAddr()} fallback.
 *
 * <p><b>Deployment note:</b> {@code X-Forwarded-For} is spoofable, so it is ignored by default
 * (trusted-proxy-hops = 0) and {@code remoteAddr} is authoritative. When deploying behind N trusted
 * reverse proxies (Nginx / ALB / etc.), set {@code ai-assistant.security.trusted-proxy-hops=N} so
 * the real client IP is taken from the trusted (right-hand) side of the chain and cannot be forged.
 */
public class RateLimitFilter implements Filter {

    private final String contextPath;
    private final int maxRequestsPerMinute;
    private final AiAssistantProperties properties;
    private static final int MAX_TRACKED_CLIENTS = 10_000;
    private final ConcurrentHashMap<String, RateEntry> counters = new ConcurrentHashMap<>();
    private final ObjectMapper objectMapper = new ObjectMapper();

    public RateLimitFilter(AiAssistantProperties properties) {
        this.contextPath = properties.getContextPath();
        this.maxRequestsPerMinute = properties.getRateLimit();
        this.properties = properties;
    }

    private final java.util.concurrent.atomic.AtomicLong lastCleanup =
            new java.util.concurrent.atomic.AtomicLong(System.currentTimeMillis());

    @Override
    public void doFilter(ServletRequest req, ServletResponse res, FilterChain chain)
            throws IOException, ServletException {

        cleanupIfNeeded();

        boolean hasPerAction =
                properties.getRateLimitPerAction() != null
                        && !properties.getRateLimitPerAction().isEmpty();
        if (maxRequestsPerMinute <= 0 && !hasPerAction) {
            chain.doFilter(req, res);
            return;
        }

        HttpServletRequest request = (HttpServletRequest) req;
        String path = request.getRequestURI();

        if (!RequestPathMatcher.matchesContextPath(path, contextPath)
                || path.endsWith("/health")
                || path.endsWith("/stats")) {
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
        if (counters.size() >= MAX_TRACKED_CLIENTS && !counters.containsKey(clientKey)) {
            cleanupIfNeeded();
            // If still full after cleanup, evict the least-recently-active entries instead of
            // rejecting the newcomer with 429. Rejecting new clients would let an attacker who
            // floods the table with distinct client keys lock out every legitimate newcomer (an
            // availability DoS). Eviction is ordered by windowStart, so a key that is actively
            // hitting the limit (freshest windowStart) is never the one dropped.
            if (counters.size() >= MAX_TRACKED_CLIENTS) {
                evictOldest(counters.size() - MAX_TRACKED_CLIENTS + (MAX_TRACKED_CLIENTS / 10));
            }
        }
        RateEntry entry = counters.computeIfAbsent(clientKey, k -> new RateEntry());

        RateEntry.AcquireResult ar = entry.tryAcquireWithInfo(effectiveLimit);
        HttpServletResponse response = (HttpServletResponse) res;
        response.setIntHeader("X-RateLimit-Limit", effectiveLimit);
        response.setIntHeader("X-RateLimit-Remaining", Math.max(0, effectiveLimit - ar.count()));
        response.setHeader("X-RateLimit-Reset", String.valueOf(ar.windowResetEpochSeconds()));

        if (!ar.allowed()) {
            response.setStatus(429);
            response.setContentType("application/json;charset=UTF-8");
            objectMapper.writeValue(
                    response.getOutputStream(),
                    Map.of(
                            "success",
                            false,
                            "error",
                            "Rate limit exceeded for "
                                    + action
                                    + ". Max "
                                    + effectiveLimit
                                    + " requests/min."));
            return;
        }

        chain.doFilter(req, res);
    }

    private static String inferAction(String path, HttpServletRequest request) {
        if (path.endsWith("/chat")) return "chat";
        if (path.endsWith("/stream")) return "stream";
        if (path.endsWith("/sse")) return "stream";
        if (path.endsWith("/export")) return "export";
        if (path.endsWith("/url-preview")) return "url-preview";
        if (path.contains("/file/")) return "file";
        return "other";
    }

    private String getClientKey(HttpServletRequest request) {
        return com.aiassistant.util.ClientIdentity.resolve(
                request, properties.getTrustedProxyHops());
    }

    private void cleanupIfNeeded() {
        long now = System.currentTimeMillis();
        long prev = lastCleanup.get();
        if (now - prev > 60_000 && lastCleanup.compareAndSet(prev, now)) {
            counters.entrySet().removeIf(e -> now - e.getValue().windowStart > 60_000);
        }
    }

    /**
     * Bounded-memory safeguard: drop the {@code n} least-recently-active counters so the tracking
     * table can still admit new clients under a distinct-key flood. Safe because entries are
     * ordered by last activity ({@code windowStart}); a key that is actively hitting the limit has
     * the freshest timestamp and is never evicted here.
     */
    private void evictOldest(int n) {
        if (n <= 0) return;
        counters.entrySet().stream()
                .sorted(java.util.Comparator.comparingLong(e -> e.getValue().windowStart))
                .limit(n)
                .map(Map.Entry::getKey)
                .forEach(counters::remove);
    }

    /**
     * Per-client <b>sliding-window</b> counter backed by a timestamp log. Only request timestamps
     * within the trailing 60s are retained, so — unlike a fixed window that resets its counter on a
     * boundary — it cannot admit a 2x burst straddling a window edge. Memory per entry is bounded
     * by {@code max} longs (once the limit is hit no further timestamps are appended).
     */
    private static class RateEntry {
        private final java.util.ArrayDeque<Long> timestamps = new java.util.ArrayDeque<>();
        // Last activity time; consumed only by the idle sweep in cleanupIfNeeded()/evictOldest().
        volatile long windowStart = System.currentTimeMillis();

        record AcquireResult(boolean allowed, int count, long windowResetEpochSeconds) {}

        synchronized AcquireResult tryAcquireWithInfo(int max) {
            long now = System.currentTimeMillis();
            long cutoff = now - 60_000;
            while (!timestamps.isEmpty() && timestamps.peekFirst() <= cutoff) {
                timestamps.pollFirst();
            }
            windowStart = now;
            int count = timestamps.size();
            // A slot frees up 60s after the oldest in-window request (true sliding semantics).
            long resetEpoch =
                    timestamps.isEmpty()
                            ? (now + 60_000) / 1000
                            : (timestamps.peekFirst() + 60_000) / 1000;
            if (count >= max) {
                return new AcquireResult(false, count, resetEpoch);
            }
            timestamps.addLast(now);
            return new AcquireResult(true, count + 1, resetEpoch);
        }
    }
}
