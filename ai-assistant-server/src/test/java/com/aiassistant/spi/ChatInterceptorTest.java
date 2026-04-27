package com.aiassistant.spi;

import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class ChatInterceptorTest {

    @Test
    void defaultBeforeChat_returnsContextUnchanged() {
        ChatInterceptor interceptor = new ChatInterceptor() {};
        var ctx = newCtx("hello");
        ChatInterceptor.ChatContext result = interceptor.beforeChat(ctx);
        assertSame(ctx, result);
    }

    @Test
    void defaultAfterChat_returnsResponseUnchanged() {
        ChatInterceptor interceptor = new ChatInterceptor() {};
        var ctx = newCtx("hello");
        String result = interceptor.afterChat(ctx, "response");
        assertEquals("response", result);
    }

    @Test
    void defaultOnError_doesNotThrow() {
        ChatInterceptor interceptor = new ChatInterceptor() {};
        assertDoesNotThrow(() -> interceptor.onError(newCtx("x"), new RuntimeException("boom")));
    }

    @Test
    void chatContext_withUserMessage_createsNewContext() {
        var ctx = newCtx("original");
        var modified = ctx.withUserMessage("modified");
        assertEquals("modified", modified.userMessage());
        assertEquals(ctx.operation(), modified.operation());
        assertEquals(ctx.systemPrompt(), modified.systemPrompt());
        assertNotSame(ctx, modified);
    }

    @Test
    void chatContext_withSystemPrompt_createsNewContext() {
        var ctx = newCtx("user");
        var modified = ctx.withSystemPrompt("new-prompt");
        assertEquals("new-prompt", modified.systemPrompt());
        assertEquals("user", modified.userMessage());
    }

    @Test
    void chatContext_withModelId_createsNewContext() {
        var ctx = newCtx("user");
        var modified = ctx.withModelId("gpt-5");
        assertEquals("gpt-5", modified.modelId());
        assertEquals(ctx.userMessage(), modified.userMessage());
    }

    @Test
    void customInterceptor_modifiesMessage() {
        ChatInterceptor upper = new ChatInterceptor() {
            @Override
            public ChatInterceptor.ChatContext beforeChat(ChatInterceptor.ChatContext context) {
                return context.withUserMessage(context.userMessage().toUpperCase());
            }
        };
        var ctx = newCtx("hello world");
        var result = upper.beforeChat(ctx);
        assertEquals("HELLO WORLD", result.userMessage());
    }

    @Test
    void customInterceptor_modifiesResponse() {
        ChatInterceptor censor = new ChatInterceptor() {
            @Override
            public String afterChat(ChatInterceptor.ChatContext context, String response) {
                return response.replaceAll("(?i)bad", "***");
            }
        };
        assertEquals("this is ***", censor.afterChat(newCtx("x"), "this is bad"));
    }

    private static ChatInterceptor.ChatContext newCtx(String userMessage) {
        return new ChatInterceptor.ChatContext(
                "chat", userMessage, "system", "model-1", "tenant-1", List.of(), new HashMap<>());
    }
}
