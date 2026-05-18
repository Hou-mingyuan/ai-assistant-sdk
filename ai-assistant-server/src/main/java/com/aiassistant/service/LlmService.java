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
import com.aiassistant.service.llm.BlockingLlmCallExecutor;
import com.aiassistant.service.llm.ChatCompletionClient;
import com.aiassistant.service.llm.PromptComposer;
import com.aiassistant.service.llm.RequestEnricher;
import com.aiassistant.service.llm.ResponsePostProcessor;
import com.aiassistant.service.llm.StreamingLlmCallExecutor;
import com.aiassistant.service.llm.StreamingToolCallingLoop;
import com.aiassistant.service.llm.ToolCallingLoop;
import com.aiassistant.spi.ChatInterceptor;
import com.aiassistant.spi.ConversationMemoryProvider;
import com.aiassistant.stats.TokenUsageTracker;
import com.aiassistant.tool.ToolRegistry;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import io.micrometer.core.instrument.MeterRegistry;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import reactor.core.publisher.Flux;

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
    private final ToolCallingLoop toolCallingLoop;
    private final StreamingToolCallingLoop streamingToolCallingLoop;
    private final BlockingLlmCallExecutor blockingExecutor;
    private final StreamingLlmCallExecutor streamingExecutor;

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
        /* K18: delegate the blocking tool-calling loop to the extracted
         * ToolCallingLoop class. The local processToolCallingLoop method
         * is now a one-line forwarder; the algorithm + 5 unit tests live
         * in com.aiassistant.service.llm.ToolCallingLoop (K12). */
        this.toolCallingLoop =
                new ToolCallingLoop(
                        toolRegistry,
                        chatCompletionClient,
                        responsePostProcessor,
                        objectMapper,
                        MAX_TOOL_ROUNDS);
        /* K20: streaming-side tool-calling loop, extracted from LlmService into its own
         * unit-testable class. The per-call timeout below mirrors the previous inline math
         * (timeoutSeconds * 1000 * MAX_TOOL_ROUNDS) by passing the per-call ms; the loop class
         * multiplies by maxRounds internally so the total budget stays identical. */
        int perCallTimeoutMs = Math.max(1, Math.min(properties.getTimeoutSeconds(), 600)) * 1000;
        this.streamingToolCallingLoop =
                new StreamingToolCallingLoop(
                        toolRegistry,
                        chatCompletionClient,
                        responsePostProcessor,
                        objectMapper,
                        MAX_TOOL_ROUNDS,
                        perCallTimeoutMs);
        /* K28: blocking attempt+fallback orchestrator. Tenant-context capture for
         * AuditEvent emission happens in the closure so the executor itself stays
         * tenant-context-agnostic. */
        this.blockingExecutor =
                new BlockingLlmCallExecutor(
                        requestBuilder,
                        keyRotator,
                        chatCompletionClient,
                        responsePostProcessor,
                        toolCallingLoop,
                        modelRouter,
                        meterRegistry,
                        this::emitAuditEventFromExecutor);
        /* K53.1: mirror of BlockingLlmCallExecutor for the SSE path. The
         * historical callLlmStream() body now forwards to streamingExecutor. */
        this.streamingExecutor =
                new StreamingLlmCallExecutor(
                        requestBuilder,
                        keyRotator,
                        chatCompletionClient,
                        responsePostProcessor,
                        toolRegistry,
                        streamingToolCallingLoop,
                        meterRegistry,
                        this::emitAuditEventFromExecutor);

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
                            (String) null);
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
                            (String) null);
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
        return chat(userMessage, history, requestSystemPrompt, requestModel, imageData, null, null);
    }

    public String chat(
            String userMessage,
            List<ChatRequest.MessageItem> history,
            String requestSystemPrompt,
            String requestModel,
            String imageData,
            String sessionId) {
        return chat(
                userMessage,
                history,
                requestSystemPrompt,
                requestModel,
                imageData,
                sessionId,
                null);
    }

    public String chat(
            String userMessage,
            List<ChatRequest.MessageItem> history,
            String requestSystemPrompt,
            String requestModel,
            String imageData,
            String sessionId,
            String pageContext) {
        return chatWithImages(
                userMessage,
                history,
                requestSystemPrompt,
                requestModel,
                ChatRequest.resolveImageDataList(imageData, null),
                sessionId,
                pageContext);
    }

    public String chat(
            String userMessage,
            List<ChatRequest.MessageItem> history,
            String requestSystemPrompt,
            String requestModel,
            List<String> imageDataList) {
        return chatWithImages(
                userMessage, history, requestSystemPrompt, requestModel, imageDataList, null, null);
    }

    public String chat(
            String userMessage,
            List<ChatRequest.MessageItem> history,
            String requestSystemPrompt,
            String requestModel,
            List<String> imageDataList,
            String sessionId,
            String pageContext) {
        return chatWithImages(
                userMessage,
                history,
                requestSystemPrompt,
                requestModel,
                imageDataList,
                sessionId,
                pageContext);
    }

    private String chatWithImages(
            String userMessage,
            List<ChatRequest.MessageItem> history,
            String requestSystemPrompt,
            String requestModel,
            List<String> imageDataList,
            String sessionId,
            String pageContext) {
        int reserved = checkQuotaAndReserve();
        String tenantId = TenantContext.tenantId();
        try {
            String prompt =
                    promptComposer.composeChatSystemPrompt(
                            requestSystemPrompt, sessionId, userMessage, pageContext);
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
            String effectiveModelId = ctx.modelId() != null ? ctx.modelId() : modelId;
            ctx = ctx.withSystemPrompt(appendRuntimeModelIdentity(ctx.systemPrompt(), effectiveModelId));

            String result =
                    callLlm(
                            ctx.systemPrompt(),
                            requestEnricher.enrichUserText(ctx.userMessage()),
                            history,
                            "chat",
                            effectiveModelId,
                            imageDataList);
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
        return chat(userMessage, history, requestSystemPrompt, requestModel, (String) null);
    }

    public String chat(String userMessage) {
        return chat(userMessage, null, null, null, (String) null);
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
                            (String) null)
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
                            (String) null)
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
        return chatStream(
                userMessage, history, requestSystemPrompt, requestModel, imageData, null, null);
    }

    public Flux<String> chatStream(
            String userMessage,
            List<ChatRequest.MessageItem> history,
            String requestSystemPrompt,
            String requestModel,
            String imageData,
            String sessionId) {
        return chatStream(
                userMessage,
                history,
                requestSystemPrompt,
                requestModel,
                imageData,
                sessionId,
                null);
    }

    public Flux<String> chatStream(
            String userMessage,
            List<ChatRequest.MessageItem> history,
            String requestSystemPrompt,
            String requestModel,
            String imageData,
            String sessionId,
            String pageContext) {
        return chatStreamWithImages(
                userMessage,
                history,
                requestSystemPrompt,
                requestModel,
                ChatRequest.resolveImageDataList(imageData, null),
                sessionId,
                pageContext);
    }

    public Flux<String> chatStream(
            String userMessage,
            List<ChatRequest.MessageItem> history,
            String requestSystemPrompt,
            String requestModel,
            List<String> imageDataList,
            String sessionId,
            String pageContext) {
        return chatStreamWithImages(
                userMessage,
                history,
                requestSystemPrompt,
                requestModel,
                imageDataList,
                sessionId,
                pageContext);
    }

    private Flux<String> chatStreamWithImages(
            String userMessage,
            List<ChatRequest.MessageItem> history,
            String requestSystemPrompt,
            String requestModel,
            List<String> imageDataList,
            String sessionId,
            String pageContext) {
        int reserved = checkQuotaAndReserve();
        String tenantId = TenantContext.tenantId();
        try {
            String prompt =
                    promptComposer.composeChatSystemPrompt(
                            requestSystemPrompt, sessionId, userMessage, pageContext);
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
            String effectiveModelId = ctx.modelId() != null ? ctx.modelId() : modelId;
            ctx = ctx.withSystemPrompt(appendRuntimeModelIdentity(ctx.systemPrompt(), effectiveModelId));

            final String finalSessionId = sessionId;
            final String originalMessage = userMessage;
            Flux<String> flux =
                    callLlmStream(
                            ctx.systemPrompt(),
                            requestEnricher.enrichUserText(ctx.userMessage()),
                            history,
                            "chat",
                            effectiveModelId,
                            imageDataList);

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
        return chatStream(userMessage, history, requestSystemPrompt, requestModel, (String) null);
    }

    public Flux<String> chatStream(String userMessage) {
        return chatStream(userMessage, null, null, null, (String) null);
    }

    /**
     * Delegate to {@link BlockingLlmCallExecutor} (K28). The attempt + fallback + key-rotation +
     * tool-calling + audit orchestration lives in its own class with dedicated unit tests; this
     * wrapper preserves the original private signature so existing call sites at chat/summarize/
     * translate need not change.
     */
    private String callLlm(
            String systemPrompt,
            String userMessage,
            List<ChatRequest.MessageItem> history,
            String operation,
            String modelId,
            String imageData) {
        return callLlm(
                systemPrompt,
                userMessage,
                history,
                operation,
                modelId,
                ChatRequest.resolveImageDataList(imageData, null));
    }

    private String callLlm(
            String systemPrompt,
            String userMessage,
            List<ChatRequest.MessageItem> history,
            String operation,
            String modelId,
            List<String> imageDataList) {
        return blockingExecutor.execute(
                systemPrompt, userMessage, history, operation, modelId, imageDataList);
    }

    /**
     * Adapter that bridges {@link BlockingLlmCallExecutor.AuditEmitter} to the existing {@link
     * #emitAuditEvent} method so we keep tenant-context handling on this side.
     */
    private void emitAuditEventFromExecutor(
            String operation,
            String modelId,
            int promptTokens,
            int completionTokens,
            long latencyMs,
            AuditEvent.Outcome outcome) {
        emitAuditEvent(operation, modelId, promptTokens, completionTokens, latencyMs, outcome);
    }

    private void emitAuditEvent(
            String action,
            String modelId,
            int promptTokens,
            int completionTokens,
            long latencyMs,
            AuditEvent.Outcome outcome) {
        if (auditEventStore == null) return;
        try {
            auditEventStore.record(
                    AuditEvent.builder()
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

    /**
     * Delegate to the extracted {@link ToolCallingLoop} (K12). This wrapper preserves the original
     * private signature so existing call sites remain identical; the algorithm lives in
     * ToolCallingLoop and has 5 dedicated unit tests.
     */
    private String processToolCallingLoop(ObjectNode body, String rawResponse, String apiKey) {
        return toolCallingLoop.execute(body, rawResponse, apiKey);
    }

    /* K28: completionTimer() removed — moved into BlockingLlmCallExecutor.
     * K53.1: streamTimer() + callLlmStreamWithTools() removed — both moved
     * into StreamingLlmCallExecutor along with the only callsites in
     * callLlmStream. */

    /**
     * Delegate to {@link StreamingLlmCallExecutor} (K53.1). The streaming attempt + tool-call
     * branch + backpressure + metric / audit emission lives in the executor; this method preserves
     * the historical private signature for unchanged call sites in {@link #chatStream}, {@link
     * #translateStream}, {@link #summarizeStream}.
     */
    private Flux<String> callLlmStream(
            String systemPrompt,
            String userMessage,
            List<ChatRequest.MessageItem> history,
            String operation,
            String modelId,
            String imageData) {
        return callLlmStream(
                systemPrompt,
                userMessage,
                history,
                operation,
                modelId,
                ChatRequest.resolveImageDataList(imageData, null));
    }

    private Flux<String> callLlmStream(
            String systemPrompt,
            String userMessage,
            List<ChatRequest.MessageItem> history,
            String operation,
            String modelId,
            List<String> imageDataList) {
        return streamingExecutor.stream(
                systemPrompt, userMessage, history, operation, modelId, imageDataList);
    }

    private String resolveModelWithRouter(String requestModel, String operation) {
        return resolveModelWithRouter(requestModel, operation, 0);
    }

    private String appendRuntimeModelIdentity(String systemPrompt, String modelId) {
        if (modelId == null || modelId.isBlank()) {
            return systemPrompt;
        }
        String prompt = systemPrompt == null ? "" : systemPrompt;
        return prompt
                + "\n\nRuntime model identity: The current model for this request is `"
                + modelId
                + "`. If the user asks what model you are, what the current model is, or what"
                + " underlying model is being used, answer with this current model name. Do not"
                + " invent or hard-code a different model name.";
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
}
