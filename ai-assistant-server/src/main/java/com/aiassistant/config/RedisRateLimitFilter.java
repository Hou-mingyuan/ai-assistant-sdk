package com.aiassistant.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.List;
import java.util.Map;
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

    private static final String LUA_SCRIPT =
            "local key = KEYS[1] "
                    + "local limit = tonumber(ARGV[1]) "
                    + "local window = tonumber(ARGV[2]) "
                    + "local current = redis.call('INCR', key) "
                    + "if current == 1 then redis.call('EXPIRE', key, window) end "
                    + "if current > limit then return 0 end "
                    + "return 1";

    private final String contextPath;
    private final AiAssistantProperties properties;
    private final StringRedisTemplate redis;
    private final DefaultRedisScript<Long> script;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public RedisRateLimitFilter(
            AiAssistantProperties properties, StringRedisTemplate redisTemplate) {
        this.contextPath = properties.getContextPath();
        this.properties = properties;
        this.redis = redisTemplate;
        this.script = new DefaultRedisScript<>(LUA_SCRIPT, Long.class);
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
        Long allowed =
                redis.execute(script, List.of(clientKey), String.valueOf(effectiveLimit), "60");
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
