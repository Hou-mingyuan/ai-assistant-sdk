package com.aiassistant.memory;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class ConversationMemoryTest {

    @Test
    void addMessages_andRetrieve() {
        var mem = new ConversationMemory();
        mem.addUserMessage("Hi");
        mem.addAssistantMessage("Hello!");
        assertEquals(2, mem.getShortTermHistory().size());
        assertEquals("user", mem.getShortTermHistory().get(0).role());
        assertEquals("Hi", mem.getShortTermHistory().get(0).content());
    }

    @Test
    void slidingWindow_trimsOldMessages() {
        var mem = new ConversationMemory(4);
        for (int i = 0; i < 10; i++) {
            mem.addUserMessage("msg" + i);
        }
        assertEquals(4, mem.getShortTermHistory().size());
        assertEquals("msg6", mem.getShortTermHistory().get(0).content());
    }

    @Test
    void longTermFacts_addAndRetrieve() {
        var mem = new ConversationMemory();
        mem.addFact("User prefers dark mode");
        mem.addFact("User's name is Alice");
        assertEquals(2, mem.getLongTermFacts().size());
        assertTrue(mem.getLongTermFacts().contains("User prefers dark mode"));
    }

    @Test
    void longTermFacts_ignoresBlank() {
        var mem = new ConversationMemory();
        mem.addFact("");
        mem.addFact(null);
        mem.addFact("   ");
        assertEquals(0, mem.getLongTermFacts().size());
    }

    @Test
    void longTermFacts_capsAt100() {
        var mem = new ConversationMemory();
        for (int i = 0; i < 120; i++) {
            mem.addFact("fact" + i);
        }
        assertEquals(100, mem.getLongTermFacts().size());
    }

    @Test
    void buildMemoryPrompt_returnsEmptyWhenNoFacts() {
        var mem = new ConversationMemory();
        assertEquals("", mem.buildMemoryPrompt());
    }

    @Test
    void buildMemoryPrompt_includesFacts() {
        var mem = new ConversationMemory();
        mem.addFact("Likes Java");
        String prompt = mem.buildMemoryPrompt();
        assertTrue(prompt.contains("Likes Java"));
        assertTrue(prompt.contains("你已知的用户相关信息"));
    }

    @Test
    void clearShortTerm_keepsLongTerm() {
        var mem = new ConversationMemory();
        mem.addUserMessage("msg");
        mem.addFact("fact");
        mem.clearShortTerm();
        assertEquals(0, mem.getShortTermHistory().size());
        assertEquals(1, mem.getLongTermFacts().size());
    }

    @Test
    void clearAll_clearsEverything() {
        var mem = new ConversationMemory();
        mem.addUserMessage("msg");
        mem.addFact("fact");
        mem.clearAll();
        assertEquals(0, mem.getShortTermHistory().size());
        assertEquals(0, mem.getLongTermFacts().size());
    }

    @Test
    void shortTermHistory_returnsDefensiveCopy() {
        var mem = new ConversationMemory();
        mem.addUserMessage("msg");
        var list = mem.getShortTermHistory();
        assertThrows(UnsupportedOperationException.class, () -> list.add(null));
    }
}
