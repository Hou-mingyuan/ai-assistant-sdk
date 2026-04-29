package com.aiassistant.spi;

import com.aiassistant.memory.ConversationMemory;

/**
 * SPI for providing conversation memory instances. Default implementation uses in-memory storage
 * keyed by session ID. Override to provide persistent (Redis, DB) storage.
 */
public interface ConversationMemoryProvider {

    /** Get or create a ConversationMemory for the given session. */
    ConversationMemory getMemory(String sessionId);

    /** Remove the memory for a session (e.g., on logout or expiry). */
    default void removeMemory(String sessionId) {}

    /** Check if memory exists for a session. */
    default boolean hasMemory(String sessionId) {
        return getMemory(sessionId) != null;
    }
}
