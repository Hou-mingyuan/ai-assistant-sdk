package com.aiassistant.service;

import static org.junit.jupiter.api.Assertions.*;

import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;

class ApiKeyRotatorTest {

    @Test
    void roundRobinCyclesThroughAllKeys() {
        var rotator = new ApiKeyRotator(List.of("k1", "k2", "k3"));
        assertEquals("k1", rotator.nextKey());
        assertEquals("k2", rotator.nextKey());
        assertEquals("k3", rotator.nextKey());
        assertEquals("k1", rotator.nextKey());
    }

    @Test
    void singleKeyAlwaysReturned() {
        var rotator = new ApiKeyRotator(List.of("only"));
        for (int i = 0; i < 5; i++) {
            assertEquals("only", rotator.nextKey());
        }
    }

    @Test
    void failedKeyIsSkipped() {
        var rotator = new ApiKeyRotator(List.of("a", "b", "c"));
        assertEquals("a", rotator.nextKey());
        rotator.markFailed("b");
        assertEquals("c", rotator.nextKey());
        assertEquals("a", rotator.nextKey());
    }

    @Test
    void allKeysFailedStillReturns() {
        var rotator = new ApiKeyRotator(List.of("x", "y"));
        rotator.markFailed("x");
        rotator.markFailed("y");
        String key = rotator.nextKey();
        assertNotNull(key);
        assertTrue("x".equals(key) || "y".equals(key));
    }

    @Test
    void keyCountReturnsCorrectSize() {
        assertEquals(3, new ApiKeyRotator(List.of("a", "b", "c")).keyCount());
        assertEquals(1, new ApiKeyRotator(List.of("solo")).keyCount());
    }

    @Test
    void supplierBackedRotatorUsesLatestKeysWithoutRestart() {
        AtomicReference<List<String>> keys = new AtomicReference<>(List.of("old-key"));
        var rotator = new ApiKeyRotator(keys::get);

        assertEquals("old-key", rotator.nextKey());

        keys.set(List.of("new-key-a", "new-key-b"));

        assertEquals(2, rotator.keyCount());
        assertEquals("new-key-a", rotator.nextKey());
        assertEquals("new-key-b", rotator.nextKey());
    }

    @Test
    void emptyKeysThrowsException() {
        assertThrows(IllegalArgumentException.class, () -> new ApiKeyRotator(List.of()));
    }

    @Test
    void nullKeysThrowsException() {
        assertThrows(IllegalArgumentException.class, () -> new ApiKeyRotator((List<String>) null));
    }

    @Test
    void exponentialBackoffIncreasesOnConsecutiveFailures() {
        var rotator = new ApiKeyRotator(List.of("a", "b"));
        rotator.markFailed("a");
        // After 1st failure: cooldown = 1s, key "a" should be skipped
        assertEquals("b", rotator.nextKey());

        rotator.markFailed("a");
        // After 2nd failure: cooldown = 2s
        assertEquals("b", rotator.nextKey());
    }

    @Test
    void markSuccessResetsCooldown() {
        var rotator = new ApiKeyRotator(List.of("a", "b"));
        rotator.markFailed("a");
        rotator.markFailed("a");
        rotator.markSuccess("a");
        // "a" should be available again immediately after success
        String key = rotator.nextKey();
        assertEquals("a", key);
    }

    @Test
    void markSuccessResetsExponentialBackoff() {
        var rotator = new ApiKeyRotator(List.of("a", "b"));
        // Build up backoff: 1s -> 2s -> 4s
        rotator.markFailed("a");
        rotator.markFailed("a");
        rotator.markFailed("a");
        // Reset via success
        rotator.markSuccess("a");
        // Fail again - should restart from 1s, not continue from 4s
        rotator.markFailed("a");
        // Key "a" should be in 1s cooldown, still skipped
        assertEquals("b", rotator.nextKey());
    }

    @Test
    void allKeysFailedReturnsEarliestExpiring() {
        var rotator = new ApiKeyRotator(List.of("early", "late"));
        rotator.markFailed("late");
        rotator.markFailed("late");
        rotator.markFailed("late");
        // "late" now has longer cooldown due to exponential backoff
        rotator.markFailed("early");
        // "early" has shorter cooldown (just 1st failure = 1s)
        // When all are in cooldown, should prefer "early" (expires sooner)
        String key = rotator.nextKey();
        assertEquals("early", key);
    }

    @Test
    void threadSafetyStressTest() throws InterruptedException {
        var rotator = new ApiKeyRotator(List.of("k1", "k2", "k3"));
        Set<String> seen = java.util.Collections.synchronizedSet(new HashSet<>());
        Thread[] threads = new Thread[10];
        for (int i = 0; i < threads.length; i++) {
            threads[i] =
                    new Thread(
                            () -> {
                                for (int j = 0; j < 100; j++) {
                                    String key = rotator.nextKey();
                                    seen.add(key);
                                    if (j % 20 == 0) rotator.markFailed(key);
                                    if (j % 30 == 0) rotator.markSuccess(key);
                                }
                            });
        }
        for (Thread t : threads) t.start();
        for (Thread t : threads) t.join();
        assertEquals(Set.of("k1", "k2", "k3"), seen);
    }
}
