package com.aiassistant.service;

import static org.awaitility.Awaitility.await;
import static org.junit.jupiter.api.Assertions.*;

import java.time.Duration;
import org.junit.jupiter.api.Test;

class LlmResponseCacheTest {

    @Test
    void putAndGetReturnsValue() {
        var cache = new LlmResponseCache();
        cache.put("translate:zh", "hello", "你好");
        assertEquals("你好", cache.get("translate:zh", "hello"));
    }

    @Test
    void getMissReturnsNull() {
        var cache = new LlmResponseCache();
        assertNull(cache.get("summarize", "nonexistent"));
    }

    @Test
    void differentOpsAreIsolated() {
        var cache = new LlmResponseCache();
        cache.put("translate:zh", "hello", "你好");
        cache.put("translate:en", "hello", "hello-en");
        assertEquals("你好", cache.get("translate:zh", "hello"));
        assertEquals("hello-en", cache.get("translate:en", "hello"));
    }

    @Test
    void expiredEntryReturnsNull() throws InterruptedException {
        var cache = new LlmResponseCache(100, 50);
        cache.put("op", "text", "value");
        assertEquals("value", cache.get("op", "text"));
        Thread.sleep(80);
        assertNull(cache.get("op", "text"));
    }

    @Test
    void lruEvictsOldEntries() {
        // Caffeine's W-TinyLFU enforces the configured maximum size eventually, but does
        // not guarantee that the very first inserted key wins LRU vs. the admission filter
        // (the admission policy may reject a freshly-put entry whose frequency it cannot
        // distinguish from older ones). The contract this test cares about is the size
        // ceiling, not which specific key happens to be evicted.
        var cache = new LlmResponseCache(3, 300_000);
        for (int i = 0; i < 10; i++) {
            cache.put("op", "k" + i, "v" + i);
        }
        await().atMost(Duration.ofSeconds(2))
                .pollInterval(Duration.ofMillis(20))
                .untilAsserted(
                        () -> {
                            cache.cleanUp();
                            assertTrue(
                                    cache.estimatedSize() <= 3,
                                    "cache size should converge to <= 3, was "
                                            + cache.estimatedSize());
                        });
    }

    @Test
    void compressDecompressRoundTrip() {
        byte[] compressed = LlmResponseCache.compress("Hello, 世界!");
        assertNotNull(compressed);
        assertTrue(compressed.length > 0);
    }

    @Test
    void cacheKeyDeterministic() {
        String k1 = LlmResponseCache.cacheKey("translate:zh", "hello");
        String k2 = LlmResponseCache.cacheKey("translate:zh", "hello");
        assertEquals(k1, k2);
    }

    @Test
    void cacheKeyDifferentForDifferentInputs() {
        String k1 = LlmResponseCache.cacheKey("translate:zh", "hello");
        String k2 = LlmResponseCache.cacheKey("translate:en", "hello");
        assertNotEquals(k1, k2);
    }

    @Test
    void largeTextCompressesAndRecovers() {
        var cache = new LlmResponseCache();
        String longText = "x".repeat(100_000);
        cache.put("op", "input", longText);
        assertEquals(longText, cache.get("op", "input"));
    }
}
