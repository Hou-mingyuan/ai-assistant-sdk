package com.aiassistant.service.llm;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.aiassistant.audit.AuditEvent;
import com.aiassistant.service.ApiKeyRotator;
import com.aiassistant.service.LlmRequestBuilder;
import com.aiassistant.service.OpenAiResponseParser;
import com.aiassistant.tool.ToolRegistry;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;
import reactor.core.publisher.Flux;

class StreamingLlmCallExecutorTest {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private static ResponsePostProcessor postProcessor() {
        return new ResponsePostProcessor(null, null, new OpenAiResponseParser(MAPPER));
    }

    private static LlmRequestBuilder simpleRequestBuilder() {
        com.aiassistant.config.AiAssistantProperties props =
                new com.aiassistant.config.AiAssistantProperties();
        props.setApiKey("dummy-key");
        return new LlmRequestBuilder(props, MAPPER, new ToolRegistry(List.of()));
    }

    private static StreamingToolCallingLoop noopStreamingLoop(ChatCompletionClient client) {
        return new StreamingToolCallingLoop(
                new ToolRegistry(List.of()), client, postProcessor(), MAPPER, 5, 30_000L);
    }

    private static StreamingLlmCallExecutor newExecutor(
            ChatCompletionClient client,
            ApiKeyRotator rotator,
            BlockingLlmCallExecutor.AuditEmitter auditEmitter) {
        return new StreamingLlmCallExecutor(
                simpleRequestBuilder(),
                rotator,
                client,
                postProcessor(),
                new ToolRegistry(List.of()),
                noopStreamingLoop(client),
                null,
                auditEmitter);
    }

    @Test
    void successStreamEmitsChunksAndAuditsSuccess() {
        ChatCompletionClient client = mock(ChatCompletionClient.class);
        when(client.completeStream(any(), anyString())).thenReturn(Flux.just("hello ", "world"));

        ApiKeyRotator rotator = mock(ApiKeyRotator.class);
        when(rotator.nextKey()).thenReturn("key-1");

        AtomicReference<AuditEvent.Outcome> outcomeRef = new AtomicReference<>();
        StreamingLlmCallExecutor exec =
                newExecutor(
                        client, rotator, (op, model, p, c, ms, outcome) -> outcomeRef.set(outcome));

        List<String> chunks =
                exec.stream("sys", "hi", null, "chat", "gpt-x", null).collectList().block();
        assertThat(chunks).containsExactly("hello ", "world");
        assertThat(outcomeRef.get()).isEqualTo(AuditEvent.Outcome.SUCCESS);
        verify(rotator, never()).markFailed(anyString());
    }

    @Test
    void upstreamErrorMarksKeyBadAndAuditsError() {
        ChatCompletionClient client = mock(ChatCompletionClient.class);
        when(client.completeStream(any(), anyString()))
                .thenReturn(Flux.error(new RuntimeException("upstream 500")));

        ApiKeyRotator rotator = mock(ApiKeyRotator.class);
        when(rotator.nextKey()).thenReturn("key-2");

        AtomicReference<AuditEvent.Outcome> outcomeRef = new AtomicReference<>();
        StreamingLlmCallExecutor exec =
                newExecutor(
                        client, rotator, (op, model, p, c, ms, outcome) -> outcomeRef.set(outcome));

        assertThatThrownBy(() -> exec.stream("sys", "hi", null, "chat", "gpt-x", null).blockLast())
                .hasMessageContaining("upstream");
        verify(rotator, atLeastOnce()).markFailed("key-2");
        assertThat(outcomeRef.get()).isEqualTo(AuditEvent.Outcome.ERROR);
    }

    @Test
    void nonChatOperationStripsToolsBeforeStreaming() {
        ChatCompletionClient client = mock(ChatCompletionClient.class);
        when(client.completeStream(any(), anyString())).thenReturn(Flux.just("ok"));
        ApiKeyRotator rotator = mock(ApiKeyRotator.class);
        when(rotator.nextKey()).thenReturn("key-3");

        StreamingLlmCallExecutor exec = newExecutor(client, rotator, (op, m, p, c, ms, o) -> {});

        List<String> chunks =
                exec.stream("sys", "hi", null, "summarize", "gpt-x", null).collectList().block();
        assertThat(chunks).containsExactly("ok");
    }

    @Test
    void nullAuditEmitterIsTolerated() {
        ChatCompletionClient client = mock(ChatCompletionClient.class);
        when(client.completeStream(any(), anyString())).thenReturn(Flux.just("hi"));
        ApiKeyRotator rotator = mock(ApiKeyRotator.class);
        when(rotator.nextKey()).thenReturn("key-5");

        StreamingLlmCallExecutor exec = newExecutor(client, rotator, null);

        List<String> chunks =
                exec.stream("sys", "hi", null, "chat", "gpt-x", null).collectList().block();
        assertThat(chunks).containsExactly("hi");
    }

    @Test
    void charCountForwardedAsEstimatedCompletionTokens() {
        ChatCompletionClient client = mock(ChatCompletionClient.class);
        when(client.completeStream(any(), anyString()))
                .thenReturn(Flux.just("12345678")); // 8 chars / 4 = 2 estimated tokens

        ApiKeyRotator rotator = mock(ApiKeyRotator.class);
        when(rotator.nextKey()).thenReturn("key-6");

        AtomicReference<Integer> completionTokensRef = new AtomicReference<>();
        StreamingLlmCallExecutor exec =
                newExecutor(
                        client,
                        rotator,
                        (op, model, p, c, ms, outcome) -> completionTokensRef.set(c));

        exec.stream("sys", "hi", null, "chat", "gpt-x", null).blockLast();
        assertThat(completionTokensRef.get()).isEqualTo(2);
    }
}
