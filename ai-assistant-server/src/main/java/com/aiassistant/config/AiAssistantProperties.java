package com.aiassistant.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.List;

@ConfigurationProperties(prefix = "ai-assistant")
public class AiAssistantProperties {

    // ── LLM Provider ──────────────────────────────────────────────────
    private String provider = "openai";
    private String apiKey;
    private List<String> apiKeys;
    private String baseUrl;
    private String model;
    private String contextPath = "/ai-assistant";
    private int maxTokens = 2048;
    private double temperature = 0.7;
    private int timeoutSeconds = 60;
    /**
     * 非流式 /chat/completions 对瞬时错误额外重试次数（不含首次请求），0 表示不重试。
     * 退避在客户端内Sleep；仅用于阻塞式 complete，流式见后续扩展。
     */
    private int llmMaxRetries = 2;
    private String allowedOrigins = "*";
    private String accessToken;
    private boolean enableStats = true;
    private String systemPrompt;
    /**
     * 是否接受请求体中的 {@code systemPrompt} 覆盖默认角色提示（仅对话模式；关闭则始终用配置文件）。
     */
    private boolean allowClientSystemPrompt = true;
    /**
     * 客户端传入的 system prompt 实际生效最大字符，超出截断；0 表示不额外截断（仍受请求 DTO 总长度约束）。
     */
    private int clientSystemPromptMaxChars = 4_000;
    // ── Rate Limiting ──────────────────────────────────────────────────
    private int rateLimit = 0;
    private java.util.Map<String, Integer> rateLimitPerAction;

    // ── WebSocket / Headless ─────────────────────────────────────────
    private boolean websocketEnabled = false;

    /** 启用 headless 浏览器抓取（Playwright），用于 JS 渲染页面的链接预览/正文提取。需要先安装浏览器：mvn exec:java -e -D exec.mainClass=com.microsoft.playwright.CLI -D exec.args="install chromium" */
    private boolean headlessFetchEnabled = false;
    /** headless 浏览器页面加载超时（秒） */
    private int headlessFetchTimeoutSeconds = 30;

    // ── URL Fetch / Preview (ai-assistant.url-fetch.*) ─────────────────
    private UrlFetchProperties urlFetch = new UrlFetchProperties();

    // ── Export (ai-assistant.export.*) ────────────────────────────────
    private ExportProperties export_ = new ExportProperties();

    // ── Chat Limits (ai-assistant.chat.*) ─────────────────────────────
    private ChatProperties chat = new ChatProperties();

    /** Nested: URL fetch & preview settings. YAML prefix: {@code ai-assistant.url-fetch} */
    public static class UrlFetchProperties {
        private boolean enabled = true;
        private boolean ssrfProtection = true;
        private int maxBytes = 524_288;
        private int timeoutSeconds = 15;
        private int maxCharsInjected = 24_000;
        private int cacheTtlSeconds = 90;
        private int cacheMaxEntries = 32;
        private int previewMaxSummaryChars = 900;
        private int previewMaxImages = 10;
        public boolean isEnabled() { return enabled; }
        public void setEnabled(boolean enabled) { this.enabled = enabled; }
        public boolean isSsrfProtection() { return ssrfProtection; }
        public void setSsrfProtection(boolean v) { this.ssrfProtection = v; }
        public int getMaxBytes() { return maxBytes; }
        public void setMaxBytes(int v) { this.maxBytes = v; }
        public int getTimeoutSeconds() { return timeoutSeconds; }
        public void setTimeoutSeconds(int v) { this.timeoutSeconds = v; }
        public int getMaxCharsInjected() { return maxCharsInjected; }
        public void setMaxCharsInjected(int v) { this.maxCharsInjected = v; }
        public int getCacheTtlSeconds() { return cacheTtlSeconds; }
        public void setCacheTtlSeconds(int v) { this.cacheTtlSeconds = v; }
        public int getCacheMaxEntries() { return cacheMaxEntries; }
        public void setCacheMaxEntries(int v) { this.cacheMaxEntries = v; }
        public int getPreviewMaxSummaryChars() { return previewMaxSummaryChars; }
        public void setPreviewMaxSummaryChars(int v) { this.previewMaxSummaryChars = v; }
        public int getPreviewMaxImages() { return previewMaxImages; }
        public void setPreviewMaxImages(int v) { this.previewMaxImages = v; }
    }

