package com.aiassistant.spi;

import java.util.List;
import java.util.Map;

/**
 * SPI for intercepting chat lifecycle events.
 * Register as a Spring Bean to participate in the chat pipeline.
 * Multiple interceptors are executed in {@link org.springframework.core.annotation.Order} order.
 */
public interface ChatInterceptor {

    /**
     * Called before the LLM request is sent. Can modify the user message or reject the request.
     * @return modified context, or throw to abort
     */
    default ChatContext beforeChat(ChatContext context) {
        return context;
    }

    /**
     * Called after the LLM response is received (non-streaming).
     * @return modified response text
     */
    default String afterChat(ChatContext context, String response) {
        return response;
    }

    /**
     * Called when an error occurs during chat.
     */
    default void onError(ChatContext context, Throwable error) {}

    record ChatContext(
            String operation,
            String userMessage,
            String systemPrompt,
            String modelId,
            String tenantId,
            List<?> history,
            Map<String, Object> attributes
    ) {
        public ChatContext withUserMessage(String msg) {
            return new ChatContext(operation, msg, systemPrompt, modelId, tenantId, history, attributes);
        }
        public ChatContext withSystemPrompt(String prompt) {
            return new ChatContext(operation, userMessage, prompt, modelId, tenantId, history, attributes);
        }
        public ChatContext withModelId(String model) {
            return new ChatContext(operation, userMessage, systemPrompt, model, tenantId, history, attributes);
        }
    }
}
