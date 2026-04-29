package com.aiassistant.spi;

import com.aiassistant.memory.ConversationMemory;
import java.sql.Timestamp;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import javax.sql.DataSource;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * JDBC-backed ConversationMemoryProvider. Persists short-term messages and long-term facts to
 * relational DB, with an in-memory LRU write-through cache for hot sessions.
 */
public class JdbcConversationMemoryProvider implements ConversationMemoryProvider {

    private static final Logger log = LoggerFactory.getLogger(JdbcConversationMemoryProvider.class);

    private final JdbcTemplate jdbc;
    private final Map<String, ConversationMemory> cache = new ConcurrentHashMap<>();
    private final int maxShortTermMessages;

    public JdbcConversationMemoryProvider(DataSource dataSource, int maxShortTermMessages) {
        this.jdbc = new JdbcTemplate(dataSource);
        this.maxShortTermMessages = maxShortTermMessages;
        initSchema();
    }

    private void initSchema() {
        jdbc.execute(
                """
            CREATE TABLE IF NOT EXISTS ai_conversation_messages (
                id BIGINT AUTO_INCREMENT PRIMARY KEY,
                session_id VARCHAR(255) NOT NULL,
                role VARCHAR(20) NOT NULL,
                content TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_session (session_id)
            )
            """);
        jdbc.execute(
                """
            CREATE TABLE IF NOT EXISTS ai_conversation_facts (
                id BIGINT AUTO_INCREMENT PRIMARY KEY,
                session_id VARCHAR(255) NOT NULL,
                fact TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_session_fact (session_id)
            )
            """);
    }

    @Override
    public ConversationMemory getMemory(String sessionId) {
        return cache.computeIfAbsent(sessionId, this::loadFromDb);
    }

    @Override
    public void removeMemory(String sessionId) {
        cache.remove(sessionId);
        jdbc.update("DELETE FROM ai_conversation_messages WHERE session_id = ?", sessionId);
        jdbc.update("DELETE FROM ai_conversation_facts WHERE session_id = ?", sessionId);
    }

    @Override
    public boolean hasMemory(String sessionId) {
        if (cache.containsKey(sessionId)) return true;
        Integer count =
                jdbc.queryForObject(
                        "SELECT COUNT(*) FROM ai_conversation_messages WHERE session_id = ?",
                        Integer.class,
                        sessionId);
        return count != null && count > 0;
    }

    /** Flush a session's current state to DB. Call periodically or on shutdown. */
    public void flush(String sessionId) {
        ConversationMemory memory = cache.get(sessionId);
        if (memory == null) return;
        persistMemory(sessionId, memory);
    }

    public void flushAll() {
        cache.forEach(this::persistMemory);
    }

    private ConversationMemory loadFromDb(String sessionId) {
        ConversationMemory memory = new ConversationMemory(maxShortTermMessages);

        List<Map<String, Object>> messages =
                jdbc.queryForList(
                        "SELECT role, content FROM ai_conversation_messages WHERE session_id = ? ORDER BY created_at DESC LIMIT ?",
                        sessionId,
                        maxShortTermMessages);

        for (int i = messages.size() - 1; i >= 0; i--) {
            Map<String, Object> row = messages.get(i);
            String role = (String) row.get("role");
            String content = (String) row.get("content");
            if ("user".equals(role)) {
                memory.addUserMessage(content);
            } else {
                memory.addAssistantMessage(content);
            }
        }

        List<String> facts =
                jdbc.queryForList(
                        "SELECT fact FROM ai_conversation_facts WHERE session_id = ? ORDER BY created_at",
                        String.class,
                        sessionId);
        for (String fact : facts) {
            memory.addFact(fact);
        }

        return memory;
    }

    private void persistMemory(String sessionId, ConversationMemory memory) {
        try {
            jdbc.update("DELETE FROM ai_conversation_messages WHERE session_id = ?", sessionId);
            for (ConversationMemory.MemoryEntry entry : memory.getShortTermHistory()) {
                jdbc.update(
                        "INSERT INTO ai_conversation_messages (session_id, role, content, created_at) VALUES (?, ?, ?, ?)",
                        sessionId,
                        entry.role(),
                        entry.content(),
                        new Timestamp(entry.timestamp()));
            }

            jdbc.update("DELETE FROM ai_conversation_facts WHERE session_id = ?", sessionId);
            for (String fact : memory.getLongTermFacts()) {
                jdbc.update(
                        "INSERT INTO ai_conversation_facts (session_id, fact) VALUES (?, ?)",
                        sessionId,
                        fact);
            }
        } catch (Exception e) {
            log.warn("Failed to persist conversation memory for session {}", sessionId, e);
        }
    }
}
