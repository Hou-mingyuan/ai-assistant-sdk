package com.aiassistant.model;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;

import java.util.List;

/**
 * POST /export 请求体：指定导出格式（xlsx/docx/pdf）、文件标题和待导出的消息列表。
 */
public class ExportRequest {

    @NotBlank(message = "format is required")
    private String format;
    @Size(max = 200, message = "title too long")
    private String title;
    @NotEmpty(message = "messages is required")
    @Size(max = 5000, message = "messages list too large (max 5000)")
    private List<MessageRow> messages;
    /** "light" (default) or "dark" — hints the export renderer to use dark-friendly colors */
    private String theme;

    public String getFormat() {
        return format;
    }

    public void setFormat(String format) {
        this.format = format;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public List<MessageRow> getMessages() {
        return messages;
    }

    public void setMessages(List<MessageRow> messages) {
        this.messages = messages;
    }

    public String getTheme() { return theme; }
    public void setTheme(String theme) { this.theme = theme; }
    public boolean isDarkTheme() { return "dark".equalsIgnoreCase(theme); }

    public static class MessageRow {
        private String role;
        private String content;

        public String getRole() {
            return role;
        }

        public void setRole(String role) {
            this.role = role;
        }

        public String getContent() {
            return content;
        }

        public void setContent(String content) {
            this.content = content;
        }
    }
}
