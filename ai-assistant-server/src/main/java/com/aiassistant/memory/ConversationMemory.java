package com.aiassistant.memory;

import java.util.List;

/**
 * Manages conversation context with sliding window + long-term memory.
 * Short-term: recent N messages in the current session.
 * Long-term: summarized/embedded key facts that persist across sessions.
 */
public class ConversationMemory {

    private final int maxShortTermMessages;
    private final List<MemoryEntry> shortTerm = new java.util.concurrent.CopyOnWriteArrayList<>();
    private final List<String> longTermFacts = new java.util.concurrent.CopyOnWriteArrayList<>();

    public ConversationMemory(int maxShortTermMessages) {
        this.maxShortTermMessages = Math.max(4, maxShortTermMessages);
    }

    public ConversationMemory() {
        this(20);
    }

    public void addUserMessage(String message) {
        shortTerm.add(new MemoryEntry("user", message, System.currentTimeMillis()));
        trimShortTerm();
    }

    public void addAssistantMessage(String message) {
        shortTerm.add(new MemoryEntry("assistant", message, System.currentTimeMillis()));
        trimShortTerm();
    }

    /**
     * Store a long-term fact (user preference, key decision, etc.).
     */
    public void addFact(String fact) {
        if (fact != null && !fact.isBlank() && longTermFacts.size() < 100) {
            longTermFacts.add(fact.trim());
        }
    }

    public List<MemoryEntry> getShortTermHistory() {
        return List.copyOf(shortTerm);
    }

    public List<String> getLongTermFacts() {
        return List.copyOf(longTermFacts);
    }

    /**
     * Build a memory context string for inclusion in the system prompt.
     */
    public String buildMemoryPrompt() {
        if (longTermFacts.isEmpty()) return "";
        StringBuilder sb = new StringBuilder();
        sb.append("你已知的用户相关信息：\n");
        for (String fact : longTermFacts) {
            sb.append("- ").append(fact).append("\n");
        }
        return sb.toString();
    }

    public void clearShortTerm() {
        shortTerm.clear();
    }

    public void clearAll() {
        shortTerm.clear();
        longTermFacts.clear();
    }

    private void trimShortTerm() {
        while (shortTerm.size() > maxShortTermMessages) {
            shortTerm.remove(0);
        }
    }

    public record MemoryEntry(String role, String content, long timestamp) {}
}
