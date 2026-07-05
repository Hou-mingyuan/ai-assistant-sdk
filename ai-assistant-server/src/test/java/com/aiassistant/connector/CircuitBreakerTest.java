package com.aiassistant.connector;

import static org.junit.jupiter.api.Assertions.*;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;

class CircuitBreakerTest {

    @Test
    void startsInClosedState() {
        CircuitBreaker cb = new CircuitBreaker("test", 3, 5_000);
        assertEquals(CircuitBreaker.State.CLOSED, cb.getState());
        assertTrue(cb.allowRequest());
    }

    @Test
    void opensAfterThresholdFailures() {
        CircuitBreaker cb = new CircuitBreaker("test", 3, 5_000);
        cb.recordFailure();
        assertEquals(CircuitBreaker.State.CLOSED, cb.getState());
        cb.recordFailure();
        assertEquals(CircuitBreaker.State.CLOSED, cb.getState());
        cb.recordFailure();
        assertEquals(CircuitBreaker.State.OPEN, cb.getState());
        assertFalse(cb.allowRequest());
    }

    @Test
    void successResetsFailureCount() {
        CircuitBreaker cb = new CircuitBreaker("test", 3, 5_000);
        cb.recordFailure();
        cb.recordFailure();
        cb.recordSuccess();
        assertEquals(CircuitBreaker.State.CLOSED, cb.getState());
        cb.recordFailure();
        assertEquals(CircuitBreaker.State.CLOSED, cb.getState());
    }

    @Test
    void transitionsFromOpenToHalfOpenAfterCooldown() throws Exception {
        CircuitBreaker cb = new CircuitBreaker("test", 1, 200);
        cb.recordFailure();
        assertEquals(CircuitBreaker.State.OPEN, cb.getState());
        assertFalse(cb.allowRequest());

        Thread.sleep(300);
        assertTrue(cb.allowRequest());
        assertEquals(CircuitBreaker.State.HALF_OPEN, cb.getState());
    }

    @Test
    void halfOpenClosesOnSuccess() throws Exception {
        CircuitBreaker cb = new CircuitBreaker("test", 1, 200);
        cb.recordFailure();
        Thread.sleep(300);
        cb.allowRequest(); // triggers HALF_OPEN
        assertEquals(CircuitBreaker.State.HALF_OPEN, cb.getState());

        cb.recordSuccess();
        assertEquals(CircuitBreaker.State.CLOSED, cb.getState());
        assertTrue(cb.allowRequest());
    }

    @Test
    void halfOpenReopensOnFailure() throws Exception {
        CircuitBreaker cb = new CircuitBreaker("test", 1, 200);
        cb.recordFailure();
        Thread.sleep(300);
        cb.allowRequest(); // triggers HALF_OPEN

        cb.recordFailure();
        assertEquals(CircuitBreaker.State.OPEN, cb.getState());
        assertFalse(cb.allowRequest());
    }

    @Test
    void thresholdClampsToMinimumOne() {
        CircuitBreaker cb = new CircuitBreaker("test", 0, 5_000);
        cb.recordFailure();
        assertEquals(CircuitBreaker.State.OPEN, cb.getState());
    }

    @Test
    void openDurationClampsToMinimum() {
        CircuitBreaker cb = new CircuitBreaker("test", 1, 100);
        cb.recordFailure();
        assertEquals(CircuitBreaker.State.OPEN, cb.getState());
    }

    @Test
    void defaultConstructorUsesReasonableDefaults() {
        CircuitBreaker cb = new CircuitBreaker("default");
        assertEquals("default", cb.getName());
        assertEquals(CircuitBreaker.State.CLOSED, cb.getState());
        for (int i = 0; i < 4; i++) cb.recordFailure();
        assertEquals(CircuitBreaker.State.CLOSED, cb.getState());
        cb.recordFailure();
        assertEquals(CircuitBreaker.State.OPEN, cb.getState());
    }

    @Test
    void halfOpenRejectsFurtherRequestsUntilProbeResolves() throws Exception {
        CircuitBreaker cb = new CircuitBreaker("test", 1, 100);
        cb.recordFailure();
        Thread.sleep(150);

        assertTrue(cb.allowRequest(), "first request after cooldown is the probe");
        assertEquals(CircuitBreaker.State.HALF_OPEN, cb.getState());
        assertFalse(
                cb.allowRequest(), "further requests are rejected while the probe is in flight");

        cb.recordSuccess();
        assertEquals(CircuitBreaker.State.CLOSED, cb.getState());
        assertTrue(cb.allowRequest());
    }

    @Test
    void halfOpenAllowsExactlyOneConcurrentProbe() throws Exception {
        CircuitBreaker cb = new CircuitBreaker("test", 1, 100);
        cb.recordFailure();
        assertEquals(CircuitBreaker.State.OPEN, cb.getState());
        Thread.sleep(150); // cooldown elapsed; next call(s) may probe

        int threads = 32;
        ExecutorService pool = Executors.newFixedThreadPool(threads);
        try {
            CountDownLatch ready = new CountDownLatch(threads);
            CountDownLatch start = new CountDownLatch(1);
            AtomicInteger allowed = new AtomicInteger();
            List<Future<?>> futures = new ArrayList<>();
            for (int i = 0; i < threads; i++) {
                futures.add(
                        pool.submit(
                                () -> {
                                    ready.countDown();
                                    try {
                                        start.await();
                                    } catch (InterruptedException e) {
                                        Thread.currentThread().interrupt();
                                        return;
                                    }
                                    if (cb.allowRequest()) {
                                        allowed.incrementAndGet();
                                    }
                                }));
            }
            ready.await();
            start.countDown(); // release every thread at once
            for (Future<?> f : futures) {
                f.get();
            }
            assertEquals(1, allowed.get(), "exactly one probe must pass in HALF_OPEN");
            assertEquals(CircuitBreaker.State.HALF_OPEN, cb.getState());
        } finally {
            pool.shutdownNow();
            assertTrue(pool.awaitTermination(5, TimeUnit.SECONDS));
        }
    }
}
