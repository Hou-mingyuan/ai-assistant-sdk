package com.aiassistant.service.llm;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.aiassistant.memory.ConversationMemory;
import com.aiassistant.rag.RagService;
import com.aiassistant.service.LlmRequestBuilder;
import com.aiassistant.spi.ConversationMemoryProvider;
import org.junit.jupiter.api.Test;

class PromptComposerTest {

    @Test
    void resolvesBasePromptOnlyWhenMemoryAndRagAreBothAbsent() {
        LlmRequestBuilder rb = mock(LlmRequestBuilder.class);
        when(rb.resolveSystemPrompt("custom")).thenReturn("BASE");

        PromptComposer composer = new PromptComposer(rb, null, null);

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

        PromptComposer composer = new PromptComposer(rb, memoryProvider, null);

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

        PromptComposer composer = new PromptComposer(rb, memoryProvider, null);

        assertEquals("BASE", composer.composeChatSystemPrompt(null, "", "hi"));
        assertEquals("BASE", composer.composeChatSystemPrompt(null, null, "hi"));
    }

    @Test
    void skipsMemoryWhenProviderReturnsNull() {
        LlmRequestBuilder rb = mock(LlmRequestBuilder.class);
        when(rb.resolveSystemPrompt(any())).thenReturn("BASE");

        ConversationMemoryProvider memoryProvider = sessionId -> null;
        PromptComposer composer = new PromptComposer(rb, memoryProvider, null);

        assertEquals("BASE", composer.composeChatSystemPrompt(null, "session-1", "hi"));
    }

    @Test
    void swallowsMemoryProviderExceptions() {
        LlmRequestBuilder rb = mock(LlmRequestBuilder.class);
        when(rb.resolveSystemPrompt(any())).thenReturn("BASE");

        ConversationMemoryProvider memoryProvider =
                sessionId -> {
                    throw new IllegalStateException("redis unavailable");
                };

        PromptComposer composer = new PromptComposer(rb, memoryProvider, null);

        assertEquals("BASE", composer.composeChatSystemPrompt(null, "session-1", "hi"));
    }

    @Test
    void appendsRagContextWhenServiceReturnsNonBlankPrompt() {
        LlmRequestBuilder rb = mock(LlmRequestBuilder.class);
        when(rb.resolveSystemPrompt(any())).thenReturn("BASE");

        RagService rag = mock(RagService.class);
        when(rag.buildContextPrompt("the user message", "default")).thenReturn("RAG-FACTS");

        PromptComposer composer = new PromptComposer(rb, null, rag);

        String prompt = composer.composeChatSystemPrompt(null, null, "the user message");
        assertEquals("BASE\n\nRAG-FACTS", prompt);
    }

    @Test
    void skipsRagWhenUserMessageIsBlank() {
        LlmRequestBuilder rb = mock(LlmRequestBuilder.class);
        when(rb.resolveSystemPrompt(any())).thenReturn("BASE");

        RagService rag = mock(RagService.class);
        when(rag.buildContextPrompt(anyString(), anyString()))
                .thenThrow(new AssertionError("RAG must not be queried for empty user message"));

        PromptComposer composer = new PromptComposer(rb, null, rag);
        assertEquals("BASE", composer.composeChatSystemPrompt(null, null, ""));
        assertEquals("BASE", composer.composeChatSystemPrompt(null, null, null));
    }

    @Test
    void swallowsRagServiceExceptions() {
        LlmRequestBuilder rb = mock(LlmRequestBuilder.class);
        when(rb.resolveSystemPrompt(any())).thenReturn("BASE");

        RagService rag = mock(RagService.class);
        when(rag.buildContextPrompt(anyString(), anyString()))
                .thenThrow(new IllegalStateException("vector store unavailable"));

        PromptComposer composer = new PromptComposer(rb, null, rag);
        assertEquals("BASE", composer.composeChatSystemPrompt(null, null, "hi"));
    }

    @Test
    void layersMemoryThenRagWhenBothAvailable() {
        LlmRequestBuilder rb = mock(LlmRequestBuilder.class);
        when(rb.resolveSystemPrompt(any())).thenReturn("BASE");

        ConversationMemory memory = new ConversationMemory();
        memory.addFact("MEMORY-FACT");
        ConversationMemoryProvider memoryProvider = sessionId -> memory;

        RagService rag = mock(RagService.class);
        when(rag.buildContextPrompt(anyString(), anyString())).thenReturn("RAG-CONTEXT");

        PromptComposer composer = new PromptComposer(rb, memoryProvider, rag);

        String prompt = composer.composeChatSystemPrompt(null, "session-1", "hi");
        int memoryIdx = prompt.indexOf("MEMORY-FACT");
        int ragIdx = prompt.indexOf("RAG-CONTEXT");
        assertTrue(prompt.startsWith("BASE\n\n"));
        assertTrue(memoryIdx > 0 && ragIdx > memoryIdx, "memory must come before RAG context");
    }
}
