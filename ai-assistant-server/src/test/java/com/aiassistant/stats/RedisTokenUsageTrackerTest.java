package com.aiassistant.stats;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.connection.StringRedisConnection;
import org.springframework.data.redis.core.HashOperations;
import org.springframework.data.redis.core.RedisCallback;
import org.springframework.data.redis.core.SetOperations;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.data.redis.core.script.RedisScript;

@SuppressWarnings({"unchecked", "rawtypes"})
class RedisTokenUsageTrackerTest {

    private static final String QUOTA_KEY = "ai-usage:quota";

    private StringRedisTemplate redis;
    private HashOperations hashOps;
    private ValueOperations valueOps;
    private SetOperations setOps;
    private RedisTokenUsageTracker tracker;

    @BeforeEach
    void setUp() {
        redis = mock(StringRedisTemplate.class);
        hashOps = mock(HashOperations.class);
        valueOps = mock(ValueOperations.class);
        setOps = mock(SetOperations.class);
        when(redis.opsForHash()).thenReturn(hashOps);
        when(redis.opsForValue()).thenReturn(valueOps);
        when(redis.opsForSet()).thenReturn(setOps);
        tracker = new RedisTokenUsageTracker(redis);
    }

    @Test
    void setQuota_writesHashFieldAndDeletesWhenZero() {
        tracker.setQuota("t1", 1000);
        verify(hashOps).put(QUOTA_KEY, "t1", "1000");

        tracker.setQuota("t1", 0);
        verify(hashOps).delete(QUOTA_KEY, "t1");
    }

    @Test
    void recordUsage_pipelinesIncrementsAndRegistersTenant() {
        StringRedisConnection conn = mock(StringRedisConnection.class);
        when(redis.executePipelined(any(RedisCallback.class)))
                .thenAnswer(
                        inv -> {
                            RedisCallback<?> cb = inv.getArgument(0);
                            cb.doInRedis(conn);
                            return java.util.List.of();
                        });

        tracker.recordUsage("t1", "gpt-4", 100, 50);

        verify(conn).sAdd(argThat(k -> k.startsWith("ai-usage:tenants:")), eq("t1"));
        verify(conn).hIncrBy(argThat(k -> k.startsWith("ai-usage:u:{t1}:")), eq("total"), eq(150L));
        verify(conn)
                .hIncrBy(argThat(k -> k.startsWith("ai-usage:u:{t1}:")), eq("m:gpt-4"), eq(150L));
        verify(conn).hIncrBy(eq("ai-usage:g"), anyString(), eq(150L));
    }

    @Test
    void tryReserveQuota_trueWhenNoQuotaConfigured_skipsScript() {
        when(hashOps.get(QUOTA_KEY, "t2")).thenReturn(null);

        assertTrue(tracker.tryReserveQuota("t2", 100));
        verify(redis, never()).execute(any(RedisScript.class), anyList(), any(), any(), any());
    }

    @Test
    void tryReserveQuota_trueWhenScriptAllows() {
        when(hashOps.get(QUOTA_KEY, "t1")).thenReturn("1000");
        when(redis.execute(any(RedisScript.class), anyList(), any(), any(), any())).thenReturn(1L);

        assertTrue(tracker.tryReserveQuota("t1", 100));
    }

    @Test
    void tryReserveQuota_falseWhenScriptRejects() {
        when(hashOps.get(QUOTA_KEY, "t1")).thenReturn("500");
        when(redis.execute(any(RedisScript.class), anyList(), any(), any(), any())).thenReturn(0L);

        assertFalse(tracker.tryReserveQuota("t1", 600));
    }

    @Test
    void tryReserveQuota_failsOpenWhenRedisThrows() {
        when(hashOps.get(QUOTA_KEY, "t1")).thenReturn("500");
        when(redis.execute(any(RedisScript.class), anyList(), any(), any(), any()))
                .thenThrow(new RuntimeException("redis down"));

        assertTrue(tracker.tryReserveQuota("t1", 100));
    }

    @Test
    void remainingQuota_unlimitedWhenNoQuota() {
        when(hashOps.get(QUOTA_KEY, "t9")).thenReturn(null);
        assertEquals(Long.MAX_VALUE, tracker.remainingQuota("t9"));
    }

    @Test
    void remainingQuota_quotaMinusUsedToday() {
        when(hashOps.get(QUOTA_KEY, "t1")).thenReturn("1000");
        when(hashOps.get(argThat(k -> k.toString().startsWith("ai-usage:u:{t1}:")), eq("total")))
                .thenReturn("200");

        assertEquals(800, tracker.remainingQuota("t1"));
    }

    @Test
    void isQuotaExceeded_countsUsedPlusReserved() {
        when(hashOps.get(QUOTA_KEY, "t1")).thenReturn("1000");
        when(hashOps.get(argThat(k -> k.toString().startsWith("ai-usage:u:{t1}:")), eq("total")))
                .thenReturn("600");
        when(valueOps.get(argThat(k -> k != null && k.toString().startsWith("ai-usage:r:{t1}:"))))
                .thenReturn("500");

        assertTrue(tracker.isQuotaExceeded("t1"));
    }

