package com.aiassistant.config;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import java.util.List;
import java.util.Objects;
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
    private String minimaxVlmBaseUrl;
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

    /** 启动完成后是否对默认模型发起一次极短请求，用于降低本地首问冷启动体感。 */
    private boolean warmupEnabled = false;

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

    // ── Latency UX tuning (ai-assistant.latency.*) ────────────────────
    private LatencyProperties latency = new LatencyProperties();

    /** 允许前端在 /chat、/stream 请求体中指定的模型 id；为空则忽略客户端 model，始终用 resolveModel()。 */
    private List<String> allowedModels;

    private transient volatile List<String> cachedClientModels;
    private transient volatile String cachedClientModelsDefault;

    // ── Custom setters with validation ──────────────────────────────

    public void setContextPath(String contextPath) {
        this.contextPath = normalizeContextPath(contextPath);
    }

    public void setLlmMaxRetries(int llmMaxRetries) {
        this.llmMaxRetries = Math.max(0, Math.min(llmMaxRetries, 5));
    }

    public void setModel(String model) {
        this.model = model;
        this.cachedClientModels = null;
        this.cachedClientModelsDefault = null;
    }

    public void setAllowedModels(List<String> allowedModels) {
        this.allowedModels = allowedModels;
        this.cachedClientModels = null;
        this.cachedClientModelsDefault = null;
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
        // R5 (2026-06): opt-in DNS-rebinding (TOCTOU) hardening. When true, plaintext
        // http(s is never pinned) fetches connect to the already-validated IP instead of
        // re-resolving the host, closing the rebinding window for cloud-metadata-style
        // targets (169.254.169.254 is http). Default off because it needs the JVM flag
        // -Djdk.httpclient.allowRestrictedHeaders=host to send the original Host header;
        // when that flag is absent the fetcher safely falls back to non-pinned requests.
        private boolean pinResolvedIp = false;
        private int maxBytes = 524_288;
        private int timeoutSeconds = 15;
        private int maxCharsInjected = 24_000;
        private int cacheTtlSeconds = 90;
        private int cacheMaxEntries = 32;
        private int previewMaxSummaryChars = 900;
        private int previewMaxImages = 10;
        private String webSearchProvider = "duckduckgo";
        private String webSearchApiKey;
        private String webSearchEndpoint;
        private int webSearchMaxResults = 5;
        private String webSearchAllowedDomains;
        private String webSearchBlockedDomains;

        public void setWebSearchMaxResults(int webSearchMaxResults) {
            this.webSearchMaxResults = Math.max(1, Math.min(webSearchMaxResults, 10));
        }
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

    @Getter
    public static class LatencyProperties {
        private int fastRouteMaxChars = 32;
        private int slowTtftThresholdMs = 3_000;
        private int slowTotalThresholdMs = 8_000;
        private int slowRequestWarningStreak = 2;

        public void setFastRouteMaxChars(int fastRouteMaxChars) {
            this.fastRouteMaxChars = Math.max(1, Math.min(200, fastRouteMaxChars));
        }

        public void setSlowTtftThresholdMs(int slowTtftThresholdMs) {
            this.slowTtftThresholdMs = Math.max(100, slowTtftThresholdMs);
        }

        public void setSlowTotalThresholdMs(int slowTotalThresholdMs) {
            this.slowTotalThresholdMs = Math.max(100, slowTotalThresholdMs);
        }

        public void setSlowRequestWarningStreak(int slowRequestWarningStreak) {
            this.slowRequestWarningStreak = Math.max(1, Math.min(10, slowRequestWarningStreak));
        }
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

        /**
         * 服务前置的可信反向代理层数（Nginx / ALB 等）。默认 0：完全忽略 {@code X-Forwarded-For}，仅以 {@code remoteAddr}
         * 作为客户端身份，避免请求方伪造 XFF 绕过限流。设为 N(&gt;0) 时，仅当 XFF 链长度 不小于 N 才从右数第 N 个条目取真实客户端 IP（右侧 N
         * 个条目由可信代理追加，不可伪造）；链长不足 N 视为 异常并回退到 {@code remoteAddr}。
         */
        private int trustedProxyHops = 0;

        /**
         * 未配置 {@code access-token} 时是否让应用启动失败（fail-fast）。默认 false：保持可嵌入语义（宿主可自行
         * 鉴权），仅打高危启动告警。安全敏感的独立部署建议设为 true，强制必须配置 {@code access-token} 才能启动， 避免业务端点在无人察觉的情况下对任意 HTTP
         * 客户端开放。
         */
        private boolean requireAccessToken = false;
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

        /**
         * Optional secret used to encrypt runtime model API keys at rest. When blank, runtime API
         * keys stay in memory only and are never persisted.
         */
        private String runtimeConfigSecretKey;

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

    public boolean isUrlFetchPinResolvedIp() {
        return urlFetch.isPinResolvedIp();
    }

    public void setUrlFetchPinResolvedIp(boolean v) {
        urlFetch.setPinResolvedIp(v);
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

    public String getWebSearchProvider() {
        return urlFetch.getWebSearchProvider();
    }

    public void setWebSearchProvider(String webSearchProvider) {
        urlFetch.setWebSearchProvider(webSearchProvider);
    }

    public String getWebSearchApiKey() {
        return urlFetch.getWebSearchApiKey();
    }

    public void setWebSearchApiKey(String webSearchApiKey) {
        urlFetch.setWebSearchApiKey(webSearchApiKey);
    }

    public String getWebSearchEndpoint() {
        return urlFetch.getWebSearchEndpoint();
    }

    public void setWebSearchEndpoint(String webSearchEndpoint) {
        urlFetch.setWebSearchEndpoint(webSearchEndpoint);
    }

    public int getWebSearchMaxResults() {
        return urlFetch.getWebSearchMaxResults();
    }

    public void setWebSearchMaxResults(int webSearchMaxResults) {
        urlFetch.setWebSearchMaxResults(webSearchMaxResults);
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

    public int getTrustedProxyHops() {
        return security.getTrustedProxyHops();
    }

    public void setTrustedProxyHops(int v) {
        security.setTrustedProxyHops(v);
    }

    public boolean isRequireAccessToken() {
        return security.isRequireAccessToken();
    }

    public void setRequireAccessToken(boolean v) {
        security.setRequireAccessToken(v);
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

    public String getAdminToken() {
        return admin.getAdminToken();
    }

    public void setAdminToken(String v) {
        admin.setAdminToken(v);
    }

    public String getRuntimeConfigSecretKey() {
        return admin.getRuntimeConfigSecretKey();
    }

    public void setRuntimeConfigSecretKey(String v) {
        admin.setRuntimeConfigSecretKey(v);
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
        List<String> cached = cachedClientModels;
        if (cached != null && Objects.equals(cachedClientModelsDefault, def)) return cached;
        List<String> allowed = allowedModels;
        if (allowed == null || allowed.isEmpty()) {
            List<String> fallback = java.util.List.of(def);
            cachedClientModelsDefault = def;
            cachedClientModels = fallback;
            return fallback;
        }
        java.util.ArrayList<String> models = new java.util.ArrayList<>();
        for (String m : allowed) {
            if (m == null || m.isBlank()) continue;
            String normalized = m.trim();
            if (!models.contains(normalized)) models.add(normalized);
        }
        List<String> result =
                models.isEmpty() ? java.util.List.of(def) : java.util.List.copyOf(models);
        cachedClientModelsDefault = def;
        cachedClientModels = result;
        return result;
    }

    /**
     * Resolve the actual API base URL based on provider if not explicitly set.
     *
     * <p>Refactor (T2)：内置 16 家 Provider 的 base-url 常量表已抽至 {@link ProviderDefaults#resolveBaseUrl}，
     * 新增 Provider 请在那里维护。
     */
    public String resolveBaseUrl() {
        return ProviderDefaults.resolveBaseUrl(provider, baseUrl);
    }

    /**
     * Resolve MiniMax's dedicated Coding Plan VLM API base URL for image understanding.
     *
     * <p>Refactor (T2)：地区推断逻辑见 {@link ProviderDefaults#resolveMinimaxVlmBaseUrl}。
     */
    public String resolveMinimaxVlmBaseUrl() {
        return ProviderDefaults.resolveMinimaxVlmBaseUrl(minimaxVlmBaseUrl, baseUrl);
    }

    /**
     * Resolve the default model name based on provider if not explicitly set.
     *
     * <p>Refactor (T2)：内置 16 家 Provider 的默认 model 常量表已抽至 {@link
     * ProviderDefaults#resolveDefaultModel}，新增 Provider 请在那里维护。
     */
    public String resolveModel() {
        return ProviderDefaults.resolveDefaultModel(provider, model);
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
