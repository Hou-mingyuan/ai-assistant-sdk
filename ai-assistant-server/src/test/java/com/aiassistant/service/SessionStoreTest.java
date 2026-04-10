package com.aiassistant.service;

import com.aiassistant.model.SessionData;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class SessionStoreTest {

    private SessionStore store;

    @BeforeEach
    void setUp() {
        store = new SessionStore();
    }

    @Test
    void createAndGet() {
        SessionData input = new SessionData();
        input.setTitle("test");
        SessionData created = store.create("user1", input);
        assertNotNull(created.getId());
        assertNotNull(created.getCreatedAt());
        assertEquals("test", store.get("user1", created.getId()).getTitle());
    }

    @Test
    void listReturnsSortedByUpdatedAt() throws Exception {
        SessionData a = new SessionData();
        a.setTitle("A");
        store.create("u", a);
        Thread.sleep(2);
        SessionData b = new SessionData();
        b.setTitle("B");
        store.create("u", b);
        List<SessionData> list = store.list("u");
        assertEquals(2, list.size());
        assertEquals("B", list.get(0).getTitle());
    }

    @Test
    void updateChangesTitle() {
        SessionData s = store.create("u", new SessionData());
        SessionData upd = new SessionData();
        upd.setTitle("new title");
        store.update("u", s.getId(), upd);
        assertEquals("new title", store.get("u", s.getId()).getTitle());
    }

    @Test
    void deleteRemovesSession() {
        SessionData s = store.create("u", new SessionData());
        assertTrue(store.delete("u", s.getId()));
        assertNull(store.get("u", s.getId()));
    }

    @Test
    void deleteNonexistent() {
        assertFalse(store.delete("u", "nonexistent"));
    }

    @Test
    void evictsOldestWhenFull() {
        for (int i = 0; i < 51; i++) {
            SessionData d = new SessionData();
            d.setTitle("s" + i);
            store.create("u", d);
        }
        assertTrue(store.list("u").size() <= 50);
    }
}
