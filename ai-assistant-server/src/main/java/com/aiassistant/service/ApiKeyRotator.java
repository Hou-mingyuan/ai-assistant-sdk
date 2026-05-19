package com.aiassistant.service;

import java.util.List;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.Supplier;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Thread-safe round-robin API key rotator with exponential backoff cooldown.
 *
 * <p>When a key fails, its cooldown starts at {@value #INITIAL_COOLDOWN_MS}ms and doubles on each
 * consecutive failure up to {@value #MAX_COOLDOWN_MS}ms. A single success resets the backoff to
 * zero. This recovers quickly from transient errors while still backing off on persistent failures.
 */
public class ApiKeyRotator {

    private static final Logger log = LoggerFactory.getLogger(ApiKeyRotator.class);
    private static final long INITIAL_COOLDOWN_MS = 1_000;
    private static final long MAX_COOLDOWN_MS = 30_000;

    private final Supplier<List<String>> apiKeySupplier;
    private final AtomicInteger keyIndex = new AtomicInteger(0);
    private final ConcurrentHashMap<String, KeyState> keyStates = new ConcurrentHashMap<>();

    private record KeyState(long cooldownUntil, long nextCooldownMs) {}

    public ApiKeyRotator(List<String> apiKeys) {
        if (apiKeys == null || apiKeys.isEmpty()) {
            throw new IllegalArgumentException("At least one API key is required");
        }
        List<String> copy = List.copyOf(apiKeys);
        this.apiKeySupplier = () -> copy;
    }

    public ApiKeyRotator(Supplier<List<String>> apiKeySupplier) {
        if (apiKeySupplier == null) {
            throw new IllegalArgumentException("apiKeySupplier is required");
        }
        List<String> initial = sanitize(apiKeySupplier.get());
        if (initial.isEmpty()) {
            throw new IllegalArgumentException("At least one API key is required");
        }
        this.apiKeySupplier = () -> sanitize(apiKeySupplier.get());
    }

    /**
     * Returns the next available API key, preferring keys not in cooldown. If all keys are in
     * cooldown, returns the one whose cooldown expires soonest.
     */
    public String nextKey() {
        List<String> apiKeys = currentKeys();
        long now = System.currentTimeMillis();
        keyStates.entrySet().removeIf(e -> now >= e.getValue().cooldownUntil);
        int size = apiKeys.size();
        for (int attempt = 0; attempt < size; attempt++) {
            int idx = keyIndex.getAndUpdate(i -> (i + 1) % size);
            String key = apiKeys.get(idx);
            KeyState state = keyStates.get(key);
            if (state == null || now >= state.cooldownUntil) {
                return key;
            }
        }
        String earliest = null;
        long earliestUntil = Long.MAX_VALUE;
        for (String key : apiKeys) {
            KeyState state = keyStates.get(key);
            if (state != null && state.cooldownUntil < earliestUntil) {
                earliestUntil = state.cooldownUntil;
                earliest = key;
            }
        }
        return earliest != null
                ? earliest
                : apiKeys.get(keyIndex.getAndUpdate(i -> (i + 1) % size));
    }

    /** Marks a key as failed with exponential backoff: 1s -> 2s -> 4s -> 8s -> 16s -> 30s (cap). */
    public void markFailed(String key) {
        long now = System.currentTimeMillis();
        KeyState prev = keyStates.get(key);
        long cooldownMs =
                (prev != null)
                        ? Math.min(prev.nextCooldownMs, MAX_COOLDOWN_MS)
                        : INITIAL_COOLDOWN_MS;
        long until = now + cooldownMs;
        long nextCooldownMs = Math.min(cooldownMs * 2, MAX_COOLDOWN_MS);
        keyStates.put(key, new KeyState(until, nextCooldownMs));

        String masked =
                key.length() > 8
                        ? key.substring(0, 4) + "****" + key.substring(key.length() - 4)
                        : "****";
        int keyCount = currentKeys().size();
        int active = keyCount - keyStates.size();
        log.warn(
                "api.key.cooldown key={} cooldown={}ms nextCooldown={}ms activeKeys={}/{}",
                masked,
                cooldownMs,
                nextCooldownMs,
                Math.max(0, active),
                keyCount);
    }

    /** Marks a key as succeeded, resetting its backoff state. */
    public void markSuccess(String key) {
        keyStates.remove(key);
    }

    public int keyCount() {
        return currentKeys().size();
    }

    private List<String> currentKeys() {
        List<String> keys = apiKeySupplier.get();
        if (keys.isEmpty()) {
            throw new IllegalStateException("No API keys configured");
        }
        return keys;
    }

    private static List<String> sanitize(List<String> keys) {
        if (keys == null) {
            return List.of();
        }
        return keys.stream().filter(k -> k != null && !k.isBlank()).map(String::trim).toList();
    }
}
