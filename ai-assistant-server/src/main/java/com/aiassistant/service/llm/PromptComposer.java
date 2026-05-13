package com.aiassistant.service.llm;

import com.aiassistant.memory.ConversationMemory;
import com.aiassistant.rag.RagService;
import com.aiassistant.service.LlmRequestBuilder;
import com.aiassistant.spi.ConversationMemoryProvider;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Builds the final system prompt for chat-style LLM calls.
 *
 * <p>Pipeline: {@code requestSystemPrompt → resolved base prompt → memory enrichment → RAG
 * enrichment}. Each step is best-effort: a failure or a missing dependency simply skips that step
 * and the previous prompt is returned untouched, so callers never have to special-case nulls.
 *
 * <p>Memory and RAG dependencies are optional; pass {@code null} to disable that branch.
 */
public class PromptComposer {

    private static final Logger log = LoggerFactory.getLogger(PromptComposer.class);

    private final LlmRequestBuilder requestBuilder;
    private final ConversationMemoryProvider memoryProvider;
    private final RagService ragService;

    public PromptComposer(
            LlmRequestBuilder requestBuilder,
            ConversationMemoryProvider memoryProvider,
            RagService ragService) {
        this.requestBuilder = requestBuilder;
        this.memoryProvider = memoryProvider;
        this.ragService = ragService;
    }

    /**
     * Compose the system prompt for a chat turn: resolve the client/global base prompt, then layer
     * in conversation memory (if configured), RAG context (if configured), and page context (if the
     * frontend supplied it).
     */
    public String composeChatSystemPrompt(
            String requestSystemPrompt, String sessionId, String userMessage) {
        return composeChatSystemPrompt(requestSystemPrompt, sessionId, userMessage, null);
    }

    public String composeChatSystemPrompt(
            String requestSystemPrompt, String sessionId, String userMessage, String pageContext) {
        String prompt = requestBuilder.resolveSystemPrompt(requestSystemPrompt);
        prompt = enrichWithMemory(prompt, sessionId);
        prompt = enrichWithRag(prompt, userMessage);
        prompt = enrichWithPageContext(prompt, pageContext);
        return prompt;
    }

    /** Append frontend-collected page context so the LLM is aware of what the user is viewing. */
    public String enrichWithPageContext(String systemPrompt, String pageContext) {
        if (pageContext == null || pageContext.isBlank()) {
            return systemPrompt;
        }
        return systemPrompt + "\n\n" + pageContext;
    }

    /** Append remembered facts and rolling history hints to the system prompt. */
    public String enrichWithMemory(String systemPrompt, String sessionId) {
        if (memoryProvider == null || sessionId == null || sessionId.isBlank()) {
            return systemPrompt;
        }
        try {
            ConversationMemory memory = memoryProvider.getMemory(sessionId);
            if (memory == null) {
                return systemPrompt;
            }
            String memoryPrompt = memory.buildMemoryPrompt();
            if (memoryPrompt != null && !memoryPrompt.isBlank()) {
                return systemPrompt + "\n\n" + memoryPrompt;
            }
        } catch (Exception e) {
            log.debug("Memory enrichment skipped: {}", e.getMessage());
        }
        return systemPrompt;
    }

    /** Inject retrieval-augmented context for the supplied user message. */
    public String enrichWithRag(String systemPrompt, String userMessage) {
        if (ragService == null || userMessage == null || userMessage.isBlank()) {
            return systemPrompt;
        }
        try {
            String context = ragService.buildContextPrompt(userMessage, "default");
            if (context != null && !context.isBlank()) {
                return systemPrompt + "\n\n" + context;
            }
        } catch (Exception e) {
            log.debug("RAG enrichment skipped: {}", e.getMessage());
        }
        return systemPrompt;
    }
}
