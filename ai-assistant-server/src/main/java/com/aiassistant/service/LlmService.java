package com.aiassistant.service;

import com.aiassistant.config.AiAssistantProperties;
import com.aiassistant.config.TenantContext;
import com.aiassistant.memory.ConversationMemory;
import com.aiassistant.model.ChatInputLimits;
import com.aiassistant.model.ChatRequest;
import com.aiassistant.rag.RagService;
import com.aiassistant.routing.ModelRouter;
import com.aiassistant.security.ContentFilter;
import com.aiassistant.service.llm.ChatCompletionClient;
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
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import reactor.core.publisher.BufferOverflowStrategy;
import reactor.core.publisher.Flux;
import reactor.core.publisher.SignalType;
import reactor.core.scheduler.Schedulers;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Core service for AI assistant operations: chat, translate, summarize (sync &amp; streaming).
 * <p>Delegates to {@link ChatCompletionClient} for LLM calls and {@link UrlFetchService} for
 * enriching user messages with linked page content. Supports multiple API keys with round-robin rotation.</p>
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
    private final ObjectMapper objectMapper = new ObjectMapper();
    private static final int MAX_TOOL_ROUNDS = 5;
    private final List<String> apiKeys;
    private final AtomicInteger keyIndex = new AtomicInteger(0);
    private final ConcurrentHashMap<String, Long> keyCooldown = new ConcurrentHashMap<>();
    private static final long KEY_COOLDOWN_MS = 30_000;

    private static final int LLM_CACHE_MAX = 500;
    private static final long LLM_CACHE_TTL_MS = 300_000; // 5 min
    private final Map<String, LlmCacheEntry> llmCache = java.util.Collections.synchronizedMap(
            new LinkedHashMap<>(16, 0.75f, true) {
                @Override
                protected boolean removeEldestEntry(Map.Entry<String, LlmCacheEntry> eldest) {
                    return size() > LLM_CACHE_MAX || eldest.getValue().isExpired();
                }
            });
    private record LlmCacheEntry(byte[] compressed, long expiresAt) {
        boolean isExpired() { return System.currentTimeMillis() > expiresAt; }
        String decompress() {
            try (var bais = new java.io.ByteArrayInputStream(compressed);
                 var gzis = new java.util.zip.GZIPInputStream(bais)) {
                return new String(gzis.readAllBytes(), java.nio.charset.StandardCharsets.UTF_8);
            } catch (Exception e) {
                log.warn("Cache entry decompression failed, treating as cache miss: {}", e.getMessage());
                return null;
            }
        }
        static byte[] compress(String text) {
            try (var baos = new java.io.ByteArrayOutputStream();
                 var gzos = new java.util.zip.GZIPOutputStream(baos)) {
                gzos.write(text.getBytes(java.nio.charset.StandardCharsets.UTF_8));
                gzos.finish();
                return baos.toByteArray();
            } catch (Exception e) { return text.getBytes(java.nio.charset.StandardCharsets.UTF_8); }
        }
    }

    /** 与翻译模式、流式翻译、文件翻译共用：走同一 LLM，强调口语化、地道表达 */
    private static final Map<String, String> TRANSLATE_PROMPTS = Map.of(
            "zh", "You are a skilled translator. Translate the following into natural, colloquial Chinese "
                    + "(how people actually write in chat or daily life—avoid stiff textbook tone unless the source is formal). "
                    + "Output only the translation, no explanation.",
            "en", "You are a skilled translator. Translate the following into natural, conversational English "
                    + "(clear and idiomatic; not unnecessarily formal unless the source is formal). "
                    + "Output only the translation, no explanation.",
            "ja", "You are a skilled translator. Translate the following into natural, everyday Japanese. "
                    + "Output only the translation, no explanation."
    );

    private static final String SUMMARIZE_PROMPT =
            "You are a professional content summarizer. Summarize the following text concisely in the same language as the input. " +
                    "Output a brief summary with key points.";

    public LlmService(AiAssistantProperties properties,
                        UrlFetchService urlFetchService,
                        ChatCompletionClient chatCompletionClient,
                        MeterRegistry meterRegistry,
                        ToolRegistry toolRegistry,
                        ContentFilter contentFilter,
                        TokenUsageTracker tokenUsageTracker,
                        ModelRouter modelRouter,
                        RagService ragService) {
        this(properties, urlFetchService, chatCompletionClient, meterRegistry, toolRegistry,
                contentFilter, tokenUsageTracker, modelRouter, ragService, null, null);
    }

    public LlmService(AiAssistantProperties properties,
                        UrlFetchService urlFetchService,
                        ChatCompletionClient chatCompletionClient,
                        MeterRegistry meterRegistry,
                        ToolRegistry toolRegistry,
                        ContentFilter contentFilter,
                        TokenUsageTracker tokenUsageTracker,
                        ModelRouter modelRouter,
                        RagService ragService,
                        ConversationMemoryProvider memoryProvider,
                        List<ChatInterceptor> interceptors) {
        this.apiKeys = properties.resolveApiKeys();
        if (apiKeys.isEmpty()) {
            throw new IllegalArgumentException("ai-assistant.api-key must be configured");
        }
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

        int timeout = Math.max(1, Math.min(properties.getTimeoutSeconds(), 600));
        log.info("AI Assistant initialized: provider={}, model={}, timeout={}s, keys={}, metrics={}, pii={}, rag={}, memory={}, interceptors={}",
                properties.getProvider(), properties.resolveModel(), timeout, apiKeys.size(),
                meterRegistry != null, contentFilter != null, ragService != null,
                memoryProvider != null, this.interceptors.size());
    }

    /**
     * Get the ConversationMemory for a session, or null if memory is not enabled.
     */
    public ConversationMemory getMemory(String sessionId) {
        if (memoryProvider == null || sessionId == null || sessionId.isBlank()) return null;
        return memoryProvider.getMemory(sessionId);
    }

    private String nextApiKey() {
        long now = System.currentTimeMillis();
        keyCooldown.entrySet().removeIf(e -> now >= e.getValue());
        int size = apiKeys.size();
        for (int attempt = 0; attempt < size; attempt++) {
            int idx = keyIndex.getAndUpdate(i -> (i + 1) % size);
            String key = apiKeys.get(idx);
            Long until = keyCooldown.get(key);
            if (until == null || now >= until) {
                return key;
            }
        }
        int idx = keyIndex.getAndUpdate(i -> (i + 1) % size);
        return apiKeys.get(idx);
    }

    private void markKeyFailed(String key) {
        long until = System.currentTimeMillis() + KEY_COOLDOWN_MS;
        keyCooldown.put(key, until);
        String masked = key.length() > 8 ? key.substring(0, 4) + "****" + key.substring(key.length() - 4) : "****";
        int active = apiKeys.size() - keyCooldown.size();
        log.warn("api.key.cooldown key={} cooldownUntil={} activeKeys={}/{}", masked, until, Math.max(0, active), apiKeys.size());
    }

    public String translate(String text, String targetLang) {
        int reserved = checkQuotaAndReserve();
        String tenantId = TenantContext.tenantId();
        try {
            String systemPrompt = TRANSLATE_PROMPTS.getOrDefault(
                    targetLang,
                    "You are a skilled translator. Translate the following into natural, idiomatic "
                            + targetLang
                            + " (conversational where appropriate). Output only the translation, no explanation.");
            String cacheKey = llmCacheKey("translate:" + targetLang, text);
            LlmCacheEntry cached = llmCache.get(cacheKey);
            if (cached != null && !cached.isExpired()) {
                String hit = cached.decompress();
                if (hit != null) return hit;
                llmCache.remove(cacheKey);
            }
            String modelId = resolveModelWithRouter(null, "translate");
            String result = callLlm(systemPrompt, prepareUserText(text), null, "translate", modelId, null);
            llmCache.put(cacheKey, new LlmCacheEntry(LlmCacheEntry.compress(result), System.currentTimeMillis() + LLM_CACHE_TTL_MS));
            return result;
        } finally {
            releaseQuota(tenantId, reserved);
        }
    }

    public String summarize(String text) {
        int reserved = checkQuotaAndReserve();
        String tenantId = TenantContext.tenantId();
        try {
            String cacheKey = llmCacheKey("summarize", text);
            LlmCacheEntry cached = llmCache.get(cacheKey);
            if (cached != null && !cached.isExpired()) {
                String hit = cached.decompress();
                if (hit != null) return hit;
                llmCache.remove(cacheKey);
            }
            String modelId = resolveModelWithRouter(null, "summarize");
            String result = callLlm(SUMMARIZE_PROMPT, prepareUserText(text), null, "summarize", modelId, null);
            llmCache.put(cacheKey, new LlmCacheEntry(LlmCacheEntry.compress(result), System.currentTimeMillis() + LLM_CACHE_TTL_MS));
            return result;
        } finally {
            releaseQuota(tenantId, reserved);
        }
    }

    private static String llmCacheKey(String operation, String text) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            md.update(operation.getBytes(StandardCharsets.UTF_8));
            md.update(text.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(md.digest());
        } catch (Exception e) {
            return operation + ":" + text.hashCode();
        }
    }

    public String chat(String userMessage, List<ChatRequest.MessageItem> history, String requestSystemPrompt,
                       String requestModel, String imageData) {
        return chat(userMessage, history, requestSystemPrompt, requestModel, imageData, null);
    }

    public String chat(String userMessage, List<ChatRequest.MessageItem> history, String requestSystemPrompt,
                       String requestModel, String imageData, String sessionId) {
        int reserved = checkQuotaAndReserve();
        String tenantId = TenantContext.tenantId();
        try {
            String prompt = resolveEffectiveSystemPrompt(requestSystemPrompt);
            prompt = enrichWithMemory(prompt, sessionId);
            prompt = enrichWithRag(prompt, userMessage);
            int estTokens = estimateTokens(prompt, userMessage, history);
            String modelId = resolveModelWithRouter(requestModel, "chat", estTokens);

            ChatInterceptor.ChatContext ctx = new ChatInterceptor.ChatContext(
                    "chat", userMessage, prompt, modelId, tenantId, history, new java.util.HashMap<>());
            ctx = runBeforeInterceptors(ctx);

            String result = callLlm(ctx.systemPrompt(), prepareUserText(ctx.userMessage()), history, "chat",
                    ctx.modelId() != null ? ctx.modelId() : modelId, imageData);
            result = runAfterInterceptors(ctx, result);
            recordToMemory(sessionId, userMessage, result);
            return result;
        } finally {
            releaseQuota(tenantId, reserved);
        }
    }

    public String chat(String userMessage, List<ChatRequest.MessageItem> history, String requestSystemPrompt,
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
            String systemPrompt = TRANSLATE_PROMPTS.getOrDefault(
                    targetLang,
                    "You are a skilled translator. Translate the following into natural, idiomatic "
                            + targetLang
                            + " (conversational where appropriate). Output only the translation, no explanation.");
            String modelId = resolveModelWithRouter(null, "translate");
            return callLlmStream(systemPrompt, prepareUserText(text), null, "translate", modelId, null)
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
            return callLlmStream(SUMMARIZE_PROMPT, prepareUserText(text), null, "summarize", modelId, null)
                    .doFinally(signal -> releaseQuota(tenantId, reserved));
        } catch (Exception e) {
            releaseQuota(tenantId, reserved);
            throw e;
        }
    }

    public Flux<String> chatStream(String userMessage, List<ChatRequest.MessageItem> history,
                                   String requestSystemPrompt, String requestModel, String imageData) {
        return chatStream(userMessage, history, requestSystemPrompt, requestModel, imageData, null);
    }

    public Flux<String> chatStream(String userMessage, List<ChatRequest.MessageItem> history,
                                   String requestSystemPrompt, String requestModel, String imageData,
                                   String sessionId) {
        int reserved = checkQuotaAndReserve();
        String tenantId = TenantContext.tenantId();
        try {
            String prompt = resolveEffectiveSystemPrompt(requestSystemPrompt);
            prompt = enrichWithMemory(prompt, sessionId);
            prompt = enrichWithRag(prompt, userMessage);
            int estTokens = estimateTokens(prompt, userMessage, history);
            String modelId = resolveModelWithRouter(requestModel, "chat", estTokens);

            ChatInterceptor.ChatContext ctx = new ChatInterceptor.ChatContext(
                    "chat", userMessage, prompt, modelId, tenantId, history, new java.util.HashMap<>());
            ctx = runBeforeInterceptors(ctx);

            final String finalSessionId = sessionId;
            final String originalMessage = userMessage;
            Flux<String> flux = callLlmStream(ctx.systemPrompt(), prepareUserText(ctx.userMessage()), history, "chat",
                    ctx.modelId() != null ? ctx.modelId() : modelId, imageData);

            if (memoryProvider != null && finalSessionId != null && !finalSessionId.isBlank()) {
                StringBuilder fullResponse = new StringBuilder();
                flux = flux.doOnNext(fullResponse::append)
                        .doOnComplete(() -> recordToMemory(finalSessionId, originalMessage, fullResponse.toString()));
            }
            return flux.doFinally(signal -> releaseQuota(tenantId, reserved));
        } catch (Exception e) {
            releaseQuota(tenantId, reserved);
            throw e;
        }
    }

    public Flux<String> chatStream(String userMessage, List<ChatRequest.MessageItem> history,
                                   String requestSystemPrompt, String requestModel) {
        return chatStream(userMessage, history, requestSystemPrompt, requestModel, null);
    }

    public Flux<String> chatStream(String userMessage) {
        return chatStream(userMessage, null, null, null, null);
    }

    private String resolveEffectiveSystemPrompt(String requestSystemPrompt) {
        if (properties.isAllowClientSystemPrompt()
                && requestSystemPrompt != null
                && !requestSystemPrompt.isBlank()) {
            String t = requestSystemPrompt.trim();
            int cap = properties.getClientSystemPromptMaxChars();
            if (cap > 0 && t.length() > cap) {
                t = t.substring(0, cap);
            }
            return t;
        }
        if (properties.getSystemPrompt() != null && !properties.getSystemPrompt().isBlank()) {
            return properties.getSystemPrompt();
        }
        return "You are a helpful AI assistant.";
    }

    private String callLlm(String systemPrompt, String userMessage, List<ChatRequest.MessageItem> history,
                         String operation, String modelId, String imageData) {
        userMessage = clampUserMessageForTotalBudget(userMessage, history, systemPrompt);
        String currentModel = modelId;
        RuntimeException lastError = null;

        for (int attempt = 0; attempt < 3; attempt++) {
            ObjectNode body = buildRequestBody(systemPrompt, userMessage, false, history, currentModel, imageData);
            String key = nextApiKey();
            Timer.Sample sample = meterRegistry != null ? Timer.start(meterRegistry) : null;
            String rawResponse;
            try {
                rawResponse = chatCompletionClient.completeRaw(body, key);
            } catch (RuntimeException e) {
                markKeyFailed(key);
                if (sample != null) sample.stop(completionTimer(operation, "error"));
                lastError = e;
                String fallback = modelRouter != null ? modelRouter.nextFallback(currentModel) : null;
                if (fallback != null) {
                    log.warn("Model {} failed, falling back to {}: {}", currentModel, fallback, e.getMessage());
                    currentModel = fallback;
                    continue;
                }
                throw e;
            }
            try {
                recordTokenUsage(rawResponse, currentModel);
                String result = processToolCallingLoop(body, rawResponse, key);
                if (contentFilter != null) {
                    result = contentFilter.filterOutput(result);
                }
                if (sample != null) sample.stop(completionTimer(operation, "success"));
                return result;
            } catch (RuntimeException e) {
                if (sample != null) sample.stop(completionTimer(operation, "error"));
                throw e;
            }
        }
        throw lastError != null ? lastError : new RuntimeException("All fallback models exhausted");
    }

    private String processToolCallingLoop(ObjectNode body, String rawResponse, String apiKey) {
        if (toolRegistry == null || toolRegistry.isEmpty()) {
            return parseContentFromRaw(rawResponse);
        }
        String modelId = body.path("model").asText("");
        for (int round = 0; round < MAX_TOOL_ROUNDS; round++) {
            JsonNode root;
            try {
                root = objectMapper.readTree(rawResponse);
            } catch (Exception e) {
                log.warn("Failed to parse LLM response in tool loop (round {}): {}", round, e.getMessage());
                return "AI service returned an unparseable response.";
            }
            JsonNode choices = root.path("choices");
            if (!choices.isArray() || choices.isEmpty()) return parseContentFromRaw(rawResponse);

            JsonNode firstChoice = choices.get(0);
            JsonNode msg = firstChoice.path("message");
            String finishReason = firstChoice.path("finish_reason").asText("");
            JsonNode toolCalls = msg.path("tool_calls");

            if (!"tool_calls".equals(finishReason) || !toolCalls.isArray() || toolCalls.isEmpty()) {
                return msg.path("content").asText("");
            }

            ArrayNode messages = (ArrayNode) body.get("messages");
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
            recordTokenUsage(rawResponse, modelId);
        }
        return parseContentFromRaw(rawResponse);
    }

    private String parseContentFromRaw(String raw) {
        try {
            JsonNode root = objectMapper.readTree(raw);
            JsonNode choices = root.path("choices");
            if (choices.isArray() && !choices.isEmpty()) {
                return choices.get(0).path("message").path("content").asText("");
            }
        } catch (Exception e) {
            log.debug("parseContentFromRaw fallback to raw: {}", e.getMessage());
        }
        return raw;
    }

    private Timer completionTimer(String operation, String outcome) {
        return Timer.builder("aiassistant.llm.completion")
                .description("LLM /chat/completions (non-stream) latency")
                .tag("operation", operation)
                .tag("outcome", outcome)
                .register(meterRegistry);
    }

    private String prepareUserText(String text) {
        if (text == null) {
            return text;
        }
        if (contentFilter != null) {
            var filtered = contentFilter.filterInput(text);
            text = filtered.text();
            if (filtered.hasWarnings()) {
                log.warn("Content filter warnings: {}", filtered.warnings());
            }
        }
        try {
            return urlFetchService.enrichUserMessage(text);
        } catch (Exception e) {
            log.warn("URL enrichment skipped: {}", e.getMessage());
            return text;
        }
    }

    /**
     * {@link ChatInputLimits#validateTotalChars} 只统计原始请求体；链接抓取会在服务端显著放大 {@code text}，
     * 与 history 叠加后易触发上游 LLM 5xx。此处与 {@link #buildRequestBody} 相同的 history 裁剪规则对齐后再截断 user。
     */
    private String clampUserMessageForTotalBudget(String userMessage, List<ChatRequest.MessageItem> history,
                                                  String systemPrompt) {
        if (userMessage == null) {
            return null;
        }
        int max = properties.getChatMaxTotalChars();
        if (max <= 0) {
            return userMessage;
        }
        List<ChatRequest.MessageItem> hist = history;
        int histCap = properties.getChatHistoryMaxChars();
        if (hist != null && !hist.isEmpty() && histCap > 0) {
            hist = ChatInputLimits.tailHistoryWithinBudget(history, histCap);
        }
        int used = strLen(systemPrompt);
        if (hist != null) {
            for (ChatRequest.MessageItem item : hist) {
                if (item != null) {
                    used += strLen(item.getContent());
                }
            }
        }
        int room = max - used;
        if (room >= userMessage.length()) {
            return userMessage;
        }
        if (room <= 64) {
            log.warn("chatMaxTotalChars exhausted by system/history (used={}, max={}); user text hard-clamped",
                    used, max);
            return userMessage.length() <= 64 ? userMessage : userMessage.substring(0, 61) + "…";
        }
        log.debug("User message truncated for chatMaxTotalChars: {} -> {} chars", userMessage.length(), room);
        return userMessage.substring(0, room - 24) + "\n…[truncated: chatMaxTotalChars]";
    }

    private static int strLen(String s) {
        return s == null ? 0 : s.length();
    }

    private static int estimateTokens(String systemPrompt, String userMessage, List<ChatRequest.MessageItem> history) {
        int chars = strLen(systemPrompt) + strLen(userMessage);
        if (history != null) {
            for (var item : history) {
                if (item != null) chars += strLen(item.getContent());
            }
        }
        return chars / 4;
    }

    private Flux<String> callLlmStream(String systemPrompt, String userMessage, List<ChatRequest.MessageItem> history,
                                       String operation, String modelId, String imageData) {
        userMessage = clampUserMessageForTotalBudget(userMessage, history, systemPrompt);
        ObjectNode body = buildRequestBody(systemPrompt, userMessage, true, history, modelId, imageData);
        String key = nextApiKey();

        if (toolRegistry != null && !toolRegistry.isEmpty()) {
            return applyStreamOutputFilter(callLlmStreamWithTools(body, key, operation), modelId, operation);
        }

        Flux<String> flux = chatCompletionClient.completeStream(body, key)
                .onBackpressureBuffer(256, BufferOverflowStrategy.DROP_OLDEST)
                .doOnError(e -> markKeyFailed(key));
        flux = applyStreamOutputFilter(flux, modelId, operation);
        if (meterRegistry == null) {
            return flux;
        }
        Timer.Sample sample = Timer.start(meterRegistry);
        return flux.doFinally(signal -> {
            String outcome = signal == SignalType.ON_COMPLETE ? "success"
                    : signal == SignalType.ON_ERROR ? "error" : "cancel";
            sample.stop(streamTimer(operation, outcome));
        });
    }

    private Flux<String> applyStreamOutputFilter(Flux<String> flux, String modelId, String operation) {
        if (contentFilter == null && tokenUsageTracker == null) return flux;
        StringBuilder fullText = new StringBuilder();
        return flux.map(chunk -> {
            fullText.append(chunk);
            if (contentFilter != null) {
                return contentFilter.filterOutput(chunk);
            }
            return chunk;
        }).doOnComplete(() -> {
            if (tokenUsageTracker != null && !fullText.isEmpty()) {
                int estimatedCompletionTokens = fullText.length() / 4;
                String tenantId = TenantContext.tenantId();
                tokenUsageTracker.recordUsage(tenantId, modelId, 0, estimatedCompletionTokens);
            }
        });
    }

    private Flux<String> callLlmStreamWithTools(ObjectNode body, String apiKey, String operation) {
        return Flux.defer(() -> {
            ObjectNode probeBody = body.deepCopy();
            probeBody.put("stream", false);
            try {
                String rawResponse = chatCompletionClient.completeRaw(probeBody, apiKey);
                JsonNode root = objectMapper.readTree(rawResponse);
                JsonNode choices = root.path("choices");
                if (!choices.isArray() || choices.isEmpty()) {
                    return Flux.just(parseContentFromRaw(rawResponse));
                }
                JsonNode firstChoice = choices.get(0);
                String finishReason = firstChoice.path("finish_reason").asText("");
                JsonNode toolCalls = firstChoice.path("message").path("tool_calls");

                if (!"tool_calls".equals(finishReason) || !toolCalls.isArray() || toolCalls.isEmpty()) {
                    return chatCompletionClient.completeStream(body, apiKey);
                }

                return executeToolsWithProgress(probeBody, firstChoice.path("message"), toolCalls, apiKey)
                        .subscribeOn(Schedulers.boundedElastic());
            } catch (Exception e) {
                markKeyFailed(apiKey);
                return Flux.error(e);
            }
        });
    }

    private Flux<String> executeToolsWithProgress(ObjectNode body, JsonNode assistantMessage,
                                                   JsonNode toolCalls, String apiKey) {
        long toolLoopTimeoutMs = Math.max(1, Math.min(properties.getTimeoutSeconds(), 600)) * 1000L * MAX_TOOL_ROUNDS;
        return Flux.create(sink -> {
            try {
                long deadline = System.currentTimeMillis() + toolLoopTimeoutMs;
                ObjectNode bodyClone = body.deepCopy();
                bodyClone.put("stream", false);
                ArrayNode messages = (ArrayNode) bodyClone.get("messages");
                JsonNode curAssistantMsg = assistantMessage;
                JsonNode curToolCalls = toolCalls;

                for (int round = 0; round < MAX_TOOL_ROUNDS; round++) {
                    if (System.currentTimeMillis() > deadline) {
                        sink.next("\n\n> ⚠️ Tool calling loop timed out after "
                                + (toolLoopTimeoutMs / 1000) + "s\n");
                        break;
                    }
                    ObjectNode aMsg = messages.addObject();
                    aMsg.put("role", "assistant");
                    if (curAssistantMsg.has("content") && !curAssistantMsg.get("content").isNull()) {
                        aMsg.put("content", curAssistantMsg.get("content").asText(""));
                    } else {
                        aMsg.putNull("content");
                    }
                    aMsg.set("tool_calls", curToolCalls);

                    for (JsonNode tc : curToolCalls) {
                        String callId = tc.path("id").asText();
                        String fnName = tc.path("function").path("name").asText();
                        String argsStr = tc.path("function").path("arguments").asText("{}");

                        sink.next("\n\n> \uD83D\uDD27 **" + fnName + "** `" + truncate(argsStr, 80) + "`\n");

                        String toolResult;
                        try {
                            JsonNode args = objectMapper.readTree(argsStr);
                            toolResult = toolRegistry.execute(fnName, args);
                        } catch (Exception e) {
                            toolResult = "Error: " + e.getMessage();
                            log.warn("Tool execution failed: {} - {}", fnName, e.getMessage());
                        }

                        sink.next("> ✅ " + truncate(toolResult, 120) + "\n\n");

                        ObjectNode toolMsg = messages.addObject();
                        toolMsg.put("role", "tool");
                        toolMsg.put("tool_call_id", callId);
                        toolMsg.put("content", toolResult);
                    }

                    String rawResponse = chatCompletionClient.completeRaw(bodyClone, apiKey);
                    JsonNode root = objectMapper.readTree(rawResponse);
                    JsonNode choices = root.path("choices");
                    if (!choices.isArray() || choices.isEmpty()) {
                        sink.next(parseContentFromRaw(rawResponse));
                        break;
                    }
                    JsonNode nextChoice = choices.get(0);
                    String nextFinish = nextChoice.path("finish_reason").asText("");
                    JsonNode nextToolCalls = nextChoice.path("message").path("tool_calls");

                    if (!"tool_calls".equals(nextFinish) || !nextToolCalls.isArray() || nextToolCalls.isEmpty()) {
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

    private String resolveModelWithRouter(String requestModel, String operation, int estimatedTokens) {
        String baseModel = properties.resolveEffectiveModel(requestModel);
        if (modelRouter == null) return baseModel;
        try {
            String tenantId = TenantContext.tenantId();
            var decision = modelRouter.route(operation, tenantId, estimatedTokens);
            if (decision != null && decision.modelId() != null && !decision.modelId().isBlank()) {
                log.debug("ModelRouter selected: {} (reason: {})", decision.modelId(), decision.reason());
                return decision.modelId();
            }
        } catch (Exception e) {
            log.debug("ModelRouter fallback to default: {}", e.getMessage());
        }
        return baseModel;
    }

    /**
     * Atomically checks quota and reserves estimated tokens.
     * Returns the reserved token count (0 if no tracker or no quota).
     * Must be paired with {@link #releaseQuota} after the request completes.
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
        public QuotaExceededException(String message) { super(message); }
    }

    private void recordTokenUsage(String rawResponse, String modelId) {
        if (tokenUsageTracker == null) return;
        try {
            JsonNode root = objectMapper.readTree(rawResponse);
            JsonNode usage = root.path("usage");
            if (usage.isMissingNode()) return;
            int promptTokens = usage.path("prompt_tokens").asInt(0);
            int completionTokens = usage.path("completion_tokens").asInt(0);
            if (promptTokens + completionTokens > 0) {
                String tenantId = TenantContext.tenantId();
                tokenUsageTracker.recordUsage(tenantId, modelId, promptTokens, completionTokens);
            }
        } catch (Exception e) {
            log.debug("Token usage tracking skipped: {}", e.getMessage());
        }
    }

    private String enrichWithMemory(String systemPrompt, String sessionId) {
        if (memoryProvider == null || sessionId == null || sessionId.isBlank()) return systemPrompt;
        try {
            ConversationMemory memory = memoryProvider.getMemory(sessionId);
            String memoryPrompt = memory.buildMemoryPrompt();
            if (memoryPrompt != null && !memoryPrompt.isBlank()) {
                return systemPrompt + "\n\n" + memoryPrompt;
            }
        } catch (Exception e) {
            log.debug("Memory enrichment skipped: {}", e.getMessage());
        }
        return systemPrompt;
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
                log.warn("ChatInterceptor.beforeChat failed ({}): {}", interceptor.getClass().getSimpleName(), e.getMessage());
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
                log.warn("ChatInterceptor.afterChat failed ({}): {}", interceptor.getClass().getSimpleName(), e.getMessage());
            }
        }
        return response;
    }

    private String enrichWithRag(String systemPrompt, String userMessage) {
        if (ragService == null || userMessage == null || userMessage.isBlank()) return systemPrompt;
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

    private Timer streamTimer(String operation, String outcome) {
        return Timer.builder("aiassistant.llm.stream")
                .description("LLM /chat/completions SSE until terminal signal")
                .tag("operation", operation)
                .tag("outcome", outcome)
                .register(meterRegistry);
    }

    private ObjectNode buildRequestBody(String systemPrompt, String userMessage, boolean stream,
                                        List<ChatRequest.MessageItem> history, String modelId,
                                        String imageData) {
        ObjectNode body = objectMapper.createObjectNode();
        body.put("model", modelId != null && !modelId.isBlank() ? modelId : properties.resolveModel());
        body.put("max_tokens", properties.getMaxTokens());
        body.put("temperature", properties.getTemperature());
        body.put("stream", stream);

        ArrayNode messages = body.putArray("messages");
        messages.addObject().put("role", "system").put("content", systemPrompt);

        List<ChatRequest.MessageItem> hist = history;
        int histCap = properties.getChatHistoryMaxChars();
        if (history != null && !history.isEmpty() && histCap > 0) {
            hist = ChatInputLimits.tailHistoryWithinBudget(history, histCap);
            if (hist.size() < history.size()) {
                log.debug("history trimmed for LLM: {} -> {} messages", history.size(), hist.size());
            }
        }
        if (hist != null && !hist.isEmpty()) {
            for (ChatRequest.MessageItem item : hist) {
                if (item.getRole() != null && item.getContent() != null) {
                    messages.addObject().put("role", item.getRole()).put("content", item.getContent());
                }
            }
        }

        if (toolRegistry != null && !toolRegistry.isEmpty()) {
            body.set("tools", toolRegistry.toOpenAiToolsArray());
        }

        boolean hasImage = imageData != null && !imageData.isBlank();
        if (hasImage) {
            ObjectNode userMsg = messages.addObject().put("role", "user");
            ArrayNode content = userMsg.putArray("content");
            content.addObject().put("type", "text").put("text", userMessage);
            String dataUrl = imageData.startsWith("data:") ? imageData
                    : "data:image/png;base64," + imageData;
            ObjectNode imgPart = content.addObject().put("type", "image_url");
            imgPart.putObject("image_url").put("url", dataUrl);
        } else {
            messages.addObject().put("role", "user").put("content", userMessage);
        }
        return body;
    }
}
