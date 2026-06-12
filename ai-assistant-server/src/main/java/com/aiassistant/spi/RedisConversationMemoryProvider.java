package com.aiassistant.spi;

import com.aiassistant.memory.ConversationMemory;
import com.aiassistant.util.ThrottledWarnLogger;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.StringRedisTemplate;

/**
 * Redis-backed ConversationMemoryProvider with local write-through cache. TTL defaults to 24 hours
 * per session.
 *
 * <p>Fail-open: a Redis outage never throws to the caller. Reads return a transient empty memory
 * that is <em>not</em> cached, so the session automatically reloads real history once Redis
 * recovers; writes/queries degrade quietly. Degradation warnings are throttled to avoid log floods.
 */
public class RedisConversationMemoryProvider implements ConversationMemoryProvider {

    private static final Logger log =
            LoggerFactory.getLogger(RedisConversationMemoryProvider.class);
    private static final String KEY_PREFIX = "ai:memory:";
    private static final Duration DEFAULT_TTL = Duration.ofHours(24);

    private final StringRedisTemplate redis;
    private final ObjectMapper objectMapper;
    private final Duration ttl;
    private final int maxShortTermMessages;
    private final Map<String, ConversationMemory> cache = new ConcurrentHashMap<>();
    private final ThrottledWarnLogger warnLog = new ThrottledWarnLogger(log, 30_000);

    public RedisConversationMemoryProvider(StringRedisTemplate redis, int maxShortTermMessages) {
        this(redis, maxShortTermMessages, DEFAULT_TTL);
    }

    public RedisConversationMemoryProvider(
            StringRedisTemplate redis, int maxShortTermMessages, Duration ttl) {
        this.redis = redis;
        this.objectMapper = new ObjectMapper();
        this.ttl = ttl;
        this.maxShortTermMessages = maxShortTermMessages;
    }

    @Override
    public ConversationMemory getMemory(String sessionId) {
        ConversationMemory cached = cache.get(sessionId);
        if (cached != null) {
            return cached;
        }
        try {
            return cache.computeIfAbsent(sessionId, this::loadFromRedis);
        } catch (RuntimeException e) {
            // Fail-open: return a transient (uncached) memory so the request proceeds and the
            // session reloads from Redis once it is reachable again.
            warnRedisFailure("load", e);
            return new ConversationMemory(maxShortTermMessages);
        }
    }

    @Override
    public void removeMemory(String sessionId) {
        cache.remove(sessionId);
        try {
            redis.delete(KEY_PREFIX + sessionId + ":messages");
            redis.delete(KEY_PREFIX + sessionId + ":facts");
        } catch (RuntimeException e) {
            warnRedisFailure("remove", e);
        }
    }

    @Override
    public boolean hasMemory(String sessionId) {
        if (cache.containsKey(sessionId)) return true;
        try {
            return Boolean.TRUE.equals(redis.hasKey(KEY_PREFIX + sessionId + ":messages"));
        } catch (RuntimeException e) {
            warnRedisFailure("has", e);
            return false;
        }
    }

    public void flush(String sessionId) {
        ConversationMemory memory = cache.get(sessionId);
        if (memory == null) return;
        persistToRedis(sessionId, memory);
    }

    public void flushAll() {
        cache.forEach(this::persistToRedis);
    }

    /**
     * Loads a session's memory from Redis. Redis I/O failures propagate (handled by {@link
     * #getMemory} as fail-open); only malformed payloads are swallowed into an empty memory.
     */
    private ConversationMemory loadFromRedis(String sessionId) {
        ConversationMemory memory = new ConversationMemory(maxShortTermMessages);
        String messagesJson = redis.opsForValue().get(KEY_PREFIX + sessionId + ":messages");
        String factsJson = redis.opsForValue().get(KEY_PREFIX + sessionId + ":facts");
        try {
            if (messagesJson != null) {
                List<Map<String, String>> entries =
                        objectMapper.readValue(messagesJson, new TypeReference<>() {});
                for (Map<String, String> entry : entries) {
                    if ("user".equals(entry.get("role"))) {
                        memory.addUserMessage(entry.get("content"));
                    } else {
                        memory.addAssistantMessage(entry.get("content"));
                    }
                }
            }
            if (factsJson != null) {
                List<String> facts = objectMapper.readValue(factsJson, new TypeReference<>() {});
                for (String fact : facts) {
                    memory.addFact(fact);
                }
            }
        } catch (Exception e) {
            log.warn(
                    "Malformed conversation memory payload for session {}: {}",
                    sessionId,
                    e.getMessage());
        }
        return memory;
    }

    private void persistToRedis(String sessionId, ConversationMemory memory) {
        try {
            List<Map<String, String>> entries =
                    memory.getShortTermHistory().stream()
                            .map(e -> Map.of("role", e.role(), "content", e.content()))
                            .toList();
            String messagesKey = KEY_PREFIX + sessionId + ":messages";
            redis.opsForValue().set(messagesKey, objectMapper.writeValueAsString(entries), ttl);

            String factsKey = KEY_PREFIX + sessionId + ":facts";
            redis.opsForValue()
                    .set(factsKey, objectMapper.writeValueAsString(memory.getLongTermFacts()), ttl);
        } catch (RuntimeException e) {
            warnRedisFailure("persist", e);
        } catch (Exception e) {
            log.warn(
                    "Failed to serialize conversation memory for session {}: {}",
                    sessionId,
                    e.getMessage());
        }
    }

    /** Throttled (see {@link ThrottledWarnLogger}) degradation warning to avoid log floods. */
    private void warnRedisFailure(String op, Exception e) {
        warnLog.warn(
                "Redis conversation memory '{}' failed, degrading gracefully: {}",
                op,
                e.getMessage());
    }
}