    /** Nested: export settings. YAML prefix: {@code ai-assistant.export} */
    public static class ExportProperties {
        private int maxMessages = 2_000;
        private int maxTotalChars = 2_000_000;
        private String pdfUnicodeFont = "classpath:/fonts/NotoSansSC_400Regular.ttf";
        private int maxImageBytes = 3_000_000;
        private boolean embedImages = true;
        public int getMaxMessages() { return maxMessages; }
        public void setMaxMessages(int v) { this.maxMessages = v; }
        public int getMaxTotalChars() { return maxTotalChars; }
        public void setMaxTotalChars(int v) { this.maxTotalChars = v; }
        public String getPdfUnicodeFont() { return pdfUnicodeFont; }
        public void setPdfUnicodeFont(String v) { this.pdfUnicodeFont = v; }
        public int getMaxImageBytes() { return maxImageBytes; }
        public void setMaxImageBytes(int v) { this.maxImageBytes = v; }
        public boolean isEmbedImages() { return embedImages; }
        public void setEmbedImages(boolean v) { this.embedImages = v; }
    }

    /** Nested: chat limits. YAML prefix: {@code ai-assistant.chat} */
    public static class ChatProperties {
        private int maxTotalChars = 300_000;
        private int historyMaxChars = 48_000;
        public int getMaxTotalChars() { return maxTotalChars; }
        public void setMaxTotalChars(int v) { this.maxTotalChars = v; }
        public int getHistoryMaxChars() { return historyMaxChars; }
        public void setHistoryMaxChars(int v) { this.historyMaxChars = v; }
    }

    /**
     * 允许前端在 /chat、/stream 请求体中指定的模型 id；**为空则忽略**客户端 {@code model}，始终用 {@link #resolveModel()}。
     * 非空时仅当请求中的 id 与白名单条目（trim 后）完全一致时生效。
     */
    private List<String> allowedModels;

    public String getProvider() { return provider; }
    public void setProvider(String provider) { this.provider = provider; }

    public String getApiKey() { return apiKey; }
    public void setApiKey(String apiKey) { this.apiKey = apiKey; }

    public List<String> getApiKeys() { return apiKeys; }
    public void setApiKeys(List<String> apiKeys) { this.apiKeys = apiKeys; }

    /**
     * Get all available API keys (single key + key list merged).
     */
    public List<String> resolveApiKeys() {
        java.util.ArrayList<String> keys = new java.util.ArrayList<>();
        if (apiKey != null && !apiKey.isBlank()) keys.add(apiKey);
        if (apiKeys != null) {
            for (String k : apiKeys) {
                if (k != null && !k.isBlank() && !keys.contains(k)) keys.add(k);
            }
        }
        return keys;
    }

    public String getBaseUrl() { return baseUrl; }
    public void setBaseUrl(String baseUrl) { this.baseUrl = baseUrl; }

    public String getModel() { return model; }
    public void setModel(String model) { this.model = model; }

    public String getContextPath() { return contextPath; }
    public void setContextPath(String contextPath) { this.contextPath = contextPath; }

    public int getMaxTokens() { return maxTokens; }
    public void setMaxTokens(int maxTokens) { this.maxTokens = maxTokens; }

    public double getTemperature() { return temperature; }
    public void setTemperature(double temperature) { this.temperature = temperature; }

    public int getTimeoutSeconds() { return timeoutSeconds; }
    public void setTimeoutSeconds(int timeoutSeconds) { this.timeoutSeconds = timeoutSeconds; }

    public int getLlmMaxRetries() { return llmMaxRetries; }
    public void setLlmMaxRetries(int llmMaxRetries) {
        this.llmMaxRetries = Math.max(0, Math.min(llmMaxRetries, 5));
    }

    public String getAllowedOrigins() { return allowedOrigins; }
    public void setAllowedOrigins(String allowedOrigins) { this.allowedOrigins = allowedOrigins; }

    public String getAccessToken() { return accessToken; }
    public void setAccessToken(String accessToken) { this.accessToken = accessToken; }

    public boolean isEnableStats() { return enableStats; }
    public void setEnableStats(boolean enableStats) { this.enableStats = enableStats; }

