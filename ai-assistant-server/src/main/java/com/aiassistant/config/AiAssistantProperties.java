package com.aiassistant.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.List;

@ConfigurationProperties(prefix = "ai-assistant")
public class AiAssistantProperties {

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
    private int rateLimit = 0;

    /** 是否在调用模型前尝试抓取用户消息中的 http(s) 链接正文 */
    private boolean urlFetchEnabled = true;
    /**
     * 对服务端发起的 URL 抓取、导出拉图等请求做 SSRF 基线防护（禁解析到私网/回环等）。
     * 仅内网使用时如需抓取内网页可设为 false（对公网暴露时不建议）。
     */
    private boolean urlFetchSsrfProtection = true;
    /** 单次拉取响应体最大字节 */
    private int urlFetchMaxBytes = 524_288;
    /** 拉取超时（秒） */
    private int urlFetchTimeoutSeconds = 15;
    /** 注入给模型的正文最大字符（超出截断） */
    private int urlFetchMaxCharsInjected = 24_000;
    /** 同一 URL 抓取正文的内存缓存 TTL（秒），0=关闭 */
    private int urlFetchCacheTtlSeconds = 90;
    /** 正文缓存最大条数（超出则淘汰） */
    private int urlFetchCacheMaxEntries = 32;
    /** GET /url-preview 返回的页面纯文本摘要最大字符（由 HTML 转纯文本后截取） */
    private int urlPreviewMaxSummaryChars = 900;
    /**
     * GET /url-preview 从页面 HTML 抽取的图片链接最大条数（og/twitter/正文 img 合计，过滤装饰图后）。
     * 默认 10；上限在服务端再夹紧，避免单次响应过大。
     */
    private int urlPreviewMaxImages = 10;

    /** POST /export 允许的最大消息条数 */
    private int exportMaxMessages = 2_000;
    /** POST /export 所有 content 累计最大字符（防爆内存） */
    private int exportMaxTotalChars = 2_000_000;

    /**
     * PDF 导出用的 Unicode 字体字节（需含中文等目标字形；PDFBox 3.x 需要 TrueType glyf，勿用常见 CJK CFF .otf）。
     * 支持 {@code classpath:/fonts/...}、{@code file:///...} 或绝对路径。
     * Starter 默认指向内置 {@code NotoSansSC_400Regular.ttf}（来自 expo/google-fonts，SIL OFL）；设为空字符串则退回 Helvetica（非 ASCII 变空格）。
     */
    private String exportPdfUnicodeFont = "classpath:/fonts/NotoSansSC_400Regular.ttf";

    /** 单张导出嵌入图片最大字节（HTTP 拉图）；超出则跳过该图，正文中保留 URL 占位说明 */
    private int exportMaxImageBytes = 3_000_000;
    /** Word/PDF 是否尝试嵌入 http(s) 图片；关闭则仅保留 Markdown 图片语法纯文本 */
    private boolean exportEmbedImages = true;

    /**
     * POST /chat、/stream 允许的用户输入总字符：当前 text + history 中各条 content 之和。
     * 0 表示不限制（不推荐生产环境）。
     */
    private int chatMaxTotalChars = 300_000;

    /**
     * 实际发往 LLM 的 {@code history} 各条 content 累计上限（从末尾向前保留）。
     * 小于等于 0 表示不截断。用于在请求体校验通过后仍控制模型侧 tokens/延迟。
     */
    private int chatHistoryMaxChars = 48_000;

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

    public boolean isUrlFetchEnabled() { return urlFetchEnabled; }
    public void setUrlFetchEnabled(boolean urlFetchEnabled) { this.urlFetchEnabled = urlFetchEnabled; }

    public boolean isUrlFetchSsrfProtection() { return urlFetchSsrfProtection; }
    public void setUrlFetchSsrfProtection(boolean urlFetchSsrfProtection) {
        this.urlFetchSsrfProtection = urlFetchSsrfProtection;
    }

