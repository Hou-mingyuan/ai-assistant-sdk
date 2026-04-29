package com.aiassistant.stats;

import static org.junit.jupiter.api.Assertions.*;

import java.util.Map;
import org.junit.jupiter.api.Test;

class UsageStatsTest {

    @Test
    void recordCallIncrementsCounters() {
        UsageStats stats = new UsageStats();
        stats.recordCall("chat");
        stats.recordCall("chat");
        stats.recordCall("translate");

        Map<String, Object> snapshot = stats.getSnapshot();
        assertEquals(3L, snapshot.get("totalCalls"));
        assertEquals(0L, snapshot.get("totalErrors"));

        @SuppressWarnings("unchecked")
        Map<String, Long> actions = (Map<String, Long>) snapshot.get("callsByAction");
        assertEquals(2L, actions.get("chat"));
        assertEquals(1L, actions.get("translate"));
    }

    @Test
    void recordErrorIncrements() {
        UsageStats stats = new UsageStats();
        stats.recordError();
        stats.recordError();
        assertEquals(2L, stats.getSnapshot().get("totalErrors"));
    }

    @Test
    void resetClearsAll() {
        UsageStats stats = new UsageStats();
        stats.recordCall("chat");
        stats.recordError();
        stats.reset();
        assertEquals(0L, stats.getSnapshot().get("totalCalls"));
        assertEquals(0L, stats.getSnapshot().get("totalErrors"));
    }

    @Test
    void snapshotIncludesToday() {
        UsageStats stats = new UsageStats();
        stats.recordCall("test");

        @SuppressWarnings("unchecked")
        Map<String, Long> daily = (Map<String, Long>) stats.getSnapshot().get("callsByDate");
        assertFalse(daily.isEmpty());
    }
}