    public String getSystemPrompt() { return systemPrompt; }
    public void setSystemPrompt(String systemPrompt) { this.systemPrompt = systemPrompt; }

    public boolean isAllowClientSystemPrompt() { return allowClientSystemPrompt; }
    public void setAllowClientSystemPrompt(boolean allowClientSystemPrompt) {
        this.allowClientSystemPrompt = allowClientSystemPrompt;
    }

    public int getClientSystemPromptMaxChars() { return clientSystemPromptMaxChars; }
    public void setClientSystemPromptMaxChars(int clientSystemPromptMaxChars) {
        this.clientSystemPromptMaxChars = Math.max(0, clientSystemPromptMaxChars);
    }

    public int getRateLimit() { return rateLimit; }
    public void setRateLimit(int rateLimit) { this.rateLimit = rateLimit; }

    public java.util.Map<String, Integer> getRateLimitPerAction() { return rateLimitPerAction; }
    public void setRateLimitPerAction(java.util.Map<String, Integer> rateLimitPerAction) {
        this.rateLimitPerAction = rateLimitPerAction;
    }

    public boolean isWebsocketEnabled() { return websocketEnabled; }
    public void setWebsocketEnabled(boolean websocketEnabled) { this.websocketEnabled = websocketEnabled; }

    public boolean isHeadlessFetchEnabled() { return headlessFetchEnabled; }
    public void setHeadlessFetchEnabled(boolean headlessFetchEnabled) { this.headlessFetchEnabled = headlessFetchEnabled; }

    public int getHeadlessFetchTimeoutSeconds() { return headlessFetchTimeoutSeconds; }
    public void setHeadlessFetchTimeoutSeconds(int headlessFetchTimeoutSeconds) { this.headlessFetchTimeoutSeconds = Math.max(5, headlessFetchTimeoutSeconds); }

    public int resolveRateLimit(String action) {
        if (rateLimitPerAction != null && action != null) {
            Integer v = rateLimitPerAction.get(action);
            if (v != null && v > 0) return v;
        }
        return rateLimit;
    }

    public UrlFetchProperties getUrlFetch() { return urlFetch; }
    public void setUrlFetch(UrlFetchProperties urlFetch) { this.urlFetch = urlFetch; }
    public ExportProperties getExport() { return export_; }
    public void setExport(ExportProperties export_) { this.export_ = export_; }
    public ChatProperties getChat() { return chat; }
    public void setChat(ChatProperties chat) { this.chat = chat; }

    /** @deprecated Use {@code getUrlFetch().isEnabled()} */
    public boolean isUrlFetchEnabled() { return urlFetch.isEnabled(); }
    public void setUrlFetchEnabled(boolean v) { urlFetch.setEnabled(v); }
    public boolean isUrlFetchSsrfProtection() { return urlFetch.isSsrfProtection(); }
    public void setUrlFetchSsrfProtection(boolean v) { urlFetch.setSsrfProtection(v); }
    public int getUrlFetchMaxBytes() { return urlFetch.getMaxBytes(); }
    public void setUrlFetchMaxBytes(int v) { urlFetch.setMaxBytes(v); }
    public int getUrlFetchTimeoutSeconds() { return urlFetch.getTimeoutSeconds(); }
    public void setUrlFetchTimeoutSeconds(int v) { urlFetch.setTimeoutSeconds(v); }
    public int getUrlFetchMaxCharsInjected() { return urlFetch.getMaxCharsInjected(); }
    public void setUrlFetchMaxCharsInjected(int v) { urlFetch.setMaxCharsInjected(v); }
    public int getUrlFetchCacheTtlSeconds() { return urlFetch.getCacheTtlSeconds(); }
    public void setUrlFetchCacheTtlSeconds(int v) { urlFetch.setCacheTtlSeconds(v); }
    public int getUrlFetchCacheMaxEntries() { return urlFetch.getCacheMaxEntries(); }
    public void setUrlFetchCacheMaxEntries(int v) { urlFetch.setCacheMaxEntries(v); }
    public int getUrlPreviewMaxSummaryChars() { return urlFetch.getPreviewMaxSummaryChars(); }
    public void setUrlPreviewMaxSummaryChars(int v) { urlFetch.setPreviewMaxSummaryChars(v); }
    public int getUrlPreviewMaxImages() { return urlFetch.getPreviewMaxImages(); }
    public void setUrlPreviewMaxImages(int v) { urlFetch.setPreviewMaxImages(v); }

