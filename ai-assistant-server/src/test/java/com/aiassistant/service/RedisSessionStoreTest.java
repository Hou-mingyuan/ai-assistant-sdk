package com.aiassistant.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.aiassistant.model.SessionData;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.core.HashOperations;
import org.springframework.data.redis.core.StringRedisTemplate;

@SuppressWarnings({"unchecked", "rawtypes"})
class RedisSessionStoreTest {

    private StringRedisTemplate redis;
    private HashOperations hashOps;
    private RedisSessionStore store;

    @BeforeEach
    void setUp() {
        redis = mock(StringRedisTemplate.class);
        hashOps = mock(HashOperations.class);
        when(redis.opsForHash()).thenReturn(hashOps);
        store = new RedisSessionStore(redis);
    }

    @Test
    void create_persistsAndReturnsSessionWithId() {
        when(hashOps.entries(anyString())).thenReturn(new HashMap<>());
        SessionData input = new SessionData();
        input.setTitle("hello");

        SessionData created = store.create("user1", input);

        assertNotNull(created.getId());
        assertNotNull(created.getCreatedAt());
        verify(hashOps).put(any(), any(), any());
        verify(redis).expire(anyString(), any(Duration.class));
    }

    @Test
    void create_failsClosedWhenRedisThrows() {
        when(hashOps.entries(anyString())).thenThrow(new RuntimeException("redis down"));
        SessionData input = new SessionData();
        input.setTitle("hello");

        // Fail-closed: a non-persisted write must surface, not look successful.
        assertThrows(SessionStoreUnavailableException.class, () -> store.create("user1", input));
    }

    @Test
    void get_returnsNullWhenAbsent() {
        when(hashOps.get(anyString(), any())).thenReturn(null);
        assertNull(store.get("user1", "sid"));
    }

    @Test
    void get_failsOpenToNullWhenRedisThrows() {
        when(hashOps.get(anyString(), any())).thenThrow(new RuntimeException("redis down"));
        assertNull(store.get("user1", "sid"));
    }

    @Test
    void list_failsOpenToEmptyWhenRedisThrows() {
        when(hashOps.entries(anyString())).thenThrow(new RuntimeException("redis down"));
        assertTrue(store.list("user1").isEmpty());
    }

    @Test
    void update_failsOpenToNullWhenRedisThrows() {
        when(hashOps.get(anyString(), any())).thenThrow(new RuntimeException("redis down"));
        assertNull(store.update("user1", "sid", new SessionData()));
    }

    @Test
    void delete_failsOpenToFalseWhenRedisThrows() {
        when(hashOps.delete(anyString(), any())).thenThrow(new RuntimeException("redis down"));
        assertFalse(store.delete("user1", "sid"));
    }

    @Test
    void get_deserializesStoredSession() {
        when(hashOps.get("ai-session:user1", "sid1"))
                .thenReturn(json("sid1", "hello", Instant.now()));

        SessionData s = store.get("user1", "sid1");

        assertNotNull(s);
        assertEquals("sid1", s.getId());
        assertEquals("hello", s.getTitle());
    }

    @Test
    void list_returnsSessionsSortedByUpdatedAtDesc() {
        Map<Object, Object> all = new HashMap<>();
        all.put("a", json("a", "older", Instant.parse("2026-01-01T00:00:00Z")));
        all.put("b", json("b", "newer", Instant.parse("2026-06-01T00:00:00Z")));
        when(hashOps.entries("ai-session:user1")).thenReturn(all);

        List<SessionData> list = store.list("user1");

        assertEquals(2, list.size());
        assertEquals("b", list.get(0).getId());
        assertEquals("a", list.get(1).getId());
    }

    @Test
    void update_updatesTitleAndPersists() {
        when(hashOps.get("ai-session:user1", "sid1"))
                .thenReturn(json("sid1", "old", Instant.now()));
        SessionData patch = new SessionData();
        patch.setTitle("new title");

        SessionData updated = store.update("user1", "sid1", patch);

        assertNotNull(updated);
        assertEquals("new title", updated.getTitle());
        verify(hashOps).put(eq("ai-session:user1"), eq("sid1"), anyString());
        verify(redis).expire(eq("ai-session:user1"), any(Duration.class));
    }

    @Test
    void update_returnsNullWhenSessionAbsent() {
        when(hashOps.get("ai-session:user1", "sid1")).thenReturn(null);
        assertNull(store.update("user1", "sid1", new SessionData()));
    }

    @Test
    void delete_returnsTrueWhenRemoved() {
        when(hashOps.delete("ai-session:user1", "sid1")).thenReturn(1L);
        assertTrue(store.delete("user1", "sid1"));
    }

    @Test
    void delete_returnsFalseWhenNothingRemoved() {
        when(hashOps.delete("ai-session:user1", "sid1")).thenReturn(0L);
        assertFalse(store.delete("user1", "sid1"));
    }

    @Test
    void create_evictsOldestWhenAtCapacity() {
        Map<Object, Object> full = new HashMap<>();
        for (int i = 0; i < 50; i++) {
            full.put("s" + i, json("s" + i, "t" + i, Instant.ofEpochSecond(1_000 + i)));
        }
        when(hashOps.entries("ai-session:user1")).thenReturn(full);
        SessionData input = new SessionData();
        input.setTitle("new");

        SessionData created = store.create("user1", input);

        assertNotNull(created.getId());
        verify(hashOps).delete("ai-session:user1", "s0");
        verify(hashOps).put(eq("ai-session:user1"), any(), anyString());
    }

    private static final ObjectMapper MAPPER =
            new ObjectMapper().registerModule(new JavaTimeModule());

    private static String json(String id, String title, Instant updatedAt) {
        SessionData s = new SessionData();
        s.setId(id);
        s.setTitle(title);
        s.setCreatedAt(updatedAt);
        s.setUpdatedAt(updatedAt);
        try {
            return MAPPER.writeValueAsString(s);
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }
}
