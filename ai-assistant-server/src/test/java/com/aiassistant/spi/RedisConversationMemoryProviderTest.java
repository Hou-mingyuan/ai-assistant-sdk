package com.aiassistant.spi;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.endsWith;
import static org.mockito.Mockito.atLeast;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.aiassistant.memory.ConversationMemory;
import java.time.Duration;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

@SuppressWarnings({"unchecked", "rawtypes"})
class RedisConversationMemoryProviderTest {

    private StringRedisTemplate redis;
    private ValueOperations valueOps;
    private RedisConversationMemoryProvider provider;

    @BeforeEach
    void setUp() {
        redis = mock(StringRedisTemplate.class);
        valueOps = mock(ValueOperations.class);
        when(redis.opsForValue()).thenReturn(valueOps);
        provider = new RedisConversationMemoryProvider(redis, 20);
    }

    @Test
    void getMemory_loadsFromRedis() {
        when(valueOps.get(endsWith(":messages")))
                .thenReturn("[{\"role\":\"user\",\"content\":\"hi\"}]");
        when(valueOps.get(endsWith(":facts"))).thenReturn(null);

        ConversationMemory memory = provider.getMemory("s1");

        assertEquals(1, memory.getShortTermHistory().size());
        assertEquals("hi", memory.getShortTermHistory().get(0).content());
    }

    @Test
    void getMemory_failsOpenToTransientEmptyAndDoesNotCache() {
        when(valueOps.get(anyString())).thenThrow(new RuntimeException("redis down"));

        ConversationMemory first = provider.getMemory("s1");
        ConversationMemory second = provider.getMemory("s1");

        assertNotNull(first);
        assertTrue(first.getShortTermHistory().isEmpty());
        assertNotNull(second);
        // Not cached on failure: each call retries Redis so recovery is picked up automatically.
        verify(valueOps, atLeast(2)).get(anyString());
    }

    @Test
    void hasMemory_failsOpenToFalseWhenRedisThrows() {
        when(redis.hasKey(anyString())).thenThrow(new RuntimeException("redis down"));
        assertFalse(provider.hasMemory("s1"));
    }

    @Test
    void hasMemory_trueWhenKeyExists() {
        when(redis.hasKey(endsWith(":messages"))).thenReturn(true);
        assertTrue(provider.hasMemory("s1"));
    }

    @Test
    void removeMemory_doesNotThrowWhenRedisFails() {
        when(redis.delete(anyString())).thenThrow(new RuntimeException("redis down"));
        assertDoesNotThrow(() -> provider.removeMemory("s1"));
    }

    @Test
    void flush_persistsCachedMemoryToRedis() {
        when(valueOps.get(anyString())).thenReturn(null);
        ConversationMemory memory = provider.getMemory("s1");
        memory.addUserMessage("hello");

        provider.flush("s1");

        verify(valueOps, times(2)).set(anyString(), anyString(), any(Duration.class));
    }
}
