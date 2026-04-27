package com.aiassistant.spi;

import com.aiassistant.memory.ConversationMemory;
import org.junit.jupiter.api.Test;

import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.*;

class InMemoryConversationMemoryProviderTest {

    @Test
    void getMemory_createsNewMemoryForNewSession() {
        var provider = new InMemoryConversationMemoryProvider();
        ConversationMemory mem = provider.getMemory("session1");
        assertNotNull(mem);
    }

    @Test
    void getMemory_returnsSameInstanceForSameSession() {
        var provider = new InMemoryConversationMemoryProvider();
        ConversationMemory first = provider.getMemory("s1");
        ConversationMemory second = provider.getMemory("s1");
        assertSame(first, second);
    }

    @Test
    void getMemory_returnsDifferentInstancesForDifferentSessions() {
        var provider = new InMemoryConversationMemoryProvider();
        ConversationMemory a = provider.getMemory("a");
        ConversationMemory b = provider.getMemory("b");
        assertNotSame(a, b);
    }

    @Test
    void hasMemory_returnsTrueForExisting() {
        var provider = new InMemoryConversationMemoryProvider();
        provider.getMemory("x");
        assertTrue(provider.hasMemory("x"));
    }

    @Test
    void hasMemory_returnsFalseForNonExisting() {
        var provider = new InMemoryConversationMemoryProvider();
        assertFalse(provider.hasMemory("nonexistent"));
    }

    @Test
    void removeMemory_removesSession() {
        var provider = new InMemoryConversationMemoryProvider();
        provider.getMemory("toRemove");
        assertTrue(provider.hasMemory("toRemove"));
        provider.removeMemory("toRemove");
        assertFalse(provider.hasMemory("toRemove"));
    }

    @Test
    void removeMemory_noOpForNonExisting() {
        var provider = new InMemoryConversationMemoryProvider();
        assertDoesNotThrow(() -> provider.removeMemory("nope"));
    }

    @Test
    void lru_evictsWhenExceedingMaxSessions() {
        var provider = new InMemoryConversationMemoryProvider(20, 3, 3_600_000L);
        provider.getMemory("s1");
        provider.getMemory("s2");
        provider.getMemory("s3");
        provider.getMemory("s4");
        assertFalse(provider.hasMemory("s1"));
        assertTrue(provider.hasMemory("s4"));
    }

    @Test
    void ttl_evictsExpiredOnInsert() throws Exception {
        var provider = new InMemoryConversationMemoryProvider(20, 100, 50L);
        provider.getMemory("expiring");
        Thread.sleep(80);
        provider.getMemory("trigger");
        assertFalse(provider.hasMemory("expiring"));
    }

    @Test
    void customMaxShortTermMessages_propagatesToMemory() {
        var provider = new InMemoryConversationMemoryProvider(5);
        ConversationMemory mem = provider.getMemory("s1");
        for (int i = 0; i < 20; i++) {
            mem.addUserMessage("msg" + i);
        }
        assertEquals(5, mem.getShortTermHistory().size());
    }

    @Test
    void concurrentAccess_doesNotCorrupt() throws Exception {
        var provider = new InMemoryConversationMemoryProvider(20, 10_000, 3_600_000L);
        int threads = 8;
        int opsPerThread = 200;
        ExecutorService pool = Executors.newFixedThreadPool(threads);
        CountDownLatch latch = new CountDownLatch(threads);

        for (int t = 0; t < threads; t++) {
            final int threadId = t;
            pool.submit(() -> {
                try {
                    for (int i = 0; i < opsPerThread; i++) {
                        String sid = "t" + threadId + "-s" + i;
                        provider.getMemory(sid);
                        provider.hasMemory(sid);
                        if (i % 3 == 0) provider.removeMemory(sid);
                    }
                } finally {
                    latch.countDown();
                }
            });
        }

        assertTrue(latch.await(10, TimeUnit.SECONDS));
        pool.shutdown();
    }
}
