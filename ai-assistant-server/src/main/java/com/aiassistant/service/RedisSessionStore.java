package com.aiassistant.service;

import com.aiassistant.model.SessionData;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.StringRedisTemplate;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Redis-backed session store. Replaces the default in-memory {@link SessionStore}.
 * <p>Each user's sessions are stored as a Redis Hash: key = {@code ai-session:{userId}},
 * field = sessionId, value = JSON-serialized {@link SessionData}.</p>
 *
 * <p>Usage: declare this bean in your configuration and it will take priority over the
 * default {@code @ConditionalOnMissingBean} in-memory store.</p>
 *
 * <pre>{@code
 * @Bean
 * public SessionStore sessionStore(StringRedisTemplate redisTemplate) {
 *     return new RedisSessionStore(redisTemplate);
 * }
 * }</pre>
 */
public class RedisSessionStore implements SessionStore {

    private static final Logger log = LoggerFactory.getLogger(RedisSessionStore.class);
    private static final String KEY_PREFIX = "ai-session:";
    private static final int MAX_SESSIONS_PER_USER = 50;
    private static final Duration SESSION_TTL = Duration.ofDays(30);

    private final StringRedisTemplate redis;
    private final ObjectMapper mapper;

    public RedisSessionStore(StringRedisTemplate redisTemplate) {
        this.redis = redisTemplate;
        this.mapper = new ObjectMapper();
        this.mapper.registerModule(new JavaTimeModule());
    }

    @Override
    public SessionData create(String userId, SessionData input) {
        String key = KEY_PREFIX + userId;
        Map<Object, Object> all = redis.opsForHash().entries(key);
        if (all.size() >= MAX_SESSIONS_PER_USER) {
            evictOldest(key, all);
        }
        String id = UUID.randomUUID().toString().replace("-", "").substring(0, 12);
        input.setId(id);
        input.setCreatedAt(Instant.now());
        input.setUpdatedAt(Instant.now());
        redis.opsForHash().put(key, id, toJson(input));
        redis.expire(key, SESSION_TTL);
        return input;
    }

    @Override
    public SessionData get(String userId, String sessionId) {
        Object raw = redis.opsForHash().get(KEY_PREFIX + userId, sessionId);
        return raw != null ? fromJson(raw.toString()) : null;
    }

    @Override
    public List<SessionData> list(String userId) {
        Map<Object, Object> all = redis.opsForHash().entries(KEY_PREFIX + userId);
        if (all.isEmpty()) return List.of();
        List<SessionData> out = new ArrayList<>();
        for (Object v : all.values()) {
            SessionData s = fromJson(v.toString());
            if (s != null) out.add(s);
        }
        out.sort(Comparator.comparing(SessionData::getUpdatedAt).reversed());
        return out;
    }

    @Override
    public SessionData update(String userId, String sessionId, SessionData input) {
        String key = KEY_PREFIX + userId;
        Object raw = redis.opsForHash().get(key, sessionId);
        if (raw == null) return null;
        SessionData existing = fromJson(raw.toString());
        if (existing == null) return null;
        if (input.getTitle() != null) existing.setTitle(input.getTitle());
        if (input.getMessages() != null) existing.setMessages(input.getMessages());
        existing.setUpdatedAt(Instant.now());
        redis.opsForHash().put(key, sessionId, toJson(existing));
        redis.expire(key, SESSION_TTL);
        return existing;
    }

    @Override
    public boolean delete(String userId, String sessionId) {
        Long removed = redis.opsForHash().delete(KEY_PREFIX + userId, sessionId);
        return removed != null && removed > 0;
    }

    private void evictOldest(String key, Map<Object, Object> all) {
        String oldestField = null;
        Instant oldestTime = Instant.MAX;
        for (Map.Entry<Object, Object> e : all.entrySet()) {
            SessionData s = fromJson(e.getValue().toString());
            if (s != null && s.getUpdatedAt() != null && s.getUpdatedAt().isBefore(oldestTime)) {
                oldestTime = s.getUpdatedAt();
                oldestField = e.getKey().toString();
            }
        }
        if (oldestField != null) {
            redis.opsForHash().delete(key, oldestField);
        }
    }

    private String toJson(SessionData data) {
        try {
            return mapper.writeValueAsString(data);
        } catch (Exception e) {
            log.error("Failed to serialize SessionData", e);
            throw new IllegalStateException("SessionData serialization failed", e);
        }
    }

    private SessionData fromJson(String json) {
        try {
            return mapper.readValue(json, SessionData.class);
        } catch (Exception e) {
            log.warn("Failed to deserialize SessionData: {}", e.getMessage());
            return null;
        }
    }
}
