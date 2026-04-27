package com.aiassistant.capability;

import com.aiassistant.service.LlmService;
import com.aiassistant.spi.AssistantCapability;

import java.util.List;
import java.util.Map;

/**
 * Factory for built-in assistant capabilities (translate, summarize, chat).
 */
public final class BuiltInCapabilities {

    private BuiltInCapabilities() {}

    public static AssistantCapability translate(LlmService llmService) {
        return new AssistantCapability() {
            @Override public String name() { return "translate"; }
            @Override public String description() { return "Translate text to a target language with natural, idiomatic output"; }
            @Override public Map<String, Object> inputSchema() {
                return Map.of(
                    "type", "object",
                    "required", List.of("text", "targetLang"),
                    "properties", Map.of(
                        "text", Map.of("type", "string", "description", "Text to translate"),
                        "targetLang", Map.of("type", "string", "description", "Target language code (zh, en, ja, etc.)")
                    )
                );
            }
            @Override public String execute(Map<String, Object> params) {
                String text = (String) params.get("text");
                String lang = (String) params.get("targetLang");
                return llmService.translate(text, lang);
            }
            @Override public List<String> tags() { return List.of("translation", "language"); }
        };
    }

    public static AssistantCapability summarize(LlmService llmService) {
        return new AssistantCapability() {
            @Override public String name() { return "summarize"; }
            @Override public String description() { return "Summarize text concisely, preserving key points"; }
            @Override public Map<String, Object> inputSchema() {
                return Map.of(
                    "type", "object",
                    "required", List.of("text"),
                    "properties", Map.of(
                        "text", Map.of("type", "string", "description", "Text to summarize")
                    )
                );
            }
            @Override public String execute(Map<String, Object> params) {
                String text = (String) params.get("text");
                return llmService.summarize(text);
            }
            @Override public List<String> tags() { return List.of("summarization", "content"); }
        };
    }

    public static AssistantCapability chat(LlmService llmService) {
        return new AssistantCapability() {
            @Override public String name() { return "chat"; }
            @Override public String description() { return "Have a conversation with the AI assistant"; }
            @Override public Map<String, Object> inputSchema() {
                return Map.of(
                    "type", "object",
                    "required", List.of("message"),
                    "properties", Map.of(
                        "message", Map.of("type", "string", "description", "User message")
                    )
                );
            }
            @Override public String execute(Map<String, Object> params) {
                String message = (String) params.get("message");
                return llmService.chat(message);
            }
            @Override public List<String> tags() { return List.of("chat", "conversation"); }
        };
    }
}
