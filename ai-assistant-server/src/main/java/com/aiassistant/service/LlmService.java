package com.aiassistant.service;

import com.aiassistant.config.AiAssistantProperties;
import com.aiassistant.model.ChatInputLimits;
import com.aiassistant.model.ChatRequest;
import com.aiassistant.service.llm.ChatCompletionClient;
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
    private final ObjectMapper objectMapper = new ObjectMapper();
    private static final int MAX_TOOL_ROUNDS = 5;
    private final List<String> apiKeys;
    private final AtomicInteger keyIndex = new AtomicInteger(0);
    private final ConcurrentHashMap<String, Long> keyCooldown = new ConcurrentHashMap<>();
    private static final long KEY_COOLDOWN_MS = 30_000;

    private static final int LLM_CACHE_MAX = 500;
    private static final long LLM_CACHE_TTL_MS = 300_000; // 5 min
    private final Map<String, LlmCacheEntry> llmCache = new LinkedHashMap<>(16, 0.75f, true) {
        @Override
        protected boolean removeEldestEntry(Map.Entry<String, LlmCacheEntry> eldest) {
            return size() > LLM_CACHE_MAX || eldest.getValue().isExpired();
        }
    };
    private record LlmCacheEntry(String result, long expiresAt) {
        boolean isExpired() { return System.currentTimeMillis() > expiresAt; }
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
                        ToolRegistry toolRegistry) {
        this.apiKeys = properties.resolveApiKeys();
        if (apiKeys.isEmpty()) {
            throw new IllegalArgumentException("ai-assistant.api-key must be configured");
        }
        this.properties = properties;
        this.urlFetchService = urlFetchService;
        this.chatCompletionClient = chatCompletionClient;
        this.meterRegistry = meterRegistry;
        this.toolRegistry = toolRegistry;

        int timeout = Math.max(1, Math.min(properties.getTimeoutSeconds(), 600));
        log.info("AI Assistant initialized: provider={}, model={}, timeout={}s, keys={}, metrics={}",
                properties.getProvider(), properties.resolveModel(), timeout, apiKeys.size(),
                meterRegistry != null);
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
        keyCooldown.put(key, System.currentTimeMillis() + KEY_COOLDOWN_MS);
    }

    public String translate(String text, String targetLang) {
        String systemPrompt = TRANSLATE_PROMPTS.getOrDefault(
                targetLang,
                "You are a skilled translator. Translate the following into natural, idiomatic "
                        + targetLang
                        + " (conversational where appropriate). Output only the translation, no explanation.");
        String cacheKey = llmCacheKey("translate:" + targetLang, text);
        LlmCacheEntry cached = llmCache.get(cacheKey);
        if (cached != null && !cached.isExpired()) return cached.result();
        String result = callLlm(systemPrompt, prepareUserText(text), null, "translate", properties.resolveModel(), null);
        llmCache.put(cacheKey, new LlmCacheEntry(result, System.currentTimeMillis() + LLM_CACHE_TTL_MS));
        return result;
    }

    public String summarize(String text) {
        String cacheKey = llmCacheKey("summarize", text);
        LlmCacheEntry cached = llmCache.get(cacheKey);
        if (cached != null && !cached.isExpired()) return cached.result();
        String result = callLlm(SUMMARIZE_PROMPT, prepareUserText(text), null, "summarize", properties.resolveModel(), null);
        llmCache.put(cacheKey, new LlmCacheEntry(result, System.currentTimeMillis() + LLM_CACHE_TTL_MS));
        return result;
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
        String prompt = resolveEffectiveSystemPrompt(requestSystemPrompt);
        String modelId = properties.resolveEffectiveModel(requestModel);
        return callLlm(prompt, prepareUserText(userMessage), history, "chat", modelId, imageData);
    }

    public String chat(String userMessage, List<ChatRequest.MessageItem> history, String requestSystemPrompt,
                       String requestModel) {
        return chat(userMessage, history, requestSystemPrompt, requestModel, null);
    }

    public String chat(String userMessage) {
        return chat(userMessage, null, null, null, null);
    }

    public Flux<String> translateStream(String text, String targetLang) {
        String systemPrompt = TRANSLATE_PROMPTS.getOrDefault(
                targetLang,
                "You are a skilled translator. Translate the following into natural, idiomatic "
                        + targetLang
                        + " (conversational where appropriate). Output only the translation, no explanation.");
        return callLlmStream(systemPrompt, prepareUserText(text), null, "translate", properties.resolveModel(), null);
    }

    public Flux<String> summarizeStream(String text) {
        return callLlmStream(SUMMARIZE_PROMPT, prepareUserText(text), null, "summarize", properties.resolveModel(), null);
    }

    public Flux<String> chatStream(String userMessage, List<ChatRequest.MessageItem> history,
                                   String requestSystemPrompt, String requestModel, String imageData) {
        String prompt = resolveEffectiveSystemPrompt(requestSystemPrompt);
        String modelId = properties.resolveEffectiveModel(requestModel);
        return callLlmStream(prompt, prepareUserText(userMessage), history, "chat", modelId, imageData);
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
        ObjectNode body = buildRequestBody(systemPrompt, userMessage, false, history, modelId, imageData);
        String key = nextApiKey();
        Timer.Sample sample = meterRegistry != null ? Timer.start(meterRegistry) : null;
        try {
            String rawResponse = chatCompletionClient.completeRaw(body, key);
            String result = processToolCallingLoop(body, rawResponse, key);
            if (sample != null) sample.stop(completionTimer(operation, "success"));
            return result;
        } catch (RuntimeException e) {
            markKeyFailed(key);
            if (sample != null) sample.stop(completionTimer(operation, "error"));
            throw e;
        }
    }

    private String processToolCallingLoop(ObjectNode body, String rawResponse, String apiKey) {
        if (toolRegistry == null || toolRegistry.isEmpty()) {
            return parseContentFromRaw(rawResponse);
        }
        for (int round = 0; round < MAX_TOOL_ROUNDS; round++) {
            JsonNode root;
            try {
                root = objectMapper.readTree(rawResponse);
            } catch (Exception e) {
                return rawResponse;
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
        } catch (Exception ignored) {}
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

    private Flux<String> callLlmStream(String systemPrompt, String userMessage, List<ChatRequest.MessageItem> history,
                                       String operation, String modelId, String imageData) {
        userMessage = clampUserMessageForTotalBudget(userMessage, history, systemPrompt);
        ObjectNode body = buildRequestBody(systemPrompt, userMessage, true, history, modelId, imageData);
        String key = nextApiKey();

        if (toolRegistry != null && !toolRegistry.isEmpty()) {
            return callLlmStreamWithTools(body, key, operation);
        }

        Flux<String> flux = chatCompletionClient.completeStream(body, key)
                .onBackpressureBuffer(256, BufferOverflowStrategy.DROP_OLDEST)
                .doOnError(e -> markKeyFailed(key));
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
