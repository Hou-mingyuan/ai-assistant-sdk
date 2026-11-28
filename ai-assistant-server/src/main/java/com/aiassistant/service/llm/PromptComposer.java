package com.aiassistant.service.llm;

import com.aiassistant.memory.ConversationMemory;
import com.aiassistant.service.LlmRequestBuilder;
import com.aiassistant.spi.ConversationMemoryProvider;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Builds the system prompt for chat calls, layering optional conversation memory and page context.
 */
public class PromptComposer {

    private static final Logger log = LoggerFactory.getLogger(PromptComposer.class);

    private final LlmRequestBuilder requestBuilder;
    private final ConversationMemoryProvider memoryProvider;

    public PromptComposer(
            LlmRequestBuilder requestBuilder, ConversationMemoryProvider memoryProvider) {
        this.requestBuilder = requestBuilder;
        this.memoryProvider = memoryProvider;
    }

    public String composeChatSystemPrompt(
            String requestSystemPrompt, String sessionId, String userMessage) {
        return composeChatSystemPrompt(requestSystemPrompt, sessionId, userMessage, null);
    }

    public String composeChatSystemPrompt(
            String requestSystemPrompt, String sessionId, String userMessage, String pageContext) {
        String prompt = requestBuilder.resolveSystemPrompt(requestSystemPrompt);
        prompt = enrichWithMemory(prompt, sessionId);
        prompt = enrichWithPageContext(prompt, pageContext);
        return prompt;
    }

    public String enrichWithPageContext(String systemPrompt, String pageContext) {
        if (pageContext == null || pageContext.isBlank()) {
            return systemPrompt;
        }
        return systemPrompt + "\n\n" + pageContext;
    }

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
}
