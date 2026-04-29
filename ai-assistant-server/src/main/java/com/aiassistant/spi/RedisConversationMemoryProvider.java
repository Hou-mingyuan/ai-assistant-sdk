package com.aiassistant.spi;

import com.aiassistant.memory.ConversationMemory;
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
        return cache.computeIfAbsent(sessionId, this::loadFromRedis);
    }

    @Override
    public void removeMemory(String sessionId) {
        cache.remove(sessionId);
        redis.delete(KEY_PREFIX + sessionId + ":messages");
        redis.delete(KEY_PREFIX + sessionId + ":facts");
    }

    @Override
    public boolean hasMemory(String sessionId) {
        if (cache.containsKey(sessionId)) return true;
        return Boolean.TRUE.equals(redis.hasKey(KEY_PREFIX + sessionId + ":messages"));
    }

    public void flush(String sessionId) {
        ConversationMemory memory = cache.get(sessionId);
        if (memory == null) return;
        persistToRedis(sessionId, memory);
    }

    public void flushAll() {
        cache.forEach(this::persistToRedis);
    }

    private ConversationMemory loadFromRedis(String sessionId) {
        ConversationMemory memory = new ConversationMemory(maxShortTermMessages);
        try {
            String messagesJson = redis.opsForValue().get(KEY_PREFIX + sessionId + ":messages");
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

            String factsJson = redis.opsForValue().get(KEY_PREFIX + sessionId + ":facts");
            if (factsJson != null) {
                List<String> facts = objectMapper.readValue(factsJson, new TypeReference<>() {});
                for (String fact : facts) {
                    memory.addFact(fact);
                }
            }
        } catch (Exception e) {
            log.warn("Failed to load conversation memory from Redis for session {}", sessionId, e);
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
        } catch (Exception e) {
            log.warn("Failed to persist conversation memory to Redis for session {}", sessionId, e);
        }
    }
}
