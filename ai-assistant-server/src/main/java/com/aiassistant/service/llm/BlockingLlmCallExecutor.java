package com.aiassistant.service.llm;

import com.aiassistant.audit.AuditEvent;
import com.aiassistant.model.ChatRequest;
import com.aiassistant.routing.ModelRouter;
import com.aiassistant.service.ApiKeyRotator;
import com.aiassistant.service.LlmRequestBuilder;
import com.fasterxml.jackson.databind.node.ObjectNode;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Blocking-side LLM call orchestrator (K28).
 *
 * <p>Extracted from {@code LlmService.callLlm(...)} so the attempt + fallback + key-rotation +
 * tool-calling loop integration + audit emission has a single owner that can be unit-tested in
 * isolation. The historical {@code callLlm} private method is now a 3-line forwarder.
 *
 * <p>Algorithm:
 *
 * <ol>
 *   <li>Build the OpenAI-compatible request body via {@link LlmRequestBuilder}; strip {@code
 *       "tools"} when the operation is not {@code "chat"}.
 *   <li>Pick an API key via {@link ApiKeyRotator#nextKey()}.
 *   <li>POST to {@link ChatCompletionClient#completeRaw}. On upstream failure, mark the key bad and
 *       ask {@link ModelRouter#nextFallback} for a fallback model; if one exists, retry.
 *   <li>On success, record token usage, run {@link ToolCallingLoop#execute} to handle any tool
 *       calls, filter PII via {@link ResponsePostProcessor#filterSync}, mark the key healthy, and
 *       return.
 * </ol>
 *
 * <p>Audit events are emitted via the injected {@link AuditEmitter} callback so this class does not
 * depend on tenant context plumbing.
 *
 * <p>State-free; thread-safe; reuse across requests.
 */
public final class BlockingLlmCallExecutor {

    private static final Logger log = LoggerFactory.getLogger(BlockingLlmCallExecutor.class);
    private static final int DEFAULT_MAX_ATTEMPTS = 3;

    private final LlmRequestBuilder requestBuilder;
    private final ApiKeyRotator keyRotator;
    private final ChatCompletionClient chatClient;
    private final ResponsePostProcessor responsePostProcessor;
    private final ToolCallingLoop toolCallingLoop;
    private final ModelRouter modelRouter;
    private final MeterRegistry meterRegistry;
    private final AuditEmitter auditEmitter;
    private final int maxAttempts;

    /** Side-channel audit emission so this class avoids tenant-context dependencies. */
    @FunctionalInterface
    public interface AuditEmitter {
        void emit(
                String operation,
                String modelId,
                int promptTokens,
                int completionTokens,
                long latencyMs,
                AuditEvent.Outcome outcome);
    }

    public BlockingLlmCallExecutor(
            LlmRequestBuilder requestBuilder,
            ApiKeyRotator keyRotator,
            ChatCompletionClient chatClient,
            ResponsePostProcessor responsePostProcessor,
            ToolCallingLoop toolCallingLoop,
            ModelRouter modelRouter,
            MeterRegistry meterRegistry,
            AuditEmitter auditEmitter) {
        this(
                requestBuilder,
                keyRotator,
                chatClient,
                responsePostProcessor,
                toolCallingLoop,
                modelRouter,
                meterRegistry,
                auditEmitter,
                DEFAULT_MAX_ATTEMPTS);
    }

    public BlockingLlmCallExecutor(
            LlmRequestBuilder requestBuilder,
            ApiKeyRotator keyRotator,
            ChatCompletionClient chatClient,
            ResponsePostProcessor responsePostProcessor,
            ToolCallingLoop toolCallingLoop,
            ModelRouter modelRouter,
            MeterRegistry meterRegistry,
            AuditEmitter auditEmitter,
            int maxAttempts) {
        this.requestBuilder = requestBuilder;
        this.keyRotator = keyRotator;
        this.chatClient = chatClient;
        this.responsePostProcessor = responsePostProcessor;
        this.toolCallingLoop = toolCallingLoop;
        this.modelRouter = modelRouter;
        this.meterRegistry = meterRegistry;
        this.auditEmitter = auditEmitter;
        this.maxAttempts = Math.max(1, Math.min(maxAttempts, 8));
    }

    public int getMaxAttempts() {
        return maxAttempts;
    }

    /**
     * Execute one blocking LLM call with attempt + fallback + tool-calling.
     *
     * @return the final assistant content
     * @throws RuntimeException upstream LLM error after all fallbacks are exhausted
     */
    public String execute(
            String systemPrompt,
            String userMessage,
            List<ChatRequest.MessageItem> history,
            String operation,
            String modelId,
            String imageData) {
        String clampedUser = requestBuilder.clampUserMessage(userMessage, history, systemPrompt);
        String currentModel = modelId;
        RuntimeException lastError = null;
        long startMs = System.currentTimeMillis();

        for (int attempt = 0; attempt < maxAttempts; attempt++) {
            ObjectNode body =
                    requestBuilder.buildRequestBody(
                            systemPrompt, clampedUser, false, history, currentModel, imageData);
            if (!"chat".equals(operation)) {
                body.remove("tools");
            }
            String key = keyRotator.nextKey();
            Timer.Sample sample = meterRegistry != null ? Timer.start(meterRegistry) : null;
            String rawResponse;
            try {
                rawResponse = chatClient.completeRaw(body, key);
            } catch (RuntimeException e) {
                keyRotator.markFailed(key);
                if (sample != null) sample.stop(completionTimer(operation, "error"));
                lastError = e;
                String fallback =
                        modelRouter != null ? modelRouter.nextFallback(currentModel) : null;
                if (fallback != null) {
                    log.warn(
                            "Model {} failed, falling back to {}: {}",
                            currentModel,
                            fallback,
                            e.getMessage());
                    currentModel = fallback;
                    continue;
                }
                emit(operation, currentModel, 0, 0, startMs, AuditEvent.Outcome.ERROR);
                throw e;
            }
            try {
                int[] tokenCounts =
                        responsePostProcessor.extractAndRecord(rawResponse, currentModel);
                String result = toolCallingLoop.execute(body, rawResponse, key);
                result = responsePostProcessor.filterSync(result);
                keyRotator.markSuccess(key);
                if (sample != null) sample.stop(completionTimer(operation, "success"));
                emit(
                        operation,
                        currentModel,
                        tokenCounts[0],
                        tokenCounts[1],
                        startMs,
                        AuditEvent.Outcome.SUCCESS);
                return result;
            } catch (RuntimeException e) {
                if (sample != null) sample.stop(completionTimer(operation, "error"));
                emit(operation, currentModel, 0, 0, startMs, AuditEvent.Outcome.ERROR);
                throw e;
            }
        }
        throw lastError != null ? lastError : new RuntimeException("All fallback models exhausted");
    }

    private Timer completionTimer(String operation, String outcome) {
        return Timer.builder("aiassistant.llm.completion")
                .description("LLM /chat/completions (non-stream) latency")
                .tag("operation", operation)
                .tag("outcome", outcome)
                .register(meterRegistry);
    }

    private void emit(
            String operation,
            String modelId,
            int promptTokens,
            int completionTokens,
            long startMs,
            AuditEvent.Outcome outcome) {
        if (auditEmitter == null) return;
        try {
            auditEmitter.emit(
                    operation,
                    modelId,
                    promptTokens,
                    completionTokens,
                    System.currentTimeMillis() - startMs,
                    outcome);
        } catch (Exception e) {
            log.debug("Audit emit threw: {}", e.getMessage());
        }
    }
}
