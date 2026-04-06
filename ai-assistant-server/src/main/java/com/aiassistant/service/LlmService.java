package com.aiassistant.service;

import com.aiassistant.config.AiAssistantProperties;
import com.aiassistant.model.ChatInputLimits;
import com.aiassistant.model.ChatRequest;
import com.aiassistant.service.llm.ChatCompletionClient;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import reactor.core.publisher.Flux;
import reactor.core.publisher.SignalType;

import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;

public class LlmService {

    private static final Logger log = LoggerFactory.getLogger(LlmService.class);

    private final AiAssistantProperties properties;
    private final UrlFetchService urlFetchService;
    private final ChatCompletionClient chatCompletionClient;
    private final MeterRegistry meterRegistry;
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final List<String> apiKeys;
    private final AtomicInteger keyIndex = new AtomicInteger(0);

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
                        MeterRegistry meterRegistry) {
        this.apiKeys = properties.resolveApiKeys();
        if (apiKeys.isEmpty()) {
            throw new IllegalArgumentException("ai-assistant.api-key must be configured");
        }
        this.properties = properties;
        this.urlFetchService = urlFetchService;
        this.chatCompletionClient = chatCompletionClient;
        this.meterRegistry = meterRegistry;

        int timeout = Math.max(1, Math.min(properties.getTimeoutSeconds(), 600));
        log.info("AI Assistant initialized: provider={}, model={}, timeout={}s, keys={}, metrics={}",
                properties.getProvider(), properties.resolveModel(), timeout, apiKeys.size(),
                meterRegistry != null);
    }

    private String nextApiKey() {
        int idx = keyIndex.getAndUpdate(i -> (i + 1) % apiKeys.size());
        return apiKeys.get(idx);
    }

    public String translate(String text, String targetLang) {
        String systemPrompt = TRANSLATE_PROMPTS.getOrDefault(
                targetLang,
                "You are a skilled translator. Translate the following into natural, idiomatic "
                        + targetLang
                        + " (conversational where appropriate). Output only the translation, no explanation.");
        return callLlm(systemPrompt, prepareUserText(text), null, "translate");
    }

    public String summarize(String text) {
        return callLlm(SUMMARIZE_PROMPT, prepareUserText(text), null, "summarize");
    }

    public String chat(String userMessage, List<ChatRequest.MessageItem> history) {
        String prompt = properties.getSystemPrompt() != null && !properties.getSystemPrompt().isBlank()
                ? properties.getSystemPrompt() : "You are a helpful AI assistant.";
        return callLlm(prompt, prepareUserText(userMessage), history, "chat");
    }

    public String chat(String userMessage) {
        return chat(userMessage, null);
    }

    public Flux<String> translateStream(String text, String targetLang) {
        String systemPrompt = TRANSLATE_PROMPTS.getOrDefault(
                targetLang,
                "You are a skilled translator. Translate the following into natural, idiomatic "
                        + targetLang
                        + " (conversational where appropriate). Output only the translation, no explanation.");
        return callLlmStream(systemPrompt, prepareUserText(text), null, "translate");
    }

    public Flux<String> summarizeStream(String text) {
        return callLlmStream(SUMMARIZE_PROMPT, prepareUserText(text), null, "summarize");
    }

    public Flux<String> chatStream(String userMessage, List<ChatRequest.MessageItem> history) {
        String prompt = properties.getSystemPrompt() != null && !properties.getSystemPrompt().isBlank()
                ? properties.getSystemPrompt() : "You are a helpful AI assistant.";
        return callLlmStream(prompt, prepareUserText(userMessage), history, "chat");
    }

    public Flux<String> chatStream(String userMessage) {
        return chatStream(userMessage, null);
    }

    private String callLlm(String systemPrompt, String userMessage, List<ChatRequest.MessageItem> history,
                         String operation) {
        ObjectNode body = buildRequestBody(systemPrompt, userMessage, false, history);
        if (meterRegistry == null) {
            return chatCompletionClient.complete(body, nextApiKey());
        }
        Timer.Sample sample = Timer.start(meterRegistry);
        try {
            String result = chatCompletionClient.complete(body, nextApiKey());
            sample.stop(completionTimer(operation, "success"));
            return result;
        } catch (RuntimeException e) {
            sample.stop(completionTimer(operation, "error"));
            throw e;
        }
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

    private Flux<String> callLlmStream(String systemPrompt, String userMessage, List<ChatRequest.MessageItem> history,
                                       String operation) {
        ObjectNode body = buildRequestBody(systemPrompt, userMessage, true, history);
        Flux<String> flux = chatCompletionClient.completeStream(body, nextApiKey());
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

    private Timer streamTimer(String operation, String outcome) {
        return Timer.builder("aiassistant.llm.stream")
                .description("LLM /chat/completions SSE until terminal signal")
                .tag("operation", operation)
                .tag("outcome", outcome)
                .register(meterRegistry);
    }

    private ObjectNode buildRequestBody(String systemPrompt, String userMessage, boolean stream,
                                        List<ChatRequest.MessageItem> history) {
        ObjectNode body = objectMapper.createObjectNode();
        body.put("model", properties.resolveModel());
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

        messages.addObject().put("role", "user").put("content", userMessage);
        return body;
    }
}
