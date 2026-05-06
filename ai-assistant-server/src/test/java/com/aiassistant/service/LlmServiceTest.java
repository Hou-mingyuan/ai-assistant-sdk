package com.aiassistant.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.aiassistant.config.AiAssistantProperties;
import com.aiassistant.memory.ConversationMemory;
import com.aiassistant.model.ChatRequest;
import com.aiassistant.rag.RagService;
import com.aiassistant.routing.ModelRouter;
import com.aiassistant.security.ContentFilter;
import com.aiassistant.service.llm.ChatCompletionClient;
import com.aiassistant.spi.ChatInterceptor;
import com.aiassistant.spi.ConversationMemoryProvider;
import com.aiassistant.stats.TokenUsageTracker;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import reactor.core.publisher.Flux;

class LlmServiceTest {

    @Test
    void constructorRequiresAtLeastOneApiKey() throws Exception {
        AiAssistantProperties properties = baseProperties();
        properties.setApiKey("");
        properties.setApiKeys(List.of());

        assertThrows(
                IllegalArgumentException.class,
                () ->
                        new LlmService(
                                properties,
                                urlFetchService(),
                                new CapturingChatClient(),
                                null,
                                null,
                                null,
                                null,
                                null,
                                null));
    }

    @Test
    void translateCachesNonStreamingResponsesAndBuildsExpectedRequest() throws Exception {
        CapturingChatClient client = new CapturingChatClient();
        client.enqueueRaw(chatResponse("Bonjour"));
        LlmService service = newService(baseProperties(), client);

        assertEquals("Bonjour", service.translate("hello", "fr"));
        assertEquals("Bonjour", service.translate("hello", "fr"));

        assertEquals(1, client.requests.size());
        ObjectNode body = client.requests.get(0);
        assertEquals("primary-model", body.path("model").asText());
        assertFalse(body.path("stream").asBoolean());
        assertEquals("key-1", client.apiKeys.get(0));
        assertTrue(body.path("messages").get(0).path("content").asText().contains("translator"));
        assertEquals("hello", body.path("messages").get(1).path("content").asText());
    }

    @Test
    void chatBuildsClientPromptHistoryImageAndWhitelistedModelRequest() throws Exception {
        AiAssistantProperties properties = baseProperties();
        properties.setAllowedModels(List.of("vision-model"));
        properties.setAllowClientSystemPrompt(true);
        properties.setClientSystemPromptMaxChars(6);

        CapturingChatClient client = new CapturingChatClient();
        client.enqueueRaw(chatResponse("image understood"));
        LlmService service = newService(properties, client);

        String result =
                service.chat(
                        "look",
                        List.of(
                                message("user", "old question"),
                                message("assistant", "old answer")),
                        "system prompt",
                        "vision-model",
                        "abc123");

        assertEquals("image understood", result);
        ObjectNode body = client.requests.get(0);
        assertEquals("vision-model", body.path("model").asText());
        assertEquals("system", body.path("messages").get(0).path("content").asText());
        assertEquals("old question", body.path("messages").get(1).path("content").asText());
        assertEquals("old answer", body.path("messages").get(2).path("content").asText());
        assertEquals(
                "data:image/png;base64,abc123",
                body.path("messages")
                        .get(3)
                        .path("content")
                        .get(1)
                        .path("image_url")
                        .path("url")
                        .asText());
    }

    @Test
    void chatFallsBackToNextModelAndNextApiKeyAfterClientFailure() throws Exception {
        AiAssistantProperties properties = baseProperties();
        ModelRouter router = new ModelRouter("primary-model");
        router.setFallbackChain(List.of("primary-model", "backup-model"));
        CapturingChatClient client = new CapturingChatClient();
        client.enqueueFailure(new RuntimeException("primary unavailable"));
        client.enqueueRaw(chatResponse("fallback ok"));
        LlmService service = newService(properties, client, null, null, router, null, List.of());

        assertEquals("fallback ok", service.chat("hello"));

        assertEquals(2, client.requests.size());
        assertEquals("primary-model", client.requests.get(0).path("model").asText());
        assertEquals("backup-model", client.requests.get(1).path("model").asText());
        assertEquals(List.of("key-1", "key-2"), client.apiKeys);
    }

    @Test
    void chatAppliesInterceptorsMemoryRagAndContentFilter() throws Exception {
        AiAssistantProperties properties = baseProperties();
        ConversationMemory memory = new ConversationMemory();
        memory.addFact("user prefers concise answers");
        ConversationMemoryProvider memoryProvider = sessionId -> memory;
        RagService ragService = mock(RagService.class);
        when(ragService.buildContextPrompt(anyString(), anyString())).thenReturn("RAG context");

        ChatInterceptor interceptor =
                new ChatInterceptor() {
                    @Override
                    public ChatContext beforeChat(ChatContext context) {
                        return context.withUserMessage(context.userMessage() + " 13800138000");
                    }

                    @Override
                    public String afterChat(ChatContext context, String response) {
                        return "after:" + response;
                    }
                };

        CapturingChatClient client = new CapturingChatClient();
        client.enqueueRaw(chatResponse("call me at 13800138000"));
        LlmService service =
                newService(
                        properties,
                        client,
                        new ContentFilter(),
                        null,
                        null,
                        ragService,
                        List.of(interceptor),
                        memoryProvider);

        String result = service.chat("hello", null, null, null, null, "session-1");

        assertEquals("after:call me at [手机号已脱敏]", result);
        String systemPrompt =
                client.requests.get(0).path("messages").get(0).path("content").asText();
        assertTrue(systemPrompt.contains("user prefers concise answers"));
        assertTrue(systemPrompt.contains("RAG context"));
        assertEquals(
                "hello [手机号已脱敏]",
                client.requests.get(0).path("messages").get(1).path("content").asText());
        assertEquals(2, memory.getShortTermHistory().size());
        assertEquals("hello", memory.getShortTermHistory().get(0).content());
        assertEquals("after:call me at [手机号已脱敏]", memory.getShortTermHistory().get(1).content());
    }