    @Test
    void isQuotaExceeded_falseWhenNoQuota() {
        when(hashOps.get(QUOTA_KEY, "t1")).thenReturn(null);
        assertFalse(tracker.isQuotaExceeded("t1"));
    }

    @Test
    void getSnapshot_buildsFromUsageHashAndQuota() {
        Map<Object, Object> usage = new HashMap<>();
        usage.put("total", "150");
        usage.put("prompt", "100");
        usage.put("completion", "50");
        usage.put("calls", "2");
        usage.put("m:gpt-4", "150");
        when(hashOps.entries(argThat(k -> k.toString().startsWith("ai-usage:u:{t1}:"))))
                .thenReturn(usage);
        when(hashOps.get(QUOTA_KEY, "t1")).thenReturn("1000");

        Map<String, Object> snap = tracker.getSnapshot("t1");

        assertEquals("t1", snap.get("tenantId"));
        assertEquals(150L, snap.get("totalTokens"));
        assertEquals(100L, snap.get("promptTokens"));
        assertEquals(50L, snap.get("completionTokens"));
        assertEquals(2L, snap.get("totalCalls"));
        assertEquals(1000L, snap.get("dailyQuota"));
        assertEquals(850L, snap.get("remainingQuota"));
        Map<?, ?> byModel = (Map<?, ?>) snap.get("byModel");
        assertEquals(150L, byModel.get("gpt-4"));
    }

    @Test
    void getSnapshot_emptyWhenNoUsage() {
        when(hashOps.entries(argThat(k -> k.toString().startsWith("ai-usage:u:{t2}:"))))
                .thenReturn(new HashMap<>());

        Map<String, Object> snap = tracker.getSnapshot("t2");

        assertEquals("t2", snap.get("tenantId"));
        assertEquals(0, snap.get("totalTokens"));
    }

    @Test
    void getSnapshot_failsSafeWhenRedisThrows() {
        when(hashOps.entries(argThat(k -> k.toString().startsWith("ai-usage:u:{t3}:"))))
                .thenThrow(new RuntimeException("redis down"));

        Map<String, Object> snap = tracker.getSnapshot("t3");

        assertEquals(0, snap.get("totalTokens"));
    }

    @Test
    void getTotalTokens_sumsGlobalHash() {
        Map<Object, Object> global = new HashMap<>();
        global.put("2026-06-11", "500");
        global.put("2026-06-12", "300");
        when(hashOps.entries("ai-usage:g")).thenReturn(global);

        assertEquals(800L, tracker.getTotalTokens());
    }

    @Test
    void getTotalTokens_zeroWhenRedisThrows() {
        when(hashOps.entries("ai-usage:g")).thenThrow(new RuntimeException("redis down"));
        assertEquals(0L, tracker.getTotalTokens());
    }

    @Test
    void getGlobalSnapshot_perTenantPlusGlobalTotal() {
        when(setOps.members(argThat(k -> k.toString().startsWith("ai-usage:tenants:"))))
                .thenReturn(Set.of("t1"));
        Map<Object, Object> usage = new HashMap<>();
        usage.put("total", "150");
        when(hashOps.entries(argThat(k -> k.toString().startsWith("ai-usage:u:{t1}:"))))
                .thenReturn(usage);
        when(hashOps.get(QUOTA_KEY, "t1")).thenReturn(null);
        Map<Object, Object> global = new HashMap<>();
        global.put("2026-06-12", "150");
        when(hashOps.entries("ai-usage:g")).thenReturn(global);

        Map<String, Object> snapshot = tracker.getGlobalSnapshot();

        assertEquals(150L, snapshot.get("_globalTotalTokens"));
        assertTrue(snapshot.containsKey("t1"));
        Map<?, ?> t1 = (Map<?, ?>) snapshot.get("t1");
        assertEquals(150L, t1.get("totalTokens"));
    }

    @Test
    void getGlobalSnapshot_stillReturnsTotalWhenTenantsThrows() {
        when(setOps.members(argThat(k -> k.toString().startsWith("ai-usage:tenants:"))))
                .thenThrow(new RuntimeException("redis down"));
        when(hashOps.entries("ai-usage:g")).thenReturn(new HashMap<>());

        Map<String, Object> snapshot = tracker.getGlobalSnapshot();

        assertEquals(0L, snapshot.get("_globalTotalTokens"));
    }

    @Test
    void releaseReservation_executesReleaseScript() {
        when(redis.execute(any(RedisScript.class), anyList(), any())).thenReturn(40L);

        tracker.releaseReservation("t1", 10);

        verify(redis).execute(any(RedisScript.class), anyList(), any());
    }

    @Test
    void releaseReservation_noOpWhenAmountNotPositive() {
        tracker.releaseReservation("t1", 0);
        verify(redis, never()).execute(any(RedisScript.class), anyList(), any());
    }
}
