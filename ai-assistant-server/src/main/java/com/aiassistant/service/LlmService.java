package com.aiassistant.service;

import com.aiassistant.audit.AuditEvent;
import com.aiassistant.audit.AuditEventStore;
import com.aiassistant.config.AiAssistantProperties;
import com.aiassistant.config.TenantContext;
import com.aiassistant.memory.ConversationMemory;
import com.aiassistant.model.ChatRequest;
import com.aiassistant.rag.RagService;
import com.aiassistant.routing.ModelRouter;
import com.aiassistant.security.ContentFilter;
import com.aiassistant.service.llm.ChatCompletionClient;
import com.aiassistant.service.llm.PromptComposer;
import com.aiassistant.service.llm.RequestEnricher;
import com.aiassistant.service.llm.ResponsePostProcessor;
import com.aiassistant.spi.ChatInterceptor;
import com.aiassistant.spi.ConversationMemoryProvider;
import com.aiassistant.stats.TokenUsageTracker;
import com.aiassistant.tool.ToolRegistry;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
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
import reactor.core.scheduler.Schedulers;

/**
 * Core service for AI assistant operations: chat, translate, summarize (sync &amp; streaming).
 *
 * <p>Delegates to {@link ChatCompletionClient} for LLM calls and {@link UrlFetchService} for
 * enriching user messages with linked page content. Supports multiple API keys with round-robin
 * rotation.
 */
public class LlmService {

    private static final Logger log = LoggerFactory.getLogger(LlmService.class);

    private final AiAssistantProperties properties;
    private final UrlFetchService urlFetchService;
    private final ChatCompletionClient chatCompletionClient;
    private final MeterRegistry meterRegistry;
    private final ToolRegistry toolRegistry;
    private final ContentFilter contentFilter;
    private final TokenUsageTracker tokenUsageTracker;
    private final ModelRouter modelRouter;
    private final RagService ragService;
    private final ConversationMemoryProvider memoryProvider;
    private final List<ChatInterceptor> interceptors;
    private final AuditEventStore auditEventStore;
    private final ObjectMapper objectMapper = new ObjectMapper();
    private static final int MAX_TOOL_ROUNDS = 5;
    private final ApiKeyRotator keyRotator;
    private final LlmResponseCache llmCache;
    private final LlmRequestBuilder requestBuilder;
    private final OpenAiResponseParser responseParser;
    private final PromptComposer promptComposer;
    private final RequestEnricher requestEnricher;
    private final ResponsePostProcessor responsePostProcessor;

    public LlmService(
            AiAssistantProperties properties,
            UrlFetchService urlFetchService,
            ChatCompletionClient chatCompletionClient,
            MeterRegistry meterRegistry,
            ToolRegistry toolRegistry,
            ContentFilter contentFilter,
            TokenUsageTracker tokenUsageTracker,
            ModelRouter modelRouter,
            RagService ragService) {
        this(
                properties,
                urlFetchService,
                chatCompletionClient,
                meterRegistry,
                toolRegistry,
                contentFilter,
                tokenUsageTracker,
                modelRouter,
                ragService,
                null,
                null,
                null);
    }

    public LlmService(
            AiAssistantProperties properties,
            UrlFetchService urlFetchService,
            ChatCompletionClient chatCompletionClient,
            MeterRegistry meterRegistry,
            ToolRegistry toolRegistry,
            ContentFilter contentFilter,
            TokenUsageTracker tokenUsageTracker,
            ModelRouter modelRouter,
            RagService ragService,
            ConversationMemoryProvider memoryProvider,
            List<ChatInterceptor> interceptors,
            AuditEventStore auditEventStore) {
        this.keyRotator = new ApiKeyRotator(properties.resolveApiKeys());
        this.llmCache = new LlmResponseCache();
        this.requestBuilder = new LlmRequestBuilder(properties, objectMapper, toolRegistry);
        this.responseParser = new OpenAiResponseParser(objectMapper);
        this.properties = properties;
        this.urlFetchService = urlFetchService;
        this.chatCompletionClient = chatCompletionClient;
        this.meterRegistry = meterRegistry;
        this.toolRegistry = toolRegistry;
        this.contentFilter = contentFilter;
        this.tokenUsageTracker = tokenUsageTracker;
        this.modelRouter = modelRouter;
        this.ragService = ragService;
        this.memoryProvider = memoryProvider;
        this.interceptors = interceptors != null ? interceptors : List.of();
        this.auditEventStore = auditEventStore;
        this.promptComposer = new PromptComposer(requestBuilder, memoryProvider, ragService);
        this.requestEnricher = new RequestEnricher(contentFilter, urlFetchService);
        this.responsePostProcessor =
                new ResponsePostProcessor(contentFilter, tokenUsageTracker, responseParser);

        int timeout = Math.max(1, Math.min(properties.getTimeoutSeconds(), 600));
        log.info(
                "AI Assistant initialized: provider={}, model={}, timeout={}s, keys={}, metrics={}, pii={}, rag={}, memory={}, interceptors={}",
                properties.getProvider(),
                properties.resolveModel(),
                timeout,
                keyRotator.keyCount(),
                meterRegistry != null,
                contentFilter != null,
                ragService != null,
                memoryProvider != null,
                this.interceptors.size());
    }