    @Test
    void chatReservesAndReleasesTokenQuota() throws Exception {
        AiAssistantProperties properties = baseProperties();
        properties.setMaxTokens(50);
        TokenUsageTracker tracker = new TokenUsageTracker();
        tracker.setQuota("default", 100);
        CapturingChatClient client = new CapturingChatClient();
        client.enqueueRaw(
                "{\"choices\":[{\"message\":{\"content\":\"ok\"}}],"
                        + "\"usage\":{\"prompt_tokens\":10,\"completion_tokens\":5}}");
        LlmService service = newService(properties, client, null, tracker, null, null, List.of());

        assertEquals("ok", service.chat("hello"));

        Map<String, Object> snapshot = tracker.getSnapshot("default");
        assertEquals(15L, snapshot.get("totalTokens"));
        assertEquals(85L, tracker.remainingQuota("default"));
    }

    @Test
    void chatStreamFiltersOutputAndRecordsEstimatedCompletionTokens() throws Exception {
        AiAssistantProperties properties = baseProperties();
        TokenUsageTracker tracker = new TokenUsageTracker();
        CapturingChatClient client = new CapturingChatClient();
        client.enqueueStream(List.of("phone ", "13800138000"));
        LlmService service =
                newService(properties, client, new ContentFilter(), tracker, null, null, List.of());

        List<String> chunks = service.chatStream("hello").collectList().block();

        assertEquals(List.of("phone ", "[手机号已脱敏]"), chunks);
        assertTrue((Long) tracker.getSnapshot("default").get("completionTokens") > 0);
        assertTrue(client.requests.get(0).path("stream").asBoolean());
    }

    private static LlmService newService(
            AiAssistantProperties properties, CapturingChatClient client) throws Exception {
        return newService(properties, client, null, null, null, null, List.of());
    }

    private static LlmService newService(
            AiAssistantProperties properties,
            CapturingChatClient client,
            ContentFilter contentFilter,
            TokenUsageTracker tokenUsageTracker,
            ModelRouter modelRouter,
            RagService ragService,
            List<ChatInterceptor> interceptors)
            throws Exception {
        return newService(
                properties,
                client,
                contentFilter,
                tokenUsageTracker,
                modelRouter,
                ragService,
                interceptors,
                null);
    }

    private static LlmService newService(
            AiAssistantProperties properties,
            CapturingChatClient client,
            ContentFilter contentFilter,
            TokenUsageTracker tokenUsageTracker,
            ModelRouter modelRouter,
            RagService ragService,
            List<ChatInterceptor> interceptors,
            ConversationMemoryProvider memoryProvider)
            throws Exception {
        return new LlmService(
                properties,
                urlFetchService(),
                client,
                null,
                null,
                contentFilter,
                tokenUsageTracker,
                modelRouter,
                ragService,
                memoryProvider,
                interceptors,
                null);
    }

    private static UrlFetchService urlFetchService() throws Exception {
        UrlFetchService service = mock(UrlFetchService.class);
        when(service.enrichUserMessage(anyString()))
                .thenAnswer(invocation -> invocation.getArgument(0));
        return service;
    }

    private static AiAssistantProperties baseProperties() {
        AiAssistantProperties properties = new AiAssistantProperties();
        properties.setApiKeys(List.of("key-1", "key-2"));
        properties.setModel("primary-model");
        properties.setMaxTokens(256);
        properties.setTemperature(0.2);
        properties.setChatMaxTotalChars(16_000);
        properties.setChatHistoryMaxChars(16_000);
        return properties;
    }

    private static ChatRequest.MessageItem message(String role, String content) {
        ChatRequest.MessageItem item = new ChatRequest.MessageItem();
        item.setRole(role);
        item.setContent(content);
        return item;
    }

    private static String chatResponse(String content) {
        return "{\"choices\":[{\"message\":{\"content\":\"" + content + "\"}}]}";
    }

    private static final class CapturingChatClient implements ChatCompletionClient {

        private final List<ObjectNode> requests = new ArrayList<>();
        private final List<String> apiKeys = new ArrayList<>();
        private final ArrayDeque<Object> responses = new ArrayDeque<>();

        void enqueueRaw(String response) {
            responses.add(response);
        }

        void enqueueFailure(RuntimeException failure) {
            responses.add(failure);
        }

        void enqueueStream(List<String> chunks) {
            responses.add(chunks);
        }

        @Override
        public String complete(ObjectNode requestBody, String apiKey) {
            return completeRaw(requestBody, apiKey);
        }

        @Override
        public String completeRaw(ObjectNode requestBody, String apiKey) {
            requests.add(requestBody.deepCopy());
            apiKeys.add(apiKey);
            Object next = responses.removeFirst();
            if (next instanceof RuntimeException failure) {
                throw failure;
            }
            return (String) next;
        }

        @Override
        @SuppressWarnings("unchecked")
        public Flux<String> completeStream(ObjectNode requestBody, String apiKey) {
            requests.add(requestBody.deepCopy());
            apiKeys.add(apiKey);
            Object next = responses.removeFirst();
            if (next instanceof RuntimeException failure) {
                return Flux.error(failure);
            }
            return Flux.fromIterable((List<String>) next);
        }
    }
}
