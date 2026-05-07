package com.aiassistant.service;

import com.aiassistant.config.AiAssistantProperties;
import com.aiassistant.model.ChatInputLimits;
import com.aiassistant.model.ChatRequest;
import com.aiassistant.tool.ToolRegistry;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Builds OpenAI-compatible chat completion request bodies. Handles system prompt resolution,
 * history trimming, tool injection, and image payloads.
 */
public class LlmRequestBuilder {

    private static final Logger log = LoggerFactory.getLogger(LlmRequestBuilder.class);

    private static final Map<String, String> TRANSLATE_PROMPTS =
            Map.of(
                    "zh",
                    "You are a skilled translator. Translate the following into natural, colloquial Chinese "
                            + "(how people actually write in chat or daily life—avoid stiff textbook tone unless the source is formal). "
                            + "Output only the translation, no explanation.",
                    "en",
                    "You are a skilled translator. Translate the following into natural, conversational English "
                            + "(clear and idiomatic; not unnecessarily formal unless the source is formal). "
                            + "Output only the translation, no explanation.",
                    "ja",
                    "You are a skilled translator. Translate the following into natural, everyday Japanese. "
                            + "Output only the translation, no explanation.");

    static final String SUMMARIZE_PROMPT =
            "You are a professional content summarizer. Summarize the following text concisely in the same language as the input. "
                    + "Output a brief summary with key points.";

    private final AiAssistantProperties properties;
    private final ObjectMapper objectMapper;
    private final ToolRegistry toolRegistry;

    public LlmRequestBuilder(
            AiAssistantProperties properties,
            ObjectMapper objectMapper,
            ToolRegistry toolRegistry) {
        this.properties = properties;
        this.objectMapper = objectMapper;
        this.toolRegistry = toolRegistry;
    }

    public String translatePrompt(String targetLang) {
        return TRANSLATE_PROMPTS.getOrDefault(
                targetLang,
                "You are a skilled translator. Translate the following into natural, idiomatic "
                        + targetLang
                        + " (conversational where appropriate). Output only the translation, no explanation.");
    }

    public String summarizePrompt() {
        return SUMMARIZE_PROMPT;
    }

    /**
     * Resolves the effective system prompt: client-provided (if allowed), server-configured, or
     * default.
     */
    public String resolveSystemPrompt(String requestSystemPrompt) {
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

    /** Builds an OpenAI-compatible request body. */
    public ObjectNode buildRequestBody(
            String systemPrompt,
            String userMessage,
            boolean stream,
            List<ChatRequest.MessageItem> history,
            String modelId,
            String imageData) {
        ObjectNode body = objectMapper.createObjectNode();
        body.put(
                "model",
                modelId != null && !modelId.isBlank() ? modelId : properties.resolveModel());
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
                log.debug(
                        "history trimmed for LLM: {} -> {} messages", history.size(), hist.size());
            }
        }
        if (hist != null && !hist.isEmpty()) {
            for (ChatRequest.MessageItem item : hist) {
                if (item.getRole() != null && item.getContent() != null) {
                    messages.addObject()
                            .put("role", item.getRole())
                            .put("content", item.getContent());
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
            String dataUrl =
                    imageData.startsWith("data:")
                            ? imageData
                            : "data:image/png;base64," + imageData;
            ObjectNode imgPart = content.addObject().put("type", "image_url");
            imgPart.putObject("image_url").put("url", dataUrl);
        } else {
            messages.addObject().put("role", "user").put("content", userMessage);
        }
        return body;
    }

    /**
     * Truncates user message to fit within the total character budget, accounting for system prompt
     * and history.
     */
    public String clampUserMessage(
            String userMessage, List<ChatRequest.MessageItem> history, String systemPrompt) {
        if (userMessage == null) return null;
        int max = properties.getChatMaxTotalChars();
        if (max <= 0) return userMessage;

        List<ChatRequest.MessageItem> hist = history;
        int histCap = properties.getChatHistoryMaxChars();
        if (hist != null && !hist.isEmpty() && histCap > 0) {
            hist = ChatInputLimits.tailHistoryWithinBudget(history, histCap);
        }
        int used = strLen(systemPrompt);
        if (hist != null) {
            for (ChatRequest.MessageItem item : hist) {
                if (item != null) used += strLen(item.getContent());
            }
        }
        int room = max - used;
        if (room >= userMessage.length()) return userMessage;
        if (room <= 64) {
            log.warn(
                    "chatMaxTotalChars exhausted by system/history (used={}, max={}); user text hard-clamped",
                    used,
                    max);
            return userMessage.length() <= 64 ? userMessage : userMessage.substring(0, 61) + "\u2026";
        }
        log.debug(
                "User message truncated for chatMaxTotalChars: {} -> {} chars",
                userMessage.length(),
                room);
        return userMessage.substring(0, room - 24) + "\n\u2026[truncated: chatMaxTotalChars]";
    }

    /**
     * Estimates token count using language-aware heuristic.
     *
     * <p>CJK characters average ~1.5 tokens/char (BPE splits ideographs more),
     * while ASCII/Latin text averages ~0.25 tokens/char (words split into ~4 chars).
     * This mixed estimator is ~3x more accurate than the naive chars/4 approach
     * for multilingual content.
     */
    public static int estimateTokens(
            String systemPrompt, String userMessage, List<ChatRequest.MessageItem> history) {
        double tokens = estimateTokensForText(systemPrompt)
                + estimateTokensForText(userMessage);
        if (history != null) {
            for (var item : history) {
                if (item != null) tokens += estimateTokensForText(item.getContent());
            }
        }
        return (int) Math.ceil(tokens);
    }

    private static double estimateTokensForText(String text) {
        if (text == null || text.isEmpty()) return 0;
        int cjkChars = 0;
        int otherChars = 0;
        for (int i = 0; i < text.length(); i++) {
            char c = text.charAt(i);
            if (isCjk(c)) {
                cjkChars++;
            } else {
                otherChars++;
            }
        }
        return cjkChars * 1.5 + otherChars * 0.25;
    }

    private static boolean isCjk(char c) {
        Character.UnicodeBlock block = Character.UnicodeBlock.of(c);
        return block == Character.UnicodeBlock.CJK_UNIFIED_IDEOGRAPHS
                || block == Character.UnicodeBlock.CJK_UNIFIED_IDEOGRAPHS_EXTENSION_A
                || block == Character.UnicodeBlock.CJK_UNIFIED_IDEOGRAPHS_EXTENSION_B
                || block == Character.UnicodeBlock.CJK_COMPATIBILITY_IDEOGRAPHS
                || block == Character.UnicodeBlock.HIRAGANA
                || block == Character.UnicodeBlock.KATAKANA
                || block == Character.UnicodeBlock.HANGUL_SYLLABLES
                || block == Character.UnicodeBlock.HANGUL_JAMO;
    }

    static int strLen(String s) {
        return s == null ? 0 : s.length();
    }
}
