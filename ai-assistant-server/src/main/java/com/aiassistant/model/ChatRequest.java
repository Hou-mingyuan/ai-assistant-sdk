package com.aiassistant.model;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.List;

public class ChatRequest {

    @Pattern(
            regexp = "translate|summarize|chat",
            message = "action must be one of: translate, summarize, chat")
    private String action;

    @NotBlank(message = "text is required")
    @Size(max = 300_000, message = "text exceeds 300000 characters")
    private String text;

    private String targetLang;

    @Size(max = 500, message = "history exceeds 500 messages")
    private List<@Valid MessageItem> history;

    /** 对话模式可选：覆盖服务端默认 system prompt，无需改配置重启（受服务端开关与长度上限约束）。 */
    @Size(max = 16_000)
    private String systemPrompt;

    /** 对话模式可选，须在服务端 {@code allowed-models} 白名单内 */
    @Size(max = 128)
    private String model;

    /**
     * Base64-encoded image (data URI or raw base64); sent as vision content to multimodal models
     */
    @Size(max = 10_000_000, message = "imageData exceeds 10MB")
    private String imageData;

    /**
     * Multiple images for multimodal models. {@code imageData} remains first-image compatibility.
     */
    @Size(max = 8, message = "imageDataList exceeds 8 images")
    private List<@Size(max = 10_000_000, message = "imageDataList item exceeds 10MB") String>
            imageDataList;

    /** 前端采集的页面上下文（URL、标题、DOM 区块文本），注入系统提示让 LLM 感知当前页面 */
    @Size(max = 20_000, message = "pageContext exceeds 20000 characters")
    private String pageContext;

    /** 开启后端联网搜索，搜索结果会作为页面上下文注入模型。 */
    private boolean webSearch;

    @Size(max = 128, message = "sessionId exceeds 128 characters")
    @Pattern(
            regexp = "^[A-Za-z0-9_.:/-]{0,128}$",
            message = "sessionId contains invalid characters")
    private String sessionId;

    public String getAction() {
        return action;
    }

    public void setAction(String action) {
        this.action = action;
    }

    public String getText() {
        return text;
    }

    public void setText(String text) {
        this.text = text;
    }

    public String getTargetLang() {
        return targetLang;
    }

    public void setTargetLang(String targetLang) {
        this.targetLang = targetLang;
    }

    public List<MessageItem> getHistory() {
        return history;
    }

    public void setHistory(List<MessageItem> history) {
        this.history = history;
    }

    public String getSystemPrompt() {
        return systemPrompt;
    }

    public void setSystemPrompt(String systemPrompt) {
        this.systemPrompt = systemPrompt;
    }

    public String getModel() {
        return model;
    }

    public void setModel(String model) {
        this.model = model;
    }

    public String getImageData() {
        return imageData;
    }

    public void setImageData(String imageData) {
        this.imageData = imageData;
    }

    public List<String> getImageDataList() {
        return imageDataList;
    }

    public void setImageDataList(List<String> imageDataList) {
        this.imageDataList = imageDataList;
    }

    public List<String> resolveImageDataList() {
        return resolveImageDataList(imageData, imageDataList);
    }

    public static List<String> resolveImageDataList(String imageData, List<String> imageDataList) {
        if (imageDataList != null && !imageDataList.isEmpty()) {
            return imageDataList.stream().filter(s -> s != null && !s.isBlank()).toList();
        }
        return imageData != null && !imageData.isBlank() ? List.of(imageData) : List.of();
    }

    public String getPageContext() {
        return pageContext;
    }

    public void setPageContext(String pageContext) {
        this.pageContext = pageContext;
    }

    public boolean isWebSearch() {
        return webSearch;
    }

    public void setWebSearch(boolean webSearch) {
        this.webSearch = webSearch;
    }

    public String getSessionId() {
        return sessionId;
    }

    public void setSessionId(String sessionId) {
        this.sessionId = sessionId;
    }

    public static class MessageItem {
        @NotBlank(message = "history role is required")
        @Pattern(
                regexp = "user|assistant|system",
                message = "history role must be one of: user, assistant, system")
        @Size(max = 32, message = "history role exceeds 32 characters")
        private String role;

        @NotBlank(message = "history content is required")
        @Size(max = 300_000, message = "history content exceeds 300000 characters")
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
