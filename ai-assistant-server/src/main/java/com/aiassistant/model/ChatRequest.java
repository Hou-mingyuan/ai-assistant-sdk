package com.aiassistant.model;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.util.List;

public class ChatRequest {

    @Pattern(regexp = "translate|summarize|chat", message = "action must be one of: translate, summarize, chat")
    private String action;
    @NotBlank(message = "text is required")
    @Size(max = 300_000, message = "text exceeds 300000 characters")
    private String text;
    private String targetLang;
    @Size(max = 500, message = "history exceeds 500 messages")
    private List<MessageItem> history;
    /**
     * 对话模式可选：覆盖服务端默认 system prompt，无需改配置重启（受服务端开关与长度上限约束）。
     */
    @Size(max = 16_000)
    private String systemPrompt;
    /** 对话模式可选，须在服务端 {@code allowed-models} 白名单内 */
    @Size(max = 128)
    private String model;
    /** Base64-encoded image (data URI or raw base64); sent as vision content to multimodal models */
    @Size(max = 10_000_000, message = "imageData exceeds 10MB")
    private String imageData;

    public String getAction() { return action; }
    public void setAction(String action) { this.action = action; }

    public String getText() { return text; }
    public void setText(String text) { this.text = text; }

    public String getTargetLang() { return targetLang; }
    public void setTargetLang(String targetLang) { this.targetLang = targetLang; }

    public List<MessageItem> getHistory() { return history; }
    public void setHistory(List<MessageItem> history) { this.history = history; }

    public String getSystemPrompt() { return systemPrompt; }
    public void setSystemPrompt(String systemPrompt) { this.systemPrompt = systemPrompt; }

    public String getModel() { return model; }
    public void setModel(String model) { this.model = model; }

    public String getImageData() { return imageData; }
    public void setImageData(String imageData) { this.imageData = imageData; }

    public static class MessageItem {
        private String role;
        private String content;

        public String getRole() { return role; }
        public void setRole(String role) { this.role = role; }

        public String getContent() { return content; }
        public void setContent(String content) { this.content = content; }
    }
}
