package com.aiassistant.service;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.concurrent.TimeUnit;
import java.util.zip.GZIPInputStream;
import java.util.zip.GZIPOutputStream;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Thread-safe LRU cache for LLM responses backed by Caffeine. Stores compressed (GZip) payloads and
 * uses SHA-256 hashing for cache keys to avoid storing raw prompts.
 */
public class LlmResponseCache {

    private static final Logger log = LoggerFactory.getLogger(LlmResponseCache.class);

    private final Cache<String, byte[]> cache;

    public LlmResponseCache(int maxEntries, long ttlMs) {
        this.cache =
                Caffeine.newBuilder()
                        .maximumSize(maxEntries)
                        .expireAfterWrite(ttlMs, TimeUnit.MILLISECONDS)
                        .build();
    }

    /** Default: 500 entries, 5 min TTL. */
    public LlmResponseCache() {
        this(500, 300_000);
    }

    /** Returns cached response or null if not found / expired. */
    public String get(String operation, String text) {
        String key = cacheKey(operation, text);
        byte[] compressed = cache.getIfPresent(key);
        if (compressed == null) return null;
        return decompress(compressed);
    }

    /** Stores a response in the cache. */
    public void put(String operation, String text, String response) {
        String key = cacheKey(operation, text);
        cache.put(key, compress(response));
    }

    /**
     * Force any pending size-based eviction work to run. Caffeine evicts entries asynchronously
     * (W-TinyLFU), so a sequence of puts can briefly leave the cache slightly over the configured
     * maximum size. Tests that need deterministic eviction call this method; production code does
     * not need to.
     */
    void cleanUp() {
        cache.cleanUp();
    }

    /** Approximate number of entries; safe for tests that need to assert eviction convergence. */
    long estimatedSize() {
        return cache.estimatedSize();
    }

    static String cacheKey(String operation, String text) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            md.update(operation.getBytes(StandardCharsets.UTF_8));
            md.update(text.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(md.digest());
        } catch (Exception e) {
            return operation + ":" + text.hashCode();
        }
    }

    static byte[] compress(String text) {
        try (ByteArrayOutputStream baos = new ByteArrayOutputStream();
                GZIPOutputStream gzos = new GZIPOutputStream(baos)) {
            gzos.write(text.getBytes(StandardCharsets.UTF_8));
            gzos.finish();
            return baos.toByteArray();
        } catch (Exception e) {
            return text.getBytes(StandardCharsets.UTF_8);
        }
    }

    private static String decompress(byte[] compressed) {
        try (ByteArrayInputStream bais = new ByteArrayInputStream(compressed);
                GZIPInputStream gzis = new GZIPInputStream(bais)) {
            return new String(gzis.readAllBytes(), StandardCharsets.UTF_8);
        } catch (Exception e) {
            log.warn(
                    "Cache entry decompression failed, treating as cache miss: {}", e.getMessage());
            return null;
        }
    }
}
