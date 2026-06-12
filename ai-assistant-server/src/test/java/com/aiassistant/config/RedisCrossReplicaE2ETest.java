package com.aiassistant.config;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;

import com.aiassistant.model.SessionData;
import com.aiassistant.service.RedisSessionStore;
import com.aiassistant.service.SessionStore;
import com.aiassistant.stats.RedisTokenUsageTracker;
import com.aiassistant.stats.TokenUsageTracker;
import jakarta.servlet.FilterChain;
import java.util.concurrent.atomic.AtomicLong;
import java.util.function.LongSupplier;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.connection.lettuce.LettuceConnectionFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

/**
 * End-to-end cross-replica consistency against a real Redis (Testcontainers). Validates the runbook
 * "cross-replica verification" step with the real Lua scripts and real Redis data structures.
 *
 * <p>Automatically skipped when Docker is unavailable, so it never breaks Docker-less environments.
 * Each test uses unique client/tenant/user ids, so the shared container needs no flush between
 * tests.
 */
@Testcontainers(disabledWithoutDocker = true)
class RedisCrossReplicaE2ETest {

    @Container
    static final GenericContainer<?> REDIS =
            new GenericContainer<>(DockerImageName.parse("redis:7-alpine")).withExposedPorts(6379);

    private LettuceConnectionFactory connectionFactory;
    private StringRedisTemplate template;

    @BeforeEach
    void setUp() {
        connectionFactory =
                new LettuceConnectionFactory(REDIS.getHost(), REDIS.getMappedPort(6379));
        connectionFactory.afterPropertiesSet();
        template = new StringRedisTemplate(connectionFactory);
        template.afterPropertiesSet();
    }

    @AfterEach
    void tearDown() {
        if (connectionFactory != null) {
            connectionFactory.destroy();
        }
    }

    private RedisRateLimitFilter rateLimitFilter(int limit, LongSupplier clock) {
        AiAssistantProperties props = new AiAssistantProperties();
        props.setRateLimit(limit);
        return new RedisRateLimitFilter(props, template, clock);
    }

    private boolean sendChat(RedisRateLimitFilter filter, String ip) throws Exception {
        MockHttpServletRequest req = new MockHttpServletRequest("POST", "/ai-assistant/chat");
        req.setRemoteAddr(ip);
        MockHttpServletResponse res = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);
        filter.doFilter(req, res, chain);
        return res.getStatus() != 429;
    }

    @Test
    void rateLimit_enforcedGloballyAcrossReplicas() throws Exception {
        AtomicLong clock = new AtomicLong(1_000_000);
        RedisRateLimitFilter replicaA = rateLimitFilter(3, clock::get);
        RedisRateLimitFilter replicaB = rateLimitFilter(3, clock::get);
        String ip = "10.0.0.1";

        assertTrue(sendChat(replicaA, ip));
        assertTrue(sendChat(replicaB, ip));
        assertTrue(sendChat(replicaA, ip));
        assertFalse(sendChat(replicaB, ip), "4th request across replicas must be blocked globally");
    }

    @Test
    void rateLimit_slidingWindowReleasesAfterWindow() throws Exception {
        AtomicLong clock = new AtomicLong(5_000_000);
        RedisRateLimitFilter filter = rateLimitFilter(2, clock::get);
        String ip = "10.0.0.2";

        assertTrue(sendChat(filter, ip));
        assertTrue(sendChat(filter, ip));
        assertFalse(sendChat(filter, ip)); // still within the trailing 60s window

        clock.addAndGet(60_001); // slide past the window
        assertTrue(sendChat(filter, ip), "capacity frees up after the window slides");
    }

    @Test
    void tokenQuota_enforcedGloballyAcrossReplicas() {
        TokenUsageTracker replicaA = new RedisTokenUsageTracker(template);
        TokenUsageTracker replicaB = new RedisTokenUsageTracker(template);
        String tenant = "e2e-tenant-1";
        replicaA.setQuota(tenant, 100);

        assertTrue(replicaA.tryReserveQuota(tenant, 60)); // reserved = 60
        assertTrue(replicaB.tryReserveQuota(tenant, 30)); // reserved = 90 (B sees A's reservation)
        assertFalse(replicaB.tryReserveQuota(tenant, 30)); // 90 + 30 > 100 -> rejected
        assertTrue(replicaA.tryReserveQuota(tenant, 10)); // reserved = 100 (exact boundary)
        assertFalse(replicaB.tryReserveQuota(tenant, 1)); // 100 + 1 > 100 -> globally consistent
    }

    @Test
    void session_visibleAcrossReplicas() {
        SessionStore replicaA = new RedisSessionStore(template);
        SessionStore replicaB = new RedisSessionStore(template);
        String user = "e2e-user-1";
        SessionData input = new SessionData();
        input.setTitle("from A");

        SessionData created = replicaA.create(user, input);
        assertNotNull(created.getId());

        SessionData seenByB = replicaB.get(user, created.getId());
        assertNotNull(seenByB, "session created on replica A must be visible on replica B");
        assertEquals("from A", seenByB.getTitle());
        assertEquals(1, replicaB.list(user).size());
    }
}
