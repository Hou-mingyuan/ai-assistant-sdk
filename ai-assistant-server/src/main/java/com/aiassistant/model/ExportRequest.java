package com.aiassistant.model;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;

import java.util.List;

public class ExportRequest {

    @NotBlank(message = "format is required")
    private String format;
    @Size(max = 200, message = "title too long")
    private String title;
    @NotEmpty(message = "messages is required")
    private List<MessageRow> messages;

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
