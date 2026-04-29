package com.aiassistant.model;

import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.List;

/** 服务端会话持久化数据模型：包含会话 ID、标题、消息列表和时间戳。 */
public class SessionData {

    private String id;

    @Size(max = 500, message = "title too long (max 500)")
    private String title;

    @Size(max = 2000, message = "messages list too large (max 2000)")
    private List<MessageItem> messages;

    private Instant createdAt;
    private Instant updatedAt;

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public List<MessageItem> getMessages() {
        return messages;
    }

    public void setMessages(List<MessageItem> messages) {
        this.messages = messages;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }

    public static class MessageItem {
        private String role;

        @Size(max = 300_000, message = "message content too long (max 300000)")
        private String content;

        private String feedback;

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

        public String getFeedback() {
            return feedback;
        }

        public void setFeedback(String feedback) {
            this.feedback = feedback;
        }
    }
}
