package com.aiassistant.service;

import com.aiassistant.model.SessionData;
import java.util.List;

/**
 * Session store abstraction. Implement this interface to back sessions with a database, Redis, or
 * any other storage. The default in-memory implementation is {@link InMemorySessionStore}.
 */
public interface SessionStore {
    SessionData create(String userId, SessionData input);

    SessionData get(String userId, String sessionId);

    List<SessionData> list(String userId);

    SessionData update(String userId, String sessionId, SessionData input);

    boolean delete(String userId, String sessionId);
}