    /** @deprecated Use {@code getExport().getMaxMessages()} */
    public int getExportMaxMessages() { return export_.getMaxMessages(); }
    public void setExportMaxMessages(int v) { export_.setMaxMessages(v); }
    public int getExportMaxTotalChars() { return export_.getMaxTotalChars(); }
    public void setExportMaxTotalChars(int v) { export_.setMaxTotalChars(v); }
    public String getExportPdfUnicodeFont() { return export_.getPdfUnicodeFont(); }
    public void setExportPdfUnicodeFont(String v) { export_.setPdfUnicodeFont(v); }
    public int getExportMaxImageBytes() { return export_.getMaxImageBytes(); }
    public void setExportMaxImageBytes(int v) { export_.setMaxImageBytes(v); }
    public boolean isExportEmbedImages() { return export_.isEmbedImages(); }
    public void setExportEmbedImages(boolean v) { export_.setEmbedImages(v); }

    /** @deprecated Use {@code getChat().getMaxTotalChars()} */
    public int getChatMaxTotalChars() { return chat.getMaxTotalChars(); }
    public void setChatMaxTotalChars(int v) { chat.setMaxTotalChars(v); }
    public int getChatHistoryMaxChars() { return chat.getHistoryMaxChars(); }
    public void setChatHistoryMaxChars(int v) { chat.setHistoryMaxChars(v); }

    public List<String> getAllowedModels() { return allowedModels; }
    public void setAllowedModels(List<String> allowedModels) { this.allowedModels = allowedModels; }

    /**
     * 客户端请求的模型经白名单校验后的实际使用 id。
     */
    public String resolveEffectiveModel(String requestModel) {
        String def = resolveModel();
        List<String> allowed = allowedModels;
        if (allowed == null || allowed.isEmpty()) {
            return def;
        }
        if (requestModel == null || requestModel.isBlank()) {
            return def;
        }
        String m = requestModel.trim();
        for (String a : allowed) {
            if (a != null && m.equals(a.trim())) {
                return m;
            }
        }
        return def;
    }

    /** 供 GET /models：白名单为空时仅返回默认模型一条。 */
    public java.util.List<String> listModelsForClient() {
        String def = resolveModel();
        List<String> allowed = allowedModels;
        if (allowed == null || allowed.isEmpty()) {
            return java.util.List.of(def);
        }
        return java.util.List.copyOf(allowed);
    }

    /**
     * Resolve the actual API base URL based on provider if not explicitly set.
     */
    public String resolveBaseUrl() {
        if (baseUrl != null && !baseUrl.isBlank()) {
            return baseUrl;
        }
        return switch (provider.toLowerCase(java.util.Locale.ROOT)) {
            case "openai" -> "https://api.openai.com/v1";
            case "deepseek" -> "https://api.deepseek.com/v1";
            case "tongyi", "qwen" -> "https://dashscope.aliyuncs.com/compatible-mode/v1";
            case "zhipu" -> "https://open.bigmodel.cn/api/paas/v4";
            case "volcengine", "doubao" -> "https://ark.cn-beijing.volces.com/api/v3";
            case "minimax" -> "https://api.minimax.chat/v1";
            case "kimi", "moonshot" -> "https://api.moonshot.cn/v1";
            default -> throw new IllegalArgumentException("Unknown provider: " + provider + ". Please set ai-assistant.base-url explicitly.");
        };
    }

    /**
     * Resolve the default model name based on provider if not explicitly set.
     */
    public String resolveModel() {
        if (model != null && !model.isBlank()) {
            return model;
        }
        return switch (provider.toLowerCase(java.util.Locale.ROOT)) {
            case "openai" -> "gpt-4o-mini";
            case "deepseek" -> "deepseek-chat";
            case "tongyi", "qwen" -> "qwen-turbo";
            case "zhipu" -> "glm-4-flash";
            case "volcengine", "doubao" -> "doubao-1.5-pro-32k";
            case "minimax" -> "MiniMax-Text-01";
            case "kimi", "moonshot" -> "moonshot-v1-8k";
            default -> throw new IllegalArgumentException("Unknown provider: " + provider + ". Please set ai-assistant.model explicitly.");
        };
    }

}
