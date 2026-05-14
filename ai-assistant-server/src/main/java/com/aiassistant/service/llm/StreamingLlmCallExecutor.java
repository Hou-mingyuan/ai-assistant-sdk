package com.aiassistant.service.llm;

import com.aiassistant.audit.AuditEvent;
import com.aiassistant.model.ChatRequest;
import com.aiassistant.service.ApiKeyRotator;
import com.aiassistant.service.LlmRequestBuilder;
import com.aiassistant.tool.ToolRegistry;
import com.fasterxml.jackson.databind.node.ObjectNode;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import reactor.core.publisher.BufferOverflowStrategy;
import reactor.core.publisher.Flux;
import reactor.core.publisher.SignalType;

/**
 * Streaming-side LLM call orchestrator (K53.1).
 *
 * <p>Mirrors {@link BlockingLlmCallExecutor} (K28) for the SSE / Flux path: extracts {@code
 * LlmService.callLlmStream} into a single-owner unit that can be unit-tested in isolation. The
 * historical private method becomes a thin forwarder.
 *
 * <p>Algorithm:
 *
 * <ol>
 *   <li>Clamp the user message via {@link LlmRequestBuilder#clampUserMessage} and build the request
 *       body with streaming flag on.
 *   <li>For non-{@code "chat"} operations, strip the {@code "tools"} array so tool-calling stays
 *       opt-in.
 *   <li>Acquire a key via {@link ApiKeyRotator#nextKey()}.
 *   <li>If the tool registry has callable tools AND the body declares tools, route through {@link
 *       StreamingToolCallingLoop#stream} (K20) which handles probe + per-round progress markers.
 *   <li>Otherwise stream directly via {@link ChatCompletionClient#completeStream} with an
 *       onBackpressureBuffer(256, DROP_OLDEST) safety net, mark the key bad on upstream error.
 *   <li>Both branches run the stream through {@link ResponsePostProcessor#filterStream} for PII /
 *       content filtering, accumulate char-count, and emit a single audit event on terminal signal
 *       (ON_COMPLETE / ON_ERROR / cancel — the latter logged as error in the audit).
 * </ol>
 *
 * <p>Streaming timer ("aiassistant.llm.stream") only runs in the non-tool branch — matches the
 * historical metric scope so dashboards keep reading the same series.
 *
 * <p>State-free; thread-safe; reuse across requests.
 */
public final class StreamingLlmCallExecutor {

    private static final Logger log = LoggerFactory.getLogger(StreamingLlmCallExecutor.class);
    private static final int BACKPRESSURE_BUFFER = 256;

    /** Token estimation: 1 token ~= 4 chars (parity with old callLlmStream). */
    private static final int CHARS_PER_TOKEN_HEURISTIC = 4;

    private final LlmRequestBuilder requestBuilder;
    private final ApiKeyRotator keyRotator;
    private final ChatCompletionClient chatClient;
    private final ResponsePostProcessor responsePostProcessor;
    private final ToolRegistry toolRegistry;
    private final StreamingToolCallingLoop streamingToolCallingLoop;
    private final MeterRegistry meterRegistry;
    private final BlockingLlmCallExecutor.AuditEmitter auditEmitter;

    public StreamingLlmCallExecutor(
            LlmRequestBuilder requestBuilder,
            ApiKeyRotator keyRotator,
            ChatCompletionClient chatClient,
            ResponsePostProcessor responsePostProcessor,
            ToolRegistry toolRegistry,
            StreamingToolCallingLoop streamingToolCallingLoop,
            MeterRegistry meterRegistry,
            BlockingLlmCallExecutor.AuditEmitter auditEmitter) {
        this.requestBuilder = requestBuilder;
        this.keyRotator = keyRotator;
        this.chatClient = chatClient;
        this.responsePostProcessor = responsePostProcessor;
        this.toolRegistry = toolRegistry;
        this.streamingToolCallingLoop = streamingToolCallingLoop;
        this.meterRegistry = meterRegistry;
        this.auditEmitter = auditEmitter;
    }

    /**
     * Stream one chat completion.
     *
     * @return a cold {@link Flux} that, when subscribed, fires HTTP/SSE; do NOT subscribe more than
     *     once per request.
     */
    public Flux<String> stream(
            String systemPrompt,
            String userMessage,
            List<ChatRequest.MessageItem> history,
            String operation,
            String modelId,
            String imageData) {
        String clamped = requestBuilder.clampUserMessage(userMessage, history, systemPrompt);
        ObjectNode body =
                requestBuilder.buildRequestBody(
                        systemPrompt, clamped, true, history, modelId, imageData);
        if (!"chat".equals(operation)) {
            body.remove("tools");
        }
        String key = keyRotator.nextKey();
        long startMs = System.currentTimeMillis();
        AtomicInteger streamCharCount = new AtomicInteger(0);

        if (toolRegistry != null && !toolRegistry.isEmpty() && body.has("tools")) {
            return responsePostProcessor
                    .filterStream(
                            streamingToolCallingLoop.stream(body, key, keyRotator::markFailed),
                            modelId)
                    .doOnNext(chunk -> streamCharCount.addAndGet(chunk.length()))
                    .doFinally(
                            signal ->
                                    emit(
                                            operation,
                                            modelId,
                                            streamCharCount.get(),
                                            startMs,
                                            signal));
        }

        Flux<String> upstream =
                chatClient
                        .completeStream(body, key)
                        .onBackpressureBuffer(
                                BACKPRESSURE_BUFFER, BufferOverflowStrategy.DROP_OLDEST)
                        .doOnError(e -> keyRotator.markFailed(key));
        upstream = responsePostProcessor.filterStream(upstream, modelId);
        Timer.Sample sample = meterRegistry != null ? Timer.start(meterRegistry) : null;
        return upstream.doOnNext(chunk -> streamCharCount.addAndGet(chunk.length()))
                .doFinally(
                        signal -> {
                            if (sample != null) {
                                sample.stop(streamTimer(operation, outcomeMetricTag(signal)));
                            }
                            emit(operation, modelId, streamCharCount.get(), startMs, signal);
                        });
    }

    private static String outcomeMetricTag(SignalType signal) {
        if (signal == SignalType.ON_COMPLETE) return "success";
        if (signal == SignalType.ON_ERROR) return "error";
        return "cancel";
    }

    private static AuditEvent.Outcome auditOutcome(SignalType signal) {
        return signal == SignalType.ON_COMPLETE
                ? AuditEvent.Outcome.SUCCESS
                : AuditEvent.Outcome.ERROR;
    }

    private Timer streamTimer(String operation, String outcome) {
        return Timer.builder("aiassistant.llm.stream")
                .description("LLM /chat/completions SSE until terminal signal")
                .tag("operation", operation)
                .tag("outcome", outcome)
                .register(meterRegistry);
    }

    private void emit(
            String operation, String modelId, int totalChars, long startMs, SignalType signal) {
        if (auditEmitter == null) return;
        try {
            auditEmitter.emit(
                    operation,
                    modelId,
                    0,
                    totalChars / CHARS_PER_TOKEN_HEURISTIC,
                    System.currentTimeMillis() - startMs,
                    auditOutcome(signal));
        } catch (Exception e) {
            log.debug("Audit emit threw: {}", e.getMessage());
        }
    }
}