    public int getUrlFetchMaxBytes() { return urlFetchMaxBytes; }
    public void setUrlFetchMaxBytes(int urlFetchMaxBytes) { this.urlFetchMaxBytes = urlFetchMaxBytes; }

    public int getUrlFetchTimeoutSeconds() { return urlFetchTimeoutSeconds; }
    public void setUrlFetchTimeoutSeconds(int urlFetchTimeoutSeconds) { this.urlFetchTimeoutSeconds = urlFetchTimeoutSeconds; }

    public int getUrlFetchMaxCharsInjected() { return urlFetchMaxCharsInjected; }
    public void setUrlFetchMaxCharsInjected(int urlFetchMaxCharsInjected) { this.urlFetchMaxCharsInjected = urlFetchMaxCharsInjected; }

    public int getUrlFetchCacheTtlSeconds() { return urlFetchCacheTtlSeconds; }
    public void setUrlFetchCacheTtlSeconds(int urlFetchCacheTtlSeconds) { this.urlFetchCacheTtlSeconds = urlFetchCacheTtlSeconds; }

    public int getUrlFetchCacheMaxEntries() { return urlFetchCacheMaxEntries; }
    public void setUrlFetchCacheMaxEntries(int urlFetchCacheMaxEntries) { this.urlFetchCacheMaxEntries = urlFetchCacheMaxEntries; }

    public int getUrlPreviewMaxSummaryChars() { return urlPreviewMaxSummaryChars; }
    public void setUrlPreviewMaxSummaryChars(int urlPreviewMaxSummaryChars) { this.urlPreviewMaxSummaryChars = urlPreviewMaxSummaryChars; }

    public int getUrlPreviewMaxImages() { return urlPreviewMaxImages; }
    public void setUrlPreviewMaxImages(int urlPreviewMaxImages) { this.urlPreviewMaxImages = urlPreviewMaxImages; }

    public int getExportMaxMessages() { return exportMaxMessages; }
    public void setExportMaxMessages(int exportMaxMessages) { this.exportMaxMessages = exportMaxMessages; }

    public int getExportMaxTotalChars() { return exportMaxTotalChars; }
    public void setExportMaxTotalChars(int exportMaxTotalChars) { this.exportMaxTotalChars = exportMaxTotalChars; }

    public String getExportPdfUnicodeFont() { return exportPdfUnicodeFont; }
    public void setExportPdfUnicodeFont(String exportPdfUnicodeFont) { this.exportPdfUnicodeFont = exportPdfUnicodeFont; }

    public int getExportMaxImageBytes() { return exportMaxImageBytes; }
    public void setExportMaxImageBytes(int exportMaxImageBytes) { this.exportMaxImageBytes = exportMaxImageBytes; }

    public boolean isExportEmbedImages() { return exportEmbedImages; }
    public void setExportEmbedImages(boolean exportEmbedImages) { this.exportEmbedImages = exportEmbedImages; }

    public int getChatMaxTotalChars() { return chatMaxTotalChars; }
    public void setChatMaxTotalChars(int chatMaxTotalChars) { this.chatMaxTotalChars = chatMaxTotalChars; }

    public int getChatHistoryMaxChars() { return chatHistoryMaxChars; }
    public void setChatHistoryMaxChars(int chatHistoryMaxChars) { this.chatHistoryMaxChars = chatHistoryMaxChars; }

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
        return switch (provider.toLowerCase()) {
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
        return switch (provider.toLowerCase()) {
            case "openai" -> "gpt-4o-mini";
            case "deepseek" -> "deepseek-chat";
            case "tongyi", "qwen" -> "qwen-turbo";
            case "zhipu" -> "glm-4-flash";
            case "minimax" -> "MiniMax-Text-01";
            case "kimi", "moonshot" -> "moonshot-v1-8k";
            default -> throw new IllegalArgumentException("Unknown provider: " + provider + ". Please set ai-assistant.model explicitly.");
        };
    }
}