    /** Get the ConversationMemory for a session, or null if memory is not enabled. */
    public ConversationMemory getMemory(String sessionId) {
        if (memoryProvider == null || sessionId == null || sessionId.isBlank()) return null;
        return memoryProvider.getMemory(sessionId);
    }

    public String translate(String text, String targetLang) {
        int reserved = checkQuotaAndReserve();
        String tenantId = TenantContext.tenantId();
        try {
            String cacheOp = "translate:" + targetLang;
            String hit = llmCache.get(cacheOp, text);
            if (hit != null) return hit;
            String systemPrompt = requestBuilder.translatePrompt(targetLang);
            String modelId = resolveModelWithRouter(null, "translate");
            String result =
                    callLlm(
                            systemPrompt,
                            requestEnricher.enrichUserText(text),
                            null,
                            "translate",
                            modelId,
                            null);
            llmCache.put(cacheOp, text, result);
            return result;
        } finally {
            releaseQuota(tenantId, reserved);
        }
    }

    public String summarize(String text) {
        int reserved = checkQuotaAndReserve();
        String tenantId = TenantContext.tenantId();
        try {
            String hit = llmCache.get("summarize", text);
            if (hit != null) return hit;
            String modelId = resolveModelWithRouter(null, "summarize");
            String result =
                    callLlm(
                            requestBuilder.summarizePrompt(),
                            requestEnricher.enrichUserText(text),
                            null,
                            "summarize",
                            modelId,
                            null);
            llmCache.put("summarize", text, result);
            return result;
        } finally {
            releaseQuota(tenantId, reserved);
        }
    }

    public String chat(
            String userMessage,
            List<ChatRequest.MessageItem> history,
            String requestSystemPrompt,
            String requestModel,
            String imageData) {
        return chat(userMessage, history, requestSystemPrompt, requestModel, imageData, null);
    }

    public String chat(
            String userMessage,
            List<ChatRequest.MessageItem> history,
            String requestSystemPrompt,
            String requestModel,
            String imageData,
            String sessionId) {
        int reserved = checkQuotaAndReserve();
        String tenantId = TenantContext.tenantId();
        try {
            String prompt =
                    promptComposer.composeChatSystemPrompt(
                            requestSystemPrompt, sessionId, userMessage);
            int estTokens = LlmRequestBuilder.estimateTokens(prompt, userMessage, history);
            String modelId = resolveModelWithRouter(requestModel, "chat", estTokens);

            ChatInterceptor.ChatContext ctx =
                    new ChatInterceptor.ChatContext(
                            "chat",
                            userMessage,
                            prompt,
                            modelId,
                            tenantId,
                            history,
                            new java.util.HashMap<>());
            ctx = runBeforeInterceptors(ctx);

            String result =
                    callLlm(
                            ctx.systemPrompt(),
                            requestEnricher.enrichUserText(ctx.userMessage()),
                            history,
                            "chat",
                            ctx.modelId() != null ? ctx.modelId() : modelId,
                            imageData);
            result = runAfterInterceptors(ctx, result);
            recordToMemory(sessionId, userMessage, result);
            return result;
        } finally {
            releaseQuota(tenantId, reserved);
        }
    }

