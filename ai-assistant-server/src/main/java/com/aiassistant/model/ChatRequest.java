package com.aiassistant.model;

import jakarta.validation.constraints.NotBlank;

import java.util.List;

public class ChatRequest {

    private String action;
    @NotBlank(message = "text is required")
    private String text;
    private String targetLang;
    private List<MessageItem> history;

    public String getAction() { return action; }
    public void setAction(String action) { this.action = action; }

    public String getText() { return text; }
    public void setText(String text) { this.text = text; }

    public String getTargetLang() { return targetLang; }
    public void setTargetLang(String targetLang) { this.targetLang = targetLang; }

    public List<MessageItem> getHistory() { return history; }
    public void setHistory(List<MessageItem> history) { this.history = history; }

    public static class MessageItem {
        private String role;
        private String content;

        public String getRole() { return role; }
        public void setRole(String role) { this.role = role; }

        public String getContent() { return content; }
        public void setContent(String content) { this.content = content; }
    }
}
