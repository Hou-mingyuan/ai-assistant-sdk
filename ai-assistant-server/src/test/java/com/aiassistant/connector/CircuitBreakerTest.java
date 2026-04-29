package com.aiassistant.connector;

import static org.junit.jupiter.api.Assertions.*;

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
}
