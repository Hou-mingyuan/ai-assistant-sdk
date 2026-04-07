package com.aiassistant.service;

import com.aiassistant.model.SessionData;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * In-memory session store. Replace this bean to use a database.
 */
public class SessionStore {

    private final ConcurrentHashMap<String, ConcurrentHashMap<String, SessionData>> userSessions =
            new ConcurrentHashMap<>();
    private static final int MAX_SESSIONS_PER_USER = 50;

    public SessionData create(String userId, SessionData input) {
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

    public SessionData get(String userId, String sessionId) {
        var sessions = userSessions.get(userId);
        return sessions != null ? sessions.get(sessionId) : null;
    }

    public List<SessionData> list(String userId) {
        var sessions = userSessions.get(userId);
        if (sessions == null) return List.of();
        List<SessionData> out = new ArrayList<>(sessions.values());
        out.sort((a, b) -> b.getUpdatedAt().compareTo(a.getUpdatedAt()));
        return out;
    }

    public SessionData update(String userId, String sessionId, SessionData input) {
        var sessions = userSessions.get(userId);
        if (sessions == null) return null;
        SessionData existing = sessions.get(sessionId);
        if (existing == null) return null;
        if (input.getTitle() != null) existing.setTitle(input.getTitle());
        if (input.getMessages() != null) existing.setMessages(input.getMessages());
        existing.setUpdatedAt(Instant.now());
        return existing;
    }

    public boolean delete(String userId, String sessionId) {
        var sessions = userSessions.get(userId);
        return sessions != null && sessions.remove(sessionId) != null;
    }
}