    public String chat(
            String userMessage,
            List<ChatRequest.MessageItem> history,
            String requestSystemPrompt,
            String requestModel) {
        return chat(userMessage, history, requestSystemPrompt, requestModel, null);
    }

    public String chat(String userMessage) {
        return chat(userMessage, null, null, null, null);
    }

    public Flux<String> translateStream(String text, String targetLang) {
        int reserved = checkQuotaAndReserve();
        String tenantId = TenantContext.tenantId();
        try {
            String systemPrompt = requestBuilder.translatePrompt(targetLang);
            String modelId = resolveModelWithRouter(null, "translate");
            return callLlmStream(
                            systemPrompt,
                            requestEnricher.enrichUserText(text),
                            null,
                            "translate",
                            modelId,
                            null)
                    .doFinally(signal -> releaseQuota(tenantId, reserved));
        } catch (Exception e) {
            releaseQuota(tenantId, reserved);
            throw e;
        }
    }

    public Flux<String> summarizeStream(String text) {
        int reserved = checkQuotaAndReserve();
        String tenantId = TenantContext.tenantId();
        try {
            String modelId = resolveModelWithRouter(null, "summarize");
            return callLlmStream(
                            requestBuilder.summarizePrompt(),
                            requestEnricher.enrichUserText(text),
                            null,
                            "summarize",
                            modelId,
                            null)
                    .doFinally(signal -> releaseQuota(tenantId, reserved));
        } catch (Exception e) {
            releaseQuota(tenantId, reserved);
            throw e;
        }
    }

    public Flux<String> chatStream(
            String userMessage,
            List<ChatRequest.MessageItem> history,
            String requestSystemPrompt,
            String requestModel,
            String imageData) {
        return chatStream(userMessage, history, requestSystemPrompt, requestModel, imageData, null);
    }

    public Flux<String> chatStream(
            String userMessage,
            List<ChatRequest.MessageItem> history,
            String requestSystemPrompt,
            String requestModel,
            String imageData,
            String sessionId) {
        int reserved = checkQuotaAndReserve();
        String tenantId = TenantContext.tenantId();
        try {
            String prompt =
                    promptComposer.composeChatSystemPrompt(
                            requestSystemPrompt, sessionId, userMessage);
            int estTokens = LlmRequestBuilder.estimateTokens(prompt, userMessage, history);
            String modelId = resolveModelWithRouter(requestModel, "chat", estTokens);

            ChatInterceptor.ChatContext ctx =
                    new ChatInterceptor.ChatContext(
                            "chat",
                            userMessage,
                            prompt,
                            modelId,
                            tenantId,
                            history,
                            new java.util.HashMap<>());
            ctx = runBeforeInterceptors(ctx);

            final String finalSessionId = sessionId;
            final String originalMessage = userMessage;
            Flux<String> flux =
                    callLlmStream(
                            ctx.systemPrompt(),
                            requestEnricher.enrichUserText(ctx.userMessage()),
                            history,
                            "chat",
                            ctx.modelId() != null ? ctx.modelId() : modelId,
                            imageData);

            if (memoryProvider != null && finalSessionId != null && !finalSessionId.isBlank()) {
                StringBuilder fullResponse = new StringBuilder();
                flux =
                        flux.doOnNext(fullResponse::append)
                                .doOnComplete(
                                        () ->
                                                recordToMemory(
                                                        finalSessionId,
                                                        originalMessage,
                                                        fullResponse.toString()));
            }
            return flux.doFinally(signal -> releaseQuota(tenantId, reserved));
        } catch (Exception e) {
            releaseQuota(tenantId, reserved);
            throw e;
        }
    }

    public Flux<String> chatStream(
            String userMessage,
            List<ChatRequest.MessageItem> history,
            String requestSystemPrompt,
            String requestModel) {
        return chatStream(userMessage, history, requestSystemPrompt, requestModel, null);
    }

    public Flux<String> chatStream(String userMessage) {
        return chatStream(userMessage, null, null, null, null);
    }

