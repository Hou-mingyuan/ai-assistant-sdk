package com.aiassistant.config;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;

import jakarta.servlet.FilterChain;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicLong;
import java.util.function.LongSupplier;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.RedisScript;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

/**
 * Cross-replica consistency tests for the sliding-window limiter.
 *
 * <p>Real production atomicity lives in the Lua script on Redis. Here a {@link
 * SharedSlidingWindowRedis} fake reproduces the exact ZSET sliding-window semantics the script
 * implements (since every {@code ZADD} uses a unique member, the set is modeled as a list of
 * timestamps). Two {@link RedisRateLimitFilter} instances share one fake + one clock, which is
 * precisely the "two replicas, one Redis" topology. A full end-to-end test against a real Redis
 * (Testcontainers) is a recommended complement.
 */
class RedisRateLimitFilterSlidingWindowTest {

    /**
     * Faithful in-JVM model of the limiter's Lua ZSET sliding-window for a single shared backend.
     */
    private static class SharedSlidingWindowRedis extends StringRedisTemplate {
        private final Map<String, List<Long>> store = new HashMap<>();

        @Override
        @SuppressWarnings("unchecked")
        public <T> T execute(RedisScript<T> script, List<String> keys, Object... args) {
            long now = Long.parseLong(args[0].toString());
            long window = Long.parseLong(args[1].toString());
            long limit = Long.parseLong(args[2].toString());
            String key = keys.get(0);
            List<Long> timestamps = store.computeIfAbsent(key, k -> new ArrayList<>());
            long cutoff = now - window;
            timestamps.removeIf(t -> t <= cutoff);
            if (timestamps.size() >= limit) {
                return (T) Long.valueOf(0L);
            }
            timestamps.add(now);
            return (T) Long.valueOf(1L);
        }
    }

    private static RedisRateLimitFilter filter(
            StringRedisTemplate redis, int limit, LongSupplier clock) {
        AiAssistantProperties props = new AiAssistantProperties();
        props.setRateLimit(limit);
        return new RedisRateLimitFilter(props, redis, clock);
    }

    /** Drives one POST /chat through the filter; returns true when admitted (not HTTP 429). */
    private static boolean send(RedisRateLimitFilter filter) throws Exception {
        MockHttpServletRequest req = new MockHttpServletRequest("POST", "/ai-assistant/chat");
        req.setRemoteAddr("9.9.9.9");
        MockHttpServletResponse res = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);
        filter.doFilter(req, res, chain);
        return res.getStatus() != 429;
    }

    @Test
    void limitIsEnforcedGloballyAcrossReplicas() throws Exception {
        SharedSlidingWindowRedis redis = new SharedSlidingWindowRedis();
        AtomicLong clock = new AtomicLong(0);
        RedisRateLimitFilter replicaA = filter(redis, 3, clock::get);
        RedisRateLimitFilter replicaB = filter(redis, 3, clock::get);

        assertTrue(send(replicaA)); // 1 (replica A)
        assertTrue(send(replicaB)); // 2 (replica B sees A's request)
        assertTrue(send(replicaA)); // 3
        assertFalse(send(replicaB)); // 4 -> blocked by the shared global limit
        assertFalse(send(replicaA)); // still blocked on the other replica too
    }

    @Test
    void slidingWindowPreventsBoundaryBurst() throws Exception {
        SharedSlidingWindowRedis redis = new SharedSlidingWindowRedis();
        AtomicLong clock = new AtomicLong(0);
        RedisRateLimitFilter filter = filter(redis, 2, clock::get);

        assertTrue(send(filter)); // t=0     -> 1
        assertTrue(send(filter)); // t=0     -> 2

        clock.set(59_999);
        // A fixed-window counter would reset at the 60s boundary and allow a burst here; the
        // sliding window still counts the two recent requests, so this is blocked.
        assertFalse(send(filter)); // t=59999 -> blocked (2 within trailing 60s)

        clock.set(60_001);
        assertTrue(
                send(filter)); // t=60001 -> the t=0 entries aged out, capacity frees one at a time
        assertTrue(send(filter)); // t=60001 -> 2
        assertFalse(send(filter)); // t=60001 -> blocked again
    }
}
