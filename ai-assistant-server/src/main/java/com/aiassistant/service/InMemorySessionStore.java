package com.aiassistant.service;

import com.aiassistant.model.SessionData;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * In-memory {@link SessionStore} with per-user LRU eviction and TTL-based cleanup.
 */
public class InMemorySessionStore implements SessionStore {

    private final ConcurrentHashMap<String, ConcurrentHashMap<String, SessionData>> userSessions =
            new ConcurrentHashMap<>();
    private static final int MAX_SESSIONS_PER_USER = 50;
    private static final int MAX_USERS = 10_000;
    private static final Duration USER_TTL = Duration.ofDays(7);

    private final ConcurrentHashMap<String, Instant> userLastAccess = new ConcurrentHashMap<>();

    private void touchUser(String userId) {
        userLastAccess.put(userId, Instant.now());
        if (userSessions.size() > MAX_USERS) {
            evictStaleUsers();
        }
    }

    private void evictStaleUsers() {
        Instant cutoff = Instant.now().minus(USER_TTL);
        Iterator<Map.Entry<String, Instant>> it = userLastAccess.entrySet().iterator();
        while (it.hasNext()) {
            Map.Entry<String, Instant> entry = it.next();
            if (entry.getValue().isBefore(cutoff)) {
                userSessions.remove(entry.getKey());
                it.remove();
            }
        }
    }

    @Override
    public SessionData create(String userId, SessionData input) {
        touchUser(userId);
        var sessions = userSessions.computeIfAbsent(userId, k -> new ConcurrentHashMap<>());
        if (sessions.size() >= MAX_SESSIONS_PER_USER) {
            sessions.entrySet().stream()
                    .min((a, b) -> a.getValue().getUpdatedAt().compareTo(b.getValue().getUpdatedAt()))
                    .ifPresent(e -> sessions.remove(e.getKey()));
        }
        String id = UUID.randomUUID().toString().replace("-", "").substring(0, 12);
        input.setId(id);
        input.setCreatedAt(Instant.now());
        input.setUpdatedAt(Instant.now());
        sessions.put(id, input);
        return input;
    }

    @Override
    public SessionData get(String userId, String sessionId) {
        touchUser(userId);
        var sessions = userSessions.get(userId);
        return sessions != null ? sessions.get(sessionId) : null;
    }

    @Override
    public List<SessionData> list(String userId) {
        touchUser(userId);
        var sessions = userSessions.get(userId);
        if (sessions == null) return List.of();
        List<SessionData> out = new ArrayList<>(sessions.values());
        out.sort((a, b) -> b.getUpdatedAt().compareTo(a.getUpdatedAt()));
        return out;
    }

    @Override
    public SessionData update(String userId, String sessionId, SessionData input) {
        touchUser(userId);
        var sessions = userSessions.get(userId);
        if (sessions == null) return null;
        return sessions.computeIfPresent(sessionId, (id, existing) -> {
            if (input.getTitle() != null) existing.setTitle(input.getTitle());
            if (input.getMessages() != null) existing.setMessages(input.getMessages());
            existing.setUpdatedAt(Instant.now());
            return existing;
        });
    }

    @Override
    public boolean delete(String userId, String sessionId) {
        touchUser(userId);
        var sessions = userSessions.get(userId);
        return sessions != null && sessions.remove(sessionId) != null;
    }
}
