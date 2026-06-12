package com.aiassistant.config;

import com.aiassistant.util.ThrottledWarnLogger;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ThreadLocalRandom;
import java.util.function.LongSupplier;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;

/**
 * Redis-backed sliding-window rate limiter, drop-in replacement for the in-memory {@link
 * RateLimitFilter}.
 *
 * <p>Uses a Lua script for atomic increment + TTL, supporting multi-instance deployment.
 *
 * <pre>{@code
 * @Bean
 * public FilterRegistrationBean<RedisRateLimitFilter> aiAssistantRateLimitFilter(
 *         AiAssistantProperties props, StringRedisTemplate redis) {
 *     var reg = new FilterRegistrationBean<>(new RedisRateLimitFilter(props, redis));
 *     reg.addUrlPatterns(props.getContextPath() + "/*");
 *     reg.setOrder(0);
 *     return reg;
 * }
 * }</pre>
 */
public class RedisRateLimitFilter implements Filter {

    /**
     * Sliding-window log via a per-client ZSET: drop entries older than the window, count what
     * remains, and only admit (ZADD) when below the limit. Unlike a fixed-window counter this caps
     * requests in ANY trailing 60s window, so it cannot be bypassed by bursting across the window
     * boundary. Atomic and cross-replica consistent because every step runs in one Lua call.
     *
     * <p>KEYS[1]=zset key; ARGV = now(ms), window(ms), limit, member(unique), ttl(ms).
     */
    private static final String LUA_SCRIPT =
            "local now = tonumber(ARGV[1]) "
                    + "local window = tonumber(ARGV[2]) "
                    + "local limit = tonumber(ARGV[3]) "
                    + "redis.call('ZREMRANGEBYSCORE', KEYS[1], 0, now - window) "
                    + "local count = redis.call('ZCARD', KEYS[1]) "
                    + "if count >= limit then return 0 end "
                    + "redis.call('ZADD', KEYS[1], now, ARGV[4]) "
                    + "redis.call('PEXPIRE', KEYS[1], tonumber(ARGV[5])) "
                    + "return 1";

    private static final long WINDOW_MS = 60_000;

    private static final Logger log = LoggerFactory.getLogger(RedisRateLimitFilter.class);

    private final String contextPath;
    private final AiAssistantProperties properties;
    private final StringRedisTemplate redis;
    private final DefaultRedisScript<Long> script;
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final ThrottledWarnLogger warnLog = new ThrottledWarnLogger(log, 30_000);
    private final LongSupplier clock;

    public RedisRateLimitFilter(
            AiAssistantProperties properties, StringRedisTemplate redisTemplate) {
        this(properties, redisTemplate, System::currentTimeMillis);
    }

    /** Test seam: inject a deterministic clock to exercise sliding-window boundaries. */
    RedisRateLimitFilter(
            AiAssistantProperties properties,
            StringRedisTemplate redisTemplate,
            LongSupplier clock) {
        this.contextPath = properties.getContextPath();
        this.properties = properties;
        this.redis = redisTemplate;
        this.script = new DefaultRedisScript<>(LUA_SCRIPT, Long.class);
        this.clock = clock;
    }

    @Override
    public void doFilter(ServletRequest req, ServletResponse res, FilterChain chain)
            throws IOException, ServletException {
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
        if ("GET".equalsIgnoreCase(request.getMethod()) && !path.endsWith("/url-preview")) {
            chain.doFilter(req, res);
            return;
        }
        String action = inferAction(path);
        int effectiveLimit = properties.resolveRateLimit(action);
        if (effectiveLimit <= 0) {
            chain.doFilter(req, res);
            return;
        }
        String clientKey = "ai-rl:" + getClientKey(request) + ":" + action;
        long now = clock.getAsLong();
        String member = now + "-" + ThreadLocalRandom.current().nextLong();
        Long allowed;
        try {
            allowed =
                    redis.execute(
                            script,
                            List.of(clientKey),
                            String.valueOf(now),
                            String.valueOf(WINDOW_MS),
                            String.valueOf(effectiveLimit),
                            member,
                            String.valueOf(WINDOW_MS));
        } catch (RuntimeException e) {
            // Fail-open: a Redis outage must not block all traffic. Allow the request and warn
            // (throttled). The upstream gateway / API limiter remains the hard ceiling.
            warnLog.warn(
                    "Redis rate limiter unavailable, failing open (allowing requests): {}",
                    e.getMessage());
            chain.doFilter(req, res);
            return;
        }
        if (allowed == null || allowed == 0) {
            HttpServletResponse response = (HttpServletResponse) res;
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

    private static String inferAction(String path) {
        if (path.endsWith("/chat")) return "chat";
        if (path.endsWith("/stream")) return "stream";
        if (path.endsWith("/export")) return "export";
        if (path.endsWith("/url-preview")) return "url-preview";
        if (path.contains("/file/")) return "file";
        return "other";
    }

    private String getClientKey(HttpServletRequest request) {
        return com.aiassistant.util.ClientIdentity.resolve(request);
    }
}