    private String callLlm(
            String systemPrompt,
            String userMessage,
            List<ChatRequest.MessageItem> history,
            String operation,
            String modelId,
            String imageData) {
        userMessage = requestBuilder.clampUserMessage(userMessage, history, systemPrompt);
        String currentModel = modelId;
        RuntimeException lastError = null;
        long startMs = System.currentTimeMillis();

        for (int attempt = 0; attempt < 3; attempt++) {
            ObjectNode body =
                    requestBuilder.buildRequestBody(
                            systemPrompt, userMessage, false, history, currentModel, imageData);
            if (!"chat".equals(operation)) {
                body.remove("tools");
            }
            String key = keyRotator.nextKey();
            Timer.Sample sample = meterRegistry != null ? Timer.start(meterRegistry) : null;
            String rawResponse;
            try {
                rawResponse = chatCompletionClient.completeRaw(body, key);
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
                emitAuditEvent(operation, currentModel, 0, 0,
                        System.currentTimeMillis() - startMs, AuditEvent.Outcome.ERROR);
                throw e;
            }
            try {
                int[] tokenCounts =
                        responsePostProcessor.extractAndRecord(rawResponse, currentModel);
                String result = processToolCallingLoop(body, rawResponse, key);
                result = responsePostProcessor.filterSync(result);
                keyRotator.markSuccess(key);
                if (sample != null) sample.stop(completionTimer(operation, "success"));
                emitAuditEvent(operation, currentModel, tokenCounts[0], tokenCounts[1],
                        System.currentTimeMillis() - startMs, AuditEvent.Outcome.SUCCESS);
                return result;
            } catch (RuntimeException e) {
                if (sample != null) sample.stop(completionTimer(operation, "error"));
                emitAuditEvent(operation, currentModel, 0, 0,
                        System.currentTimeMillis() - startMs, AuditEvent.Outcome.ERROR);
                throw e;
            }
        }
        throw lastError != null ? lastError : new RuntimeException("All fallback models exhausted");
    }

    private void emitAuditEvent(String action, String modelId, int promptTokens,
                                int completionTokens, long latencyMs, AuditEvent.Outcome outcome) {
        if (auditEventStore == null) return;
        try {
            auditEventStore.record(AuditEvent.builder()
                    .tenantId(TenantContext.tenantId())
                    .action(action)
                    .modelId(modelId)
                    .promptTokens(promptTokens)
                    .completionTokens(completionTokens)
                    .latencyMs(latencyMs)
                    .outcome(outcome)
                    .build());
        } catch (Exception e) {
            log.debug("Audit event emission failed: {}", e.getMessage());
        }
    }

    private String processToolCallingLoop(ObjectNode body, String rawResponse, String apiKey) {
        if (toolRegistry == null || toolRegistry.isEmpty()) {
            return responsePostProcessor.parseContentFromRaw(rawResponse);
        }
        String modelId = body.path("model").asText("");
        for (int round = 0; round < MAX_TOOL_ROUNDS; round++) {
            JsonNode root;
            try {
                root = objectMapper.readTree(rawResponse);
            } catch (Exception e) {
                log.warn(
                        "Failed to parse LLM response in tool loop (round {}): {}",
                        round,
                        e.getMessage());
                return "AI service returned an unparseable response.";
            }
            JsonNode choices = root.path("choices");
            if (!choices.isArray() || choices.isEmpty()) {
                return responsePostProcessor.parseContentFromRaw(rawResponse);
            }

            JsonNode firstChoice = choices.get(0);
            JsonNode msg = firstChoice.path("message");
            String finishReason = firstChoice.path("finish_reason").asText("");
            JsonNode toolCalls = msg.path("tool_calls");

            if (!"tool_calls".equals(finishReason) || !toolCalls.isArray() || toolCalls.isEmpty()) {
                return msg.path("content").asText("");
            }

            JsonNode messagesNode = body.get("messages");
            if (messagesNode == null || !messagesNode.isArray()) {
                throw new RuntimeException("Malformed request body: 'messages' is not an array");
            }
            ArrayNode messages = (ArrayNode) messagesNode;
            ObjectNode assistantMsg = messages.addObject();
            assistantMsg.put("role", "assistant");
            if (msg.has("content") && !msg.get("content").isNull()) {
                assistantMsg.put("content", msg.get("content").asText(""));
            } else {
                assistantMsg.putNull("content");
            }
            assistantMsg.set("tool_calls", toolCalls);

            for (JsonNode tc : toolCalls) {
                String callId = tc.path("id").asText();
                String fnName = tc.path("function").path("name").asText();
                String argsStr = tc.path("function").path("arguments").asText("{}");
                String toolResult;
                try {
                    JsonNode args = objectMapper.readTree(argsStr);
                    toolResult = toolRegistry.execute(fnName, args);
                } catch (Exception e) {
                    toolResult = "Error: " + e.getMessage();
                    log.warn("Tool execution failed: {} - {}", fnName, e.getMessage());
                }
                ObjectNode toolMsg = messages.addObject();
                toolMsg.put("role", "tool");
                toolMsg.put("tool_call_id", callId);
                toolMsg.put("content", toolResult);
            }

            rawResponse = chatCompletionClient.completeRaw(body, apiKey);
            responsePostProcessor.extractAndRecord(rawResponse, modelId);
        }
        return responsePostProcessor.parseContentFromRaw(rawResponse);
    }

