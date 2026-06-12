package com.aiassistant.config;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.RedisScript;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

@SuppressWarnings({"unchecked", "rawtypes"})
class RedisRateLimitFilterTest {

    private StringRedisTemplate redis;
    private RedisRateLimitFilter filter;

    @BeforeEach
    void setUp() {
        redis = mock(StringRedisTemplate.class);
        AiAssistantProperties properties = new AiAssistantProperties();
        properties.setRateLimit(60);
        filter = new RedisRateLimitFilter(properties, redis);
    }

    private MockHttpServletRequest post(String uri) {
        MockHttpServletRequest req = new MockHttpServletRequest("POST", uri);
        req.setRemoteAddr("1.2.3.4");
        return req;
    }

    @Test
    void failsOpenWhenRedisThrows() throws Exception {
        when(redis.execute(any(RedisScript.class), anyList(), any(), any(), any(), any(), any()))
                .thenThrow(new RuntimeException("redis down"));
        MockHttpServletRequest req = post("/ai-assistant/chat");
        MockHttpServletResponse res = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);

        filter.doFilter(req, res, chain);

        verify(chain).doFilter(req, res);
        assertNotEquals(429, res.getStatus());
    }

    @Test
    void blocksWhenScriptReturnsZero() throws Exception {
        when(redis.execute(any(RedisScript.class), anyList(), any(), any(), any(), any(), any()))
                .thenReturn(0L);
        MockHttpServletRequest req = post("/ai-assistant/chat");
        MockHttpServletResponse res = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);

        filter.doFilter(req, res, chain);

        verify(chain, never()).doFilter(any(), any());
        assertEquals(429, res.getStatus());
    }

    @Test
    void allowsWhenScriptReturnsOne() throws Exception {
        when(redis.execute(any(RedisScript.class), anyList(), any(), any(), any(), any(), any()))
                .thenReturn(1L);
        MockHttpServletRequest req = post("/ai-assistant/chat");
        MockHttpServletResponse res = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);

        filter.doFilter(req, res, chain);

        verify(chain).doFilter(req, res);
        assertNotEquals(429, res.getStatus());
    }

    @Test
    void skipsHealthPathWithoutTouchingRedis() throws Exception {
        MockHttpServletRequest req = new MockHttpServletRequest("GET", "/ai-assistant/health");
        MockHttpServletResponse res = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);

        filter.doFilter(req, res, chain);

        verify(chain).doFilter(req, res);
        verify(redis, never())
                .execute(any(RedisScript.class), anyList(), any(), any(), any(), any(), any());
    }
}
