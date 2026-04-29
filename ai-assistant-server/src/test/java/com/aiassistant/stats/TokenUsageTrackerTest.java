package com.aiassistant.stats;

import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.Test;

class TokenUsageTrackerTest {

    @Test
    void recordAndSnapshot() {
        var tracker = new TokenUsageTracker();
        tracker.recordUsage("tenant1", "gpt-4", 100, 50);
        tracker.recordUsage("tenant1", "gpt-4", 200, 100);

        var snap = tracker.getSnapshot("tenant1");
        assertEquals(450L, snap.get("totalTokens"));
        assertEquals(300L, snap.get("promptTokens"));
        assertEquals(150L, snap.get("completionTokens"));
        assertEquals(2L, snap.get("totalCalls"));
    }

    @Test
    void quotaEnforcement() {
        var tracker = new TokenUsageTracker();
        tracker.setQuota("t1", 500);
        assertFalse(tracker.isQuotaExceeded("t1"));
        assertEquals(500, tracker.remainingQuota("t1"));

        tracker.recordUsage("t1", "model", 400, 150);
        assertTrue(tracker.isQuotaExceeded("t1"));
        assertEquals(0, tracker.remainingQuota("t1"));
    }

    @Test
    void noQuota_neverExceeded() {
        var tracker = new TokenUsageTracker();
        tracker.recordUsage("t2", "model", 1_000_000, 1_000_000);
        assertFalse(tracker.isQuotaExceeded("t2"));
        assertEquals(Long.MAX_VALUE, tracker.remainingQuota("t2"));
    }

    @Test
    void globalSnapshot_aggregatesAllTenants() {
        var tracker = new TokenUsageTracker();
        tracker.recordUsage("a", "m1", 10, 5);
        tracker.recordUsage("b", "m2", 20, 10);

        var global = tracker.getGlobalSnapshot();
        assertEquals(45L, global.get("_globalTotalTokens"));
    }

    @Test
    void emptyTenant_returnsZero() {
        var tracker = new TokenUsageTracker();
        var snap = tracker.getSnapshot("nonexistent");
        assertEquals(0, snap.get("totalTokens"));
    }
}
