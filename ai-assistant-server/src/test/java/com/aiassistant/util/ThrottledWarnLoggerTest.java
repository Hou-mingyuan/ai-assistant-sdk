package com.aiassistant.util;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;

import java.util.concurrent.atomic.AtomicLong;
import org.junit.jupiter.api.Test;
import org.slf4j.Logger;

class ThrottledWarnLoggerTest {

    private static ThrottledWarnLogger throttled(long intervalMs, AtomicLong clock) {
        return new ThrottledWarnLogger(mock(Logger.class), intervalMs, clock::get);
    }

    @Test
    void firstCallAlwaysWarnsRegardlessOfClockBase() {
        // Clock base 0 must still fire on the first call (production uses epoch millis).
        AtomicLong clock = new AtomicLong(0);
        assertTrue(throttled(30_000, clock).warn("boom: {}", "x"));
    }

    @Test
    void suppressesRepeatWithinInterval() {
        AtomicLong clock = new AtomicLong(1_000);
        ThrottledWarnLogger t = throttled(30_000, clock);

        assertTrue(t.warn("boom"));
        clock.set(20_000); // still inside the 30s window
        assertFalse(t.warn("boom"));
    }

    @Test
    void warnsAgainAfterIntervalElapses() {
        AtomicLong clock = new AtomicLong(1_000);
        ThrottledWarnLogger t = throttled(30_000, clock);

        assertTrue(t.warn("boom"));
        clock.set(40_000); // past the window
        assertTrue(t.warn("boom"));
    }

    @Test
    void zeroIntervalNeverSuppresses() {
        AtomicLong clock = new AtomicLong(5_000);
        ThrottledWarnLogger t = throttled(0, clock);

        assertTrue(t.warn("boom"));
        assertTrue(t.warn("boom")); // same instant, interval 0 -> still fires
    }
}
