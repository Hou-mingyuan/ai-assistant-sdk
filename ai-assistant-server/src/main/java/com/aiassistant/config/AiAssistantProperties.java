package com.aiassistant.config;

import jakarta.annotation.PostConstruct;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import java.util.List;
import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

@Getter
@Setter
@Validated
@ConfigurationProperties(prefix = "ai-assistant")
public class AiAssistantProperties {

    // ── LLM Provider ──────────────────────────────────────────────────
    @NotBlank(message = "ai-assistant.provider must not be blank")
    private String provider = "openai";

    private String apiKey;
    private List<String> apiKeys;
    private String baseUrl;
    private String model;
    private String contextPath = "/ai-assistant";

    /**
     * Optional API version prefix appended after contextPath, e.g. "v1" -> /ai-assistant/v1/chat
     */
    private String apiVersion = "";

    @Min(value = 1, message = "ai-assistant.max-tokens must be >= 1")
    @Max(value = 128000, message = "ai-assistant.max-tokens must be <= 128000")
    private int maxTokens = 2048;

    @Min(value = 0, message = "ai-assistant.temperature must be >= 0")
    @Max(value = 2, message = "ai-assistant.temperature must be <= 2")
    private double temperature = 0.7;

    @Min(value = 5, message = "ai-assistant.timeout-seconds must be >= 5")
    @Max(value = 600, message = "ai-assistant.timeout-seconds must be <= 600")
    private int timeoutSeconds = 60;

    /** 非流式 /chat/completions 对瞬时错误额外重试次数（不含首次请求），0 表示不重试。 */
    private int llmMaxRetries = 2;

    private boolean enableStats = true;
    private int fileMaxExtractedChars = 300_000;
    private String systemPrompt;

    /** 是否接受请求体中的 {@code systemPrompt} 覆盖默认角色提示（仅对话模式）。 */
    private boolean allowClientSystemPrompt = true;

    /** 客户端传入的 system prompt 实际生效最大字符，超出截断；0 表示不额外截断。 */
    private int clientSystemPromptMaxChars = 4_000;

    // ── Security (ai-assistant.security.*) ─────────────────────────
    private SecurityProperties security = new SecurityProperties();

    // ── Admin / management surfaces (ai-assistant.admin.*) ───────────
    private AdminProperties admin = new AdminProperties();

    // ── Rate Limiting (ai-assistant.rate-limit-config.*) ────────────
    private RateLimitProperties rateLimitConfig = new RateLimitProperties();

    // ── Embedding / RAG (ai-assistant.rag.*) ─────────────────────────
    private RagProperties rag = new RagProperties();

    // ── Session Store ──────────────────────────────────────────────
    private SessionStoreProperties sessionStore = new SessionStoreProperties();

    // ── Data Connectors ─────────────────────────────────────────────
    private List<ConnectorProperties> connectors;

    // ── WebSocket / Headless ─────────────────────────────────────────
    private boolean websocketEnabled = false;
    private boolean headlessFetchEnabled = false;
    private int headlessFetchTimeoutSeconds = 30;

    // ── URL Fetch / Preview (ai-assistant.url-fetch.*) ───────────────
    private UrlFetchProperties urlFetch = new UrlFetchProperties();

    // ── Export (ai-assistant.export.*) ────────────────────────────────
    private ExportProperties export_ = new ExportProperties();

    // ── Chat Limits (ai-assistant.chat.*) ─────────────────────────────
    private ChatProperties chat = new ChatProperties();

    /** 允许前端在 /chat、/stream 请求体中指定的模型 id；为空则忽略客户端 model，始终用 resolveModel()。 */
    private List<String> allowedModels;

    // ── Custom setters with validation ──────────────────────────────

    public void setContextPath(String contextPath) {
        this.contextPath = normalizeContextPath(contextPath);
    }

    /**
     * Merges apiVersion into contextPath after all properties are bound, so the SpEL {@code
     * ${ai-assistant.context-path}} in @RequestMapping includes the version.
     */
    @PostConstruct
    void mergeApiVersionIntoContextPath() {
        if (apiVersion != null && !apiVersion.isBlank()) {
            String v = apiVersion.trim();
            if (!v.startsWith("/")) v = "/" + v;
            this.contextPath = this.contextPath + v;
        }
    }

