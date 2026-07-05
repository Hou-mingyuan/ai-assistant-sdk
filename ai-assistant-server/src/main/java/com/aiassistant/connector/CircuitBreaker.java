package com.aiassistant.connector;

import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.atomic.AtomicReference;
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

    private final AtomicReference<State> state = new AtomicReference<>(State.CLOSED);
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
        State s = state.get();
        if (s == State.CLOSED) {
            return true;
        }
        if (s == State.OPEN) {
            // 冷却到期后，只有第一个 CAS 成功的线程能进入 HALF_OPEN 充当探针，其余请求仍被拒绝，
            // 避免后端刚恢复就被半开期的并发请求一拥而上再次打挂（惊群）。
            if (System.currentTimeMillis() - openedAt.get() >= openDurationMs
                    && state.compareAndSet(State.OPEN, State.HALF_OPEN)) {
                log.info("CircuitBreaker [{}] OPEN → HALF_OPEN, allowing single probe", name);
                return true;
            }
            return false;
        }
        // HALF_OPEN：已有探针在途，拒绝其余请求，直到探针 recordSuccess/recordFailure 决定下一状态。
        return false;
    }

    void recordSuccess() {
        State prev = state.getAndSet(State.CLOSED);
        consecutiveFailures.set(0);
        if (prev != State.CLOSED) {
            log.info("CircuitBreaker [{}] → CLOSED (success)", name);
        }
    }

    void recordFailure() {
        int failures = consecutiveFailures.incrementAndGet();
        if (state.get() == State.HALF_OPEN) {
            // 半开探针失败：重置冷却窗口后再次打开。先写 openedAt 再写 state，
            // 保证任何看到 OPEN 的线程都能读到最新的冷却起点。
            openedAt.set(System.currentTimeMillis());
            state.set(State.OPEN);
            log.warn(
                    "CircuitBreaker [{}] HALF_OPEN probe failed → OPEN, cooldown {}ms",
                    name,
                    openDurationMs);
            return;
        }
        if (failures >= failureThreshold && state.get() == State.CLOSED) {
            openedAt.set(System.currentTimeMillis());
            if (state.compareAndSet(State.CLOSED, State.OPEN)) {
                log.warn(
                        "CircuitBreaker [{}] → OPEN after {} consecutive failures, cooldown {}ms",
                        name,
                        failures,
                        openDurationMs);
            }
        }
    }

    State getState() {
        return state.get();
    }

    String getName() {
        return name;
    }
}