    private Timer completionTimer(String operation, String outcome) {
        return Timer.builder("aiassistant.llm.completion")
                .description("LLM /chat/completions (non-stream) latency")
                .tag("operation", operation)
                .tag("outcome", outcome)
                .register(meterRegistry);
    }

    private Flux<String> callLlmStream(
            String systemPrompt,
            String userMessage,
            List<ChatRequest.MessageItem> history,
            String operation,
            String modelId,
            String imageData) {
        userMessage = requestBuilder.clampUserMessage(userMessage, history, systemPrompt);
        ObjectNode body =
                requestBuilder.buildRequestBody(systemPrompt, userMessage, true, history, modelId, imageData);
        if (!"chat".equals(operation)) {
            body.remove("tools");
        }
        String key = keyRotator.nextKey();
        long startMs = System.currentTimeMillis();

        AtomicInteger streamCharCount = new AtomicInteger(0);

        if (toolRegistry != null && !toolRegistry.isEmpty() && body.has("tools")) {
            return responsePostProcessor
                    .filterStream(callLlmStreamWithTools(body, key, operation), modelId)
                    .doOnNext(chunk -> streamCharCount.addAndGet(chunk.length()))
                    .doFinally(signal -> {
                        AuditEvent.Outcome outcome = signal == SignalType.ON_COMPLETE
                                ? AuditEvent.Outcome.SUCCESS : AuditEvent.Outcome.ERROR;
                        emitAuditEvent(operation, modelId, 0, streamCharCount.get() / 4,
                                System.currentTimeMillis() - startMs, outcome);
                    });
        }

        Flux<String> flux =
                chatCompletionClient
                        .completeStream(body, key)
                        .onBackpressureBuffer(256, BufferOverflowStrategy.DROP_OLDEST)
                        .doOnError(e -> keyRotator.markFailed(key));
        flux = responsePostProcessor.filterStream(flux, modelId);
        Timer.Sample sample = meterRegistry != null ? Timer.start(meterRegistry) : null;
        return flux.doOnNext(chunk -> streamCharCount.addAndGet(chunk.length()))
                .doFinally(
                signal -> {
                    String outcomeStr =
                            signal == SignalType.ON_COMPLETE
                                    ? "success"
                                    : signal == SignalType.ON_ERROR ? "error" : "cancel";
                    if (sample != null) sample.stop(streamTimer(operation, outcomeStr));
                    AuditEvent.Outcome auditOutcome = signal == SignalType.ON_COMPLETE
                            ? AuditEvent.Outcome.SUCCESS : AuditEvent.Outcome.ERROR;
                    emitAuditEvent(operation, modelId, 0, streamCharCount.get() / 4,
                            System.currentTimeMillis() - startMs, auditOutcome);
                });
    }

