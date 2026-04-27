package com.aiassistant.spi;

import com.aiassistant.memory.ConversationMemory;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.locks.ReentrantLock;

/**
 * Default in-memory ConversationMemoryProvider with LRU eviction.
 * Memories are lost on restart; override with Redis/DB-backed implementation for persistence.
 * <p>All access is serialized because {@link LinkedHashMap} in access-order mode
 * mutates internal structure on every {@code get()}.</p>
 */
public class InMemoryConversationMemoryProvider implements ConversationMemoryProvider {

    private static final int DEFAULT_MAX_SESSIONS = 10_000;

    private final Map<String, TimestampedMemory> store;
    private final ReentrantLock lock = new ReentrantLock();
    private final int maxShortTermMessages;
    private final long sessionTtlMs;

    public InMemoryConversationMemoryProvider(int maxShortTermMessages, int maxSessions, long sessionTtlMs) {
        this.maxShortTermMessages = maxShortTermMessages;
        this.sessionTtlMs = sessionTtlMs;
        this.store = new LinkedHashMap<>(16, 0.75f, true) {
            @Override
            protected boolean removeEldestEntry(Map.Entry<String, TimestampedMemory> eldest) {
                if (size() > maxSessions) return true;
                return sessionTtlMs > 0 && eldest.getValue().isExpired(sessionTtlMs);
            }
        };
    }

    public InMemoryConversationMemoryProvider(int maxShortTermMessages) {
        this(maxShortTermMessages, DEFAULT_MAX_SESSIONS, 3_600_000L);
    }

    public InMemoryConversationMemoryProvider() {
        this(20);
    }

    @Override
    public ConversationMemory getMemory(String sessionId) {
        lock.lock();
        try {
            TimestampedMemory tm = store.get(sessionId);
            if (tm != null && !tm.isExpired(sessionTtlMs)) {
                tm.touch();
                return tm.memory;
            }
            if (tm != null && tm.isExpired(sessionTtlMs)) {
                store.remove(sessionId);
            }
            ConversationMemory memory = new ConversationMemory(maxShortTermMessages);
            store.put(sessionId, new TimestampedMemory(memory));
            return memory;
        } finally {
            lock.unlock();
        }
    }

    @Override
    public void removeMemory(String sessionId) {
        lock.lock();
        try {
            store.remove(sessionId);
        } finally {
            lock.unlock();
        }
    }

    @Override
    public boolean hasMemory(String sessionId) {
        lock.lock();
        try {
            TimestampedMemory tm = store.get(sessionId);
            return tm != null && !tm.isExpired(sessionTtlMs);
        } finally {
            lock.unlock();
        }
    }

    private static class TimestampedMemory {
        final ConversationMemory memory;
        long lastAccessedAt;

        TimestampedMemory(ConversationMemory memory) {
            this.memory = memory;
            this.lastAccessedAt = System.currentTimeMillis();
        }

        void touch() {
            this.lastAccessedAt = System.currentTimeMillis();
        }

        boolean isExpired(long ttlMs) {
            return ttlMs > 0 && (System.currentTimeMillis() - lastAccessedAt) > ttlMs;
        }
    }
}
