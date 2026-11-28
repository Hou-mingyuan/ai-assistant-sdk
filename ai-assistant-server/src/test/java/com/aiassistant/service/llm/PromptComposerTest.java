package com.aiassistant.service.llm;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.aiassistant.memory.ConversationMemory;
import com.aiassistant.service.LlmRequestBuilder;
import com.aiassistant.spi.ConversationMemoryProvider;
import org.junit.jupiter.api.Test;

class PromptComposerTest {

    @Test
    void resolvesBasePromptOnlyWhenMemoryIsAbsent() {
        LlmRequestBuilder rb = mock(LlmRequestBuilder.class);
        when(rb.resolveSystemPrompt("custom")).thenReturn("BASE");

        PromptComposer composer = new PromptComposer(rb, null);

        String prompt = composer.composeChatSystemPrompt("custom", "session-1", "hello");
        assertEquals("BASE", prompt);
    }

    @Test
    void appendsMemoryHintWhenSessionHasMemory() {
        LlmRequestBuilder rb = mock(LlmRequestBuilder.class);
        when(rb.resolveSystemPrompt(any())).thenReturn("BASE");

        ConversationMemory memory = new ConversationMemory();
        memory.addFact("user prefers concise answers");
        ConversationMemoryProvider memoryProvider = sessionId -> memory;

        PromptComposer composer = new PromptComposer(rb, memoryProvider);

        String prompt = composer.composeChatSystemPrompt("ignored", "session-1", "hi");
        assertTrue(prompt.startsWith("BASE\n\n"));
        assertTrue(prompt.contains("user prefers concise answers"));
    }

    @Test
    void skipsMemoryWhenSessionIdIsBlank() {
        LlmRequestBuilder rb = mock(LlmRequestBuilder.class);
        when(rb.resolveSystemPrompt(any())).thenReturn("BASE");

        ConversationMemoryProvider memoryProvider =
                sessionId -> {
                    throw new AssertionError("memory should not be queried for blank session");
                };

        PromptComposer composer = new PromptComposer(rb, memoryProvider);

        assertEquals("BASE", composer.composeChatSystemPrompt(null, "", "hi"));
        assertEquals("BASE", composer.composeChatSystemPrompt(null, null, "hi"));
    }

    @Test
    void swallowsMemoryProviderExceptions() {
        LlmRequestBuilder rb = mock(LlmRequestBuilder.class);
        when(rb.resolveSystemPrompt(any())).thenReturn("BASE");

        ConversationMemoryProvider memoryProvider =
                sessionId -> {
                    throw new IllegalStateException("redis unavailable");
                };

        PromptComposer composer = new PromptComposer(rb, memoryProvider);

        assertEquals("BASE", composer.composeChatSystemPrompt(null, "session-1", "hi"));
    }

    @Test
    void appendsPageContextAfterMemory() {
        LlmRequestBuilder rb = mock(LlmRequestBuilder.class);
        when(rb.resolveSystemPrompt(any())).thenReturn("BASE");

        ConversationMemory memory = new ConversationMemory();
        memory.addFact("MEMORY-FACT");
        PromptComposer composer = new PromptComposer(rb, sessionId -> memory);

        String prompt = composer.composeChatSystemPrompt(null, "session-1", "hi", "PAGE-CONTEXT");
        int memoryIdx = prompt.indexOf("MEMORY-FACT");
        int pageIdx = prompt.indexOf("PAGE-CONTEXT");
        assertTrue(memoryIdx > 0 && pageIdx > memoryIdx);
    }
}