    private Flux<String> callLlmStreamWithTools(ObjectNode body, String apiKey, String operation) {
        return Flux.defer(
                () -> {
                    ObjectNode probeBody = body.deepCopy();
                    probeBody.put("stream", false);
                    try {
                        String rawResponse = chatCompletionClient.completeRaw(probeBody, apiKey);
                        JsonNode root = objectMapper.readTree(rawResponse);
                        JsonNode choices = root.path("choices");
                        if (!choices.isArray() || choices.isEmpty()) {
                            return Flux.just(responsePostProcessor.parseContentFromRaw(rawResponse));
                        }
                        JsonNode firstChoice = choices.get(0);
                        String finishReason = firstChoice.path("finish_reason").asText("");
                        JsonNode toolCalls = firstChoice.path("message").path("tool_calls");

                        if (!"tool_calls".equals(finishReason)
                                || !toolCalls.isArray()
                                || toolCalls.isEmpty()) {
                            return chatCompletionClient.completeStream(body, apiKey);
                        }

                        return executeToolsWithProgress(
                                        probeBody, firstChoice.path("message"), toolCalls, apiKey)
                                .subscribeOn(Schedulers.boundedElastic());
                    } catch (Exception e) {
                        keyRotator.markFailed(apiKey);
                        return Flux.error(e);
                    }
                });
    }

    private Flux<String> executeToolsWithProgress(
            ObjectNode body, JsonNode assistantMessage, JsonNode toolCalls, String apiKey) {
        long toolLoopTimeoutMs =
                Math.max(1, Math.min(properties.getTimeoutSeconds(), 600))
                        * 1000L
                        * MAX_TOOL_ROUNDS;
        return Flux.create(
                sink -> {
                    try {
                        long deadline = System.currentTimeMillis() + toolLoopTimeoutMs;
                        ObjectNode bodyClone = body.deepCopy();
                        bodyClone.put("stream", false);
                        JsonNode msgsNode = bodyClone.get("messages");
                        if (msgsNode == null || !msgsNode.isArray()) {
                            sink.error(new RuntimeException(
                                    "Malformed request body: 'messages' is not an array"));
                            return;
                        }
                        ArrayNode messages = (ArrayNode) msgsNode;
                        JsonNode curAssistantMsg = assistantMessage;
                        JsonNode curToolCalls = toolCalls;

                        for (int round = 0; round < MAX_TOOL_ROUNDS; round++) {
                            if (System.currentTimeMillis() > deadline) {
                                sink.next(
                                        "\n\n> ⚠️ Tool calling loop timed out after "
                                                + (toolLoopTimeoutMs / 1000)
                                                + "s\n");
                                break;
                            }
                            ObjectNode aMsg = messages.addObject();
                            aMsg.put("role", "assistant");
                            if (curAssistantMsg.has("content")
                                    && !curAssistantMsg.get("content").isNull()) {
                                aMsg.put("content", curAssistantMsg.get("content").asText(""));
                            } else {
                                aMsg.putNull("content");
                            }
                            aMsg.set("tool_calls", curToolCalls);

                            for (JsonNode tc : curToolCalls) {
                                String callId = tc.path("id").asText();
                                String fnName = tc.path("function").path("name").asText();
                                String argsStr = tc.path("function").path("arguments").asText("{}");

                                sink.next(
                                        "\n\n> \uD83D\uDD27 **"
                                                + fnName
                                                + "** `"
                                                + truncate(argsStr, 80)
                                                + "`\n");

                                String toolResult;
                                try {
                                    JsonNode args = objectMapper.readTree(argsStr);
                                    toolResult = toolRegistry.execute(fnName, args);
                                } catch (Exception e) {
                                    toolResult = "Error: " + e.getMessage();
                                    log.warn(
                                            "Tool execution failed: {} - {}",
                                            fnName,
                                            e.getMessage());
                                }

                                sink.next("> ✅ " + truncate(toolResult, 120) + "\n\n");

                                ObjectNode toolMsg = messages.addObject();
                                toolMsg.put("role", "tool");
                                toolMsg.put("tool_call_id", callId);
                                toolMsg.put("content", toolResult);
                            }

                            String rawResponse =
                                    chatCompletionClient.completeRaw(bodyClone, apiKey);
                            JsonNode root = objectMapper.readTree(rawResponse);
                            JsonNode choices = root.path("choices");
                            if (!choices.isArray() || choices.isEmpty()) {
                                sink.next(responsePostProcessor.parseContentFromRaw(rawResponse));
                                break;
                            }
                            JsonNode nextChoice = choices.get(0);
                            String nextFinish = nextChoice.path("finish_reason").asText("");
                            JsonNode nextToolCalls = nextChoice.path("message").path("tool_calls");

                            if (!"tool_calls".equals(nextFinish)
                                    || !nextToolCalls.isArray()
                                    || nextToolCalls.isEmpty()) {
                                sink.next(nextChoice.path("message").path("content").asText(""));
                                break;
                            }
                            curAssistantMsg = nextChoice.path("message");
                            curToolCalls = nextToolCalls;
                        }
                        sink.complete();
                    } catch (Exception e) {
                        sink.error(e);
                    }
                });
    }

