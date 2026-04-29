package com.aiassistant.service;

import static org.junit.jupiter.api.Assertions.*;

import com.aiassistant.model.SessionData;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class SessionStoreTest {

    private SessionStore store;

    @BeforeEach
    void setUp() {
        store = new InMemorySessionStore();
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

    @Test
    void createDefensivelyCopiesInput() {
        SessionData input = new SessionData();
        input.setTitle("original");
        SessionData.MessageItem message = new SessionData.MessageItem();
        message.setRole("user");
        message.setContent("hello");
        input.setMessages(List.of(message));

        SessionData created = store.create("u", input);
        input.setTitle("mutated");
        message.setContent("changed");

        SessionData stored = store.get("u", created.getId());
        assertEquals("original", stored.getTitle());
        assertEquals("hello", stored.getMessages().get(0).getContent());
    }

    @Test
    void getReturnsDefensiveCopy() {
        SessionData input = new SessionData();
        input.setTitle("original");
        SessionData created = store.create("u", input);

        SessionData fetched = store.get("u", created.getId());
        fetched.setTitle("mutated");

        assertEquals("original", store.get("u", created.getId()).getTitle());
    }

    @Test
    void updateDefensivelyCopiesMessages() {
        SessionData created = store.create("u", new SessionData());
        SessionData.MessageItem message = new SessionData.MessageItem();
        message.setRole("user");
        message.setContent("hello");
        SessionData update = new SessionData();
        update.setMessages(List.of(message));

        store.update("u", created.getId(), update);
        message.setContent("changed");

        assertEquals("hello", store.get("u", created.getId()).getMessages().get(0).getContent());
    }
}
