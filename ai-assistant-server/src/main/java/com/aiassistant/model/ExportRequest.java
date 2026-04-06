package com.aiassistant.model;

import java.util.List;

public class ExportRequest {

    private String format;
    private String title;
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