    public void setLlmMaxRetries(int llmMaxRetries) {
        this.llmMaxRetries = Math.max(0, Math.min(llmMaxRetries, 5));
    }

    public void setFileMaxExtractedChars(int fileMaxExtractedChars) {
        this.fileMaxExtractedChars = Math.max(0, fileMaxExtractedChars);
    }

    public void setClientSystemPromptMaxChars(int clientSystemPromptMaxChars) {
        this.clientSystemPromptMaxChars = Math.max(0, clientSystemPromptMaxChars);
    }

    public void setHeadlessFetchTimeoutSeconds(int headlessFetchTimeoutSeconds) {
        this.headlessFetchTimeoutSeconds = Math.max(5, headlessFetchTimeoutSeconds);
    }

    // ── Nested config classes ───────────────────────────────────────

    @Getter
    @Setter
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
    }

    @Getter
    @Setter
    public static class ExportProperties {
        private int maxMessages = 2_000;
        private int maxTotalChars = 2_000_000;
        private String pdfUnicodeFont = "classpath:/fonts/NotoSansSC_400Regular.ttf";
        private int maxImageBytes = 3_000_000;
        private int maxImageUrls = 64;
        private boolean embedImages = true;

        public void setMaxImageUrls(int v) {
            this.maxImageUrls = Math.max(0, Math.min(v, 1024));
        }
    }

    @Getter
    @Setter
    public static class ChatProperties {
        private int maxTotalChars = 300_000;
        private int historyMaxChars = 48_000;
    }

    /**
     * RAG（检索增强生成）配置子域。
     *
     * <p>YAML 既可用嵌套形式 {@code ai-assistant.rag.enabled / .embedding-model /
     * .embedding-dimensions}，也可继续用历史的扁平形式 {@code ai-assistant.rag-enabled / .embedding-model /
     * .embedding-dimensions}（通过主类的 flat delegation setter 兼容）。
     */
    @Getter
    @Setter
    public static class RagProperties {
        private boolean enabled = false;
        private String embeddingModel;
        private int embeddingDimensions = 1536;
    }

    @Getter
    public static class SessionStoreProperties {
        private int maxSessionsPerUser = 50;
        private int maxUsers = 10_000;
        private int maxMessagesPerSession = 200;

        public void setMaxSessionsPerUser(int v) {
            this.maxSessionsPerUser = Math.max(1, v);
        }

        public void setMaxUsers(int v) {
            this.maxUsers = Math.max(1, v);
        }

        public void setMaxMessagesPerSession(int v) {
            this.maxMessagesPerSession = Math.max(0, v);
        }
    }

    /**
     * 限流配置子域。
     *
     * <p>YAML 嵌套形式 {@code ai-assistant.rate-limit-config.requests-per-minute / .per-action}，
     * 同时保留历史扁平形式 {@code ai-assistant.rate-limit / .rate-limit-per-action}（通过主类的 delegation
     * getter/setter 兼容）。
     */
    @Getter
    @Setter
    public static class RateLimitProperties {
        private int requestsPerMinute = 0;
        private java.util.Map<String, Integer> perAction;
    }

    /**
     * 安全相关配置子域。
     *
     * <p>YAML 嵌套形式 {@code ai-assistant.security.access-token / .allowed-origins /
     * .pii-masking-enabled / .allow-query-token-auth}，同时保留历史扁平形式（通过主类的 delegation 兼容）。
     */
    @Getter
    @Setter
    public static class SecurityProperties {
        private String accessToken;
        private String allowedOrigins = "*";
        private boolean piiMaskingEnabled = true;
        private boolean allowQueryTokenAuth = false;
    }

    /**
     * 管理与暴露面配置子域。
     *
     * <p>YAML 嵌套形式 {@code ai-assistant.admin.enabled / .connector-management-enabled /
     * .mcp-server-enabled}，同时保留历史扁平形式 {@code ai-assistant.admin-enabled} 等（通过主类 的 delegation 兼容）。
     */
    @Getter
    @Setter
    public static class AdminProperties {
        private boolean enabled = false;
        private boolean connectorManagementEnabled = false;
        private boolean mcpServerEnabled = false;

        /**
         * Separate bearer token for admin endpoints. Falls back to the main access-token when
         * blank.
         */
        private String adminToken;

        public String resolveAdminToken(String fallbackAccessToken) {
            return (adminToken != null && !adminToken.isBlank()) ? adminToken : fallbackAccessToken;
        }
    }

    // ── Derived / business methods ──────────────────────────────────

    /** Get all available API keys (single key + key list merged). */
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

    public String[] resolveAllowedOrigins() {
        String origins = security.getAllowedOrigins();
        if (origins == null || origins.isBlank()) {
            return new String[] {"*"};
        }
        java.util.LinkedHashSet<String> set = new java.util.LinkedHashSet<>();
        for (String origin : origins.split(",")) {
            if (origin != null && !origin.isBlank()) {
                set.add(origin.trim());
            }
        }
        if (set.isEmpty()) {
            return new String[] {"*"};
        }
        return set.toArray(String[]::new);
    }

    public int resolveRateLimit(String action) {
        java.util.Map<String, Integer> perAction = rateLimitConfig.getPerAction();
        if (perAction != null && action != null) {
            Integer v = perAction.get(action);
            if (v != null && v > 0) return v;
        }
        return rateLimitConfig.getRequestsPerMinute();
    }

    // ── Flat delegation helpers (backward compatibility) ────────────

    public int getChatMaxTotalChars() {
        return chat.getMaxTotalChars();
    }

    public void setChatMaxTotalChars(int v) {
        chat.setMaxTotalChars(v);
    }

    public int getChatHistoryMaxChars() {
        return chat.getHistoryMaxChars();
    }

    public void setChatHistoryMaxChars(int v) {
        chat.setHistoryMaxChars(v);
    }

    public boolean isUrlFetchEnabled() {
        return urlFetch.isEnabled();
    }

    public void setUrlFetchEnabled(boolean v) {
        urlFetch.setEnabled(v);
    }

    public boolean isUrlFetchSsrfProtection() {
        return urlFetch.isSsrfProtection();
    }

    public void setUrlFetchSsrfProtection(boolean v) {
        urlFetch.setSsrfProtection(v);
    }

    public int getUrlFetchMaxBytes() {
        return urlFetch.getMaxBytes();
    }

    public void setUrlFetchMaxBytes(int v) {
        urlFetch.setMaxBytes(v);
    }

    public int getUrlFetchTimeoutSeconds() {
        return urlFetch.getTimeoutSeconds();
    }

    public void setUrlFetchTimeoutSeconds(int v) {
        urlFetch.setTimeoutSeconds(v);
    }

    public int getUrlFetchMaxCharsInjected() {
        return urlFetch.getMaxCharsInjected();
    }

    public void setUrlFetchMaxCharsInjected(int v) {
        urlFetch.setMaxCharsInjected(v);
    }

    public int getUrlFetchCacheTtlSeconds() {
        return urlFetch.getCacheTtlSeconds();
    }

    public void setUrlFetchCacheTtlSeconds(int v) {
        urlFetch.setCacheTtlSeconds(v);
    }

    public int getUrlFetchCacheMaxEntries() {
        return urlFetch.getCacheMaxEntries();
    }

    public void setUrlFetchCacheMaxEntries(int v) {
        urlFetch.setCacheMaxEntries(v);
    }

    public int getUrlPreviewMaxSummaryChars() {
        return urlFetch.getPreviewMaxSummaryChars();
    }

    public void setUrlPreviewMaxSummaryChars(int v) {
        urlFetch.setPreviewMaxSummaryChars(v);
    }

    public int getUrlPreviewMaxImages() {
        return urlFetch.getPreviewMaxImages();
    }

    public void setUrlPreviewMaxImages(int v) {
        urlFetch.setPreviewMaxImages(v);
    }

    public int getExportMaxMessages() {
        return export_.getMaxMessages();
    }

    public void setExportMaxMessages(int v) {
        export_.setMaxMessages(v);
    }

    public int getExportMaxTotalChars() {
        return export_.getMaxTotalChars();
    }

    public void setExportMaxTotalChars(int v) {
        export_.setMaxTotalChars(v);
    }

    public String getExportPdfUnicodeFont() {
        return export_.getPdfUnicodeFont();
    }

    public void setExportPdfUnicodeFont(String v) {
        export_.setPdfUnicodeFont(v);
    }

    public int getExportMaxImageBytes() {
        return export_.getMaxImageBytes();
    }

    public void setExportMaxImageBytes(int v) {
        export_.setMaxImageBytes(v);
    }

    public int getExportMaxImageUrls() {
        return export_.getMaxImageUrls();
    }

    public void setExportMaxImageUrls(int v) {
        export_.setMaxImageUrls(v);
    }

    public boolean isExportEmbedImages() {
        return export_.isEmbedImages();
    }

    public void setExportEmbedImages(boolean v) {
        export_.setEmbedImages(v);
    }

    // ── RAG flat delegation (backward compatibility) ───────────────

    public boolean isRagEnabled() {
        return rag.isEnabled();
    }

    public void setRagEnabled(boolean v) {
        rag.setEnabled(v);
    }

    public String getEmbeddingModel() {
        return rag.getEmbeddingModel();
    }

    public void setEmbeddingModel(String v) {
        rag.setEmbeddingModel(v);
    }

    public int getEmbeddingDimensions() {
        return rag.getEmbeddingDimensions();
    }

    public void setEmbeddingDimensions(int v) {
        rag.setEmbeddingDimensions(v);
    }

    // ── Rate limit flat delegation (backward compatibility) ────────

    public int getRateLimit() {
        return rateLimitConfig.getRequestsPerMinute();
    }

    public void setRateLimit(int v) {
        rateLimitConfig.setRequestsPerMinute(v);
    }

    public java.util.Map<String, Integer> getRateLimitPerAction() {
        return rateLimitConfig.getPerAction();
    }

    public void setRateLimitPerAction(java.util.Map<String, Integer> v) {
        rateLimitConfig.setPerAction(v);
    }

    // ── Security flat delegation (backward compatibility) ──────────

    public String getAccessToken() {
        return security.getAccessToken();
    }

    public void setAccessToken(String v) {
        security.setAccessToken(v);
    }

    public String getAllowedOrigins() {
        return security.getAllowedOrigins();
    }

    public void setAllowedOrigins(String v) {
        security.setAllowedOrigins(v);
    }

    public boolean isPiiMaskingEnabled() {
        return security.isPiiMaskingEnabled();
    }

    public void setPiiMaskingEnabled(boolean v) {
        security.setPiiMaskingEnabled(v);
    }

    public boolean isAllowQueryTokenAuth() {
        return security.isAllowQueryTokenAuth();
    }

    public void setAllowQueryTokenAuth(boolean v) {
        security.setAllowQueryTokenAuth(v);
    }

    // ── Admin flat delegation (backward compatibility) ────────────

    public boolean isAdminEnabled() {
        return admin.isEnabled();
    }

    public void setAdminEnabled(boolean v) {
        admin.setEnabled(v);
    }

    public boolean isConnectorManagementEnabled() {
        return admin.isConnectorManagementEnabled();
    }

    public void setConnectorManagementEnabled(boolean v) {
        admin.setConnectorManagementEnabled(v);
    }

    public boolean isMcpServerEnabled() {
        return admin.isMcpServerEnabled();
    }

    public void setMcpServerEnabled(boolean v) {
        admin.setMcpServerEnabled(v);
    }

    /** 客户端请求的模型经白名单校验后的实际使用 id。 */
    public String resolveEffectiveModel(String requestModel) {
        String def = resolveModel();
        List<String> allowed = allowedModels;
        if (allowed == null || allowed.isEmpty()) return def;
        if (requestModel == null || requestModel.isBlank()) return def;
        String m = requestModel.trim();
        for (String a : allowed) {
            if (a != null && m.equals(a.trim())) return m;
        }
        return def;
    }

    /** 供 GET /models：白名单为空时仅返回默认模型一条。 */
    public java.util.List<String> listModelsForClient() {
        String def = resolveModel();
        List<String> allowed = allowedModels;
        if (allowed == null || allowed.isEmpty()) return java.util.List.of(def);
        java.util.ArrayList<String> models = new java.util.ArrayList<>();
        for (String m : allowed) {
            if (m == null || m.isBlank()) continue;
            String normalized = m.trim();
            if (!models.contains(normalized)) models.add(normalized);
        }
        return models.isEmpty() ? java.util.List.of(def) : java.util.List.copyOf(models);
    }

    /** Resolve the actual API base URL based on provider if not explicitly set. */
    public String resolveBaseUrl() {
        if (baseUrl != null && !baseUrl.isBlank()) return baseUrl;
        return switch (provider.toLowerCase(java.util.Locale.ROOT)) {
            case "openai" -> "https://api.openai.com/v1";
            case "deepseek" -> "https://api.deepseek.com/v1";
            case "tongyi", "qwen" -> "https://dashscope.aliyuncs.com/compatible-mode/v1";
            case "zhipu", "glm" -> "https://api.z.ai/api/paas/v4";
            case "volcengine", "doubao" -> "https://ark.cn-beijing.volces.com/api/v3";
            case "minimax" -> "https://api.minimax.chat/v1";
            case "kimi", "moonshot" -> "https://api.moonshot.cn/v1";
            case "gemini", "google" -> "https://generativelanguage.googleapis.com/v1beta/openai/";
            case "siliconflow" -> "https://api.siliconflow.cn/v1";
            case "groq" -> "https://api.groq.com/openai/v1";
            case "yi", "lingyiwanwu" -> "https://api.lingyiwanwu.com/v1";
            case "spark", "xunfei" -> "https://spark-api-open.xf-yun.com/v1";
            case "baichuan" -> "https://api.baichuan-ai.com/v1";
            case "stepfun" -> "https://api.stepfun.com/v1";
            case "hunyuan", "tencent" -> "https://api.hunyuan.cloud.tencent.com/v1";
            case "ollama" -> "http://localhost:11434/v1";
            default ->
                    throw new IllegalArgumentException(
                            "Unknown provider: "
                                    + provider
                                    + ". Please set ai-assistant.base-url explicitly.");
        };
    }

    /** Resolve the default model name based on provider if not explicitly set. */
    public String resolveModel() {
        if (model != null && !model.isBlank()) return model;
        return switch (provider.toLowerCase(java.util.Locale.ROOT)) {
            case "openai" -> "gpt-5.4-mini";
            case "deepseek" -> "deepseek-v4-flash";
            case "tongyi", "qwen" -> "qwen3.5-plus";
            case "zhipu", "glm" -> "glm-5.1";
            case "volcengine", "doubao" -> "doubao-seed-2-0-pro-260215";
            case "minimax" -> "MiniMax-M2.7";
            case "kimi", "moonshot" -> "kimi-k2.6";
            case "gemini", "google" -> "gemini-3.1-pro-preview";
            case "siliconflow" -> "deepseek-ai/DeepSeek-V3";
            case "groq" -> "llama-3.3-70b-versatile";
            case "yi", "lingyiwanwu" -> "yi-lightning";
            case "spark", "xunfei" -> "generalv3.5";
            case "baichuan" -> "Baichuan4";
            case "stepfun" -> "step-2-16k";
            case "hunyuan", "tencent" -> "hunyuan-pro";
            case "ollama" -> "llama3";
            default ->
                    throw new IllegalArgumentException(
                            "Unknown provider: "
                                    + provider
                                    + ". Please set ai-assistant.model explicitly.");
        };
    }

    private static String normalizeContextPath(String contextPath) {
        if (contextPath == null || contextPath.isBlank()) {
            throw new IllegalArgumentException("ai-assistant.context-path must not be blank");
        }
        String normalized = contextPath.trim();
        if (!normalized.startsWith("/")) normalized = "/" + normalized;
        while (normalized.length() > 1 && normalized.endsWith("/")) {
            normalized = normalized.substring(0, normalized.length() - 1);
        }
        if ("/".equals(normalized)) {
            throw new IllegalArgumentException("ai-assistant.context-path must not be root path");
        }
        return normalized;
    }
}
