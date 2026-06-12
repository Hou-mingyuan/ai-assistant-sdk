package com.aiassistant.util;

import java.util.concurrent.atomic.AtomicLong;
import java.util.function.LongSupplier;
import org.slf4j.Logger;

/**
 * Emits a warning at most once per interval so a sustained failure (for example a Redis outage
 * under load) cannot flood the logs. The first call always logs; subsequent calls within the
 * interval are suppressed. Thread-safe; create one instance per component / call-site.
 */
public final class ThrottledWarnLogger {

    private static final long NEVER = Long.MIN_VALUE;

    private final Logger log;
    private final long intervalMs;
    private final LongSupplier clock;
    private final AtomicLong lastWarnAt = new AtomicLong(NEVER);

    public ThrottledWarnLogger(Logger log, long intervalMs) {
        this(log, intervalMs, System::currentTimeMillis);
    }

    /** Test seam: inject a deterministic clock. */
    ThrottledWarnLogger(Logger log, long intervalMs, LongSupplier clock) {
        this.log = log;
        this.intervalMs = Math.max(0, intervalMs);
        this.clock = clock;
    }

    /**
     * Logs {@code message} (SLF4J {@code {}} placeholders) at most once per interval. Returns
     * {@code true} when this call actually emitted a log line.
     */
    public boolean warn(String message, Object... args) {
        long now = clock.getAsLong();
        long prev = lastWarnAt.get();
        boolean due = prev == NEVER || now - prev >= intervalMs;
        if (due && lastWarnAt.compareAndSet(prev, now)) {
            log.warn(message, args);
            return true;
        }
        return false;
    }
}