    private static String truncate(String s, int maxLen) {
        if (s == null) return "";
        return s.length() <= maxLen ? s : s.substring(0, maxLen) + "…";
    }

    private String resolveModelWithRouter(String requestModel, String operation) {
        return resolveModelWithRouter(requestModel, operation, 0);
    }

    private String resolveModelWithRouter(
            String requestModel, String operation, int estimatedTokens) {
        String baseModel = properties.resolveEffectiveModel(requestModel);
        if (modelRouter == null) return baseModel;
        try {
            String tenantId = TenantContext.tenantId();
            var decision = modelRouter.route(operation, tenantId, estimatedTokens);
            if (decision != null && decision.modelId() != null && !decision.modelId().isBlank()) {
                log.debug(
                        "ModelRouter selected: {} (reason: {})",
                        decision.modelId(),
                        decision.reason());
                return decision.modelId();
            }
        } catch (Exception e) {
            log.debug("ModelRouter fallback to default: {}", e.getMessage());
        }
        return baseModel;
    }

    /**
     * Atomically checks quota and reserves estimated tokens. Returns the reserved token count (0 if
     * no tracker or no quota). Must be paired with {@link #releaseQuota} after the request
     * completes.
     */
    private int checkQuotaAndReserve() {
        if (tokenUsageTracker == null) return 0;
        String tenantId = TenantContext.tenantId();
        int estimate = properties.getMaxTokens();
        if (!tokenUsageTracker.tryReserveQuota(tenantId, estimate)) {
            throw new QuotaExceededException("Token quota exceeded for tenant: " + tenantId);
        }
        return estimate;
    }

    private void releaseQuota(String tenantId, int reserved) {
        if (tokenUsageTracker != null && reserved > 0 && tenantId != null) {
            tokenUsageTracker.releaseReservation(tenantId, reserved);
        }
    }

    public static class QuotaExceededException extends RuntimeException {
        public QuotaExceededException(String message) {
            super(message);
        }
    }

    private void recordToMemory(String sessionId, String userMessage, String assistantMessage) {
        if (memoryProvider == null || sessionId == null || sessionId.isBlank()) return;
        try {
            ConversationMemory memory = memoryProvider.getMemory(sessionId);
            memory.addUserMessage(userMessage);
            memory.addAssistantMessage(assistantMessage);
        } catch (Exception e) {
            log.debug("Memory recording skipped: {}", e.getMessage());
        }
    }

    private ChatInterceptor.ChatContext runBeforeInterceptors(ChatInterceptor.ChatContext ctx) {
        for (ChatInterceptor interceptor : interceptors) {
            try {
                ctx = interceptor.beforeChat(ctx);
            } catch (SecurityException e) {
                log.warn("ChatInterceptor.beforeChat rejected request: {}", e.getMessage());
                throw e;
            } catch (Exception e) {
                log.warn(
                        "ChatInterceptor.beforeChat failed ({}): {}",
                        interceptor.getClass().getSimpleName(),
                        e.getMessage());
            }
        }
        return ctx;
    }

    private String runAfterInterceptors(ChatInterceptor.ChatContext ctx, String response) {
        for (ChatInterceptor interceptor : interceptors) {
            try {
                response = interceptor.afterChat(ctx, response);
            } catch (SecurityException e) {
                log.warn("ChatInterceptor.afterChat rejected response: {}", e.getMessage());
                throw e;
            } catch (Exception e) {
                log.warn(
                        "ChatInterceptor.afterChat failed ({}): {}",
                        interceptor.getClass().getSimpleName(),
                        e.getMessage());
            }
        }
        return response;
    }

    private Timer streamTimer(String operation, String outcome) {
        return Timer.builder("aiassistant.llm.stream")
                .description("LLM /chat/completions SSE until terminal signal")
                .tag("operation", operation)
                .tag("outcome", outcome)
                .register(meterRegistry);
    }
}
