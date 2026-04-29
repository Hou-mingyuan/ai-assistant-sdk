package com.aiassistant.connector;

import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Lightweight circuit breaker for connector calls. States: CLOSED (normal) → OPEN (fast-fail) →
 * HALF_OPEN (probe).
 */
class CircuitBreaker {

    private static final Logger log = LoggerFactory.getLogger(CircuitBreaker.class);

    enum State {
        CLOSED,
        OPEN,
        HALF_OPEN
    }

    private final String name;
    private final int failureThreshold;
    private final long openDurationMs;

    private volatile State state = State.CLOSED;
    private final AtomicInteger consecutiveFailures = new AtomicInteger(0);
    private final AtomicLong openedAt = new AtomicLong(0);

    CircuitBreaker(String name, int failureThreshold, long openDurationMs) {
        this.name = name;
        this.failureThreshold = Math.max(1, failureThreshold);
        this.openDurationMs = Math.max(100, openDurationMs);
    }

    CircuitBreaker(String name) {
        this(name, 5, 30_000);
    }

    boolean allowRequest() {
        if (state == State.CLOSED) return true;
        if (state == State.OPEN) {
            if (System.currentTimeMillis() - openedAt.get() >= openDurationMs) {
                state = State.HALF_OPEN;
                log.info("CircuitBreaker [{}] OPEN → HALF_OPEN, allowing probe", name);
                return true;
            }
            return false;
        }
        return true;
    }

    void recordSuccess() {
        if (state != State.CLOSED) {
            log.info("CircuitBreaker [{}] → CLOSED (success)", name);
        }
        consecutiveFailures.set(0);
        state = State.CLOSED;
    }

    void recordFailure() {
        int failures = consecutiveFailures.incrementAndGet();
        if (failures >= failureThreshold && state != State.OPEN) {
            state = State.OPEN;
            openedAt.set(System.currentTimeMillis());
            log.warn(
                    "CircuitBreaker [{}] → OPEN after {} consecutive failures, cooldown {}ms",
                    name,
                    failures,
                    openDurationMs);
        }
    }

    State getState() {
        return state;
    }

    String getName() {
        return name;
    }
}
