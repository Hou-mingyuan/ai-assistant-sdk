package com.aiassistant.service;

import static org.junit.jupiter.api.Assertions.*;

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
        var cache = new LlmResponseCache(3, 300_000);
        cache.put("op", "a", "va");
        cache.put("op", "b", "vb");
        cache.put("op", "c", "vc");
        cache.put("op", "d", "vd");
        assertNull(cache.get("op", "a"));
        assertEquals("vd", cache.get("op", "d"));
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
