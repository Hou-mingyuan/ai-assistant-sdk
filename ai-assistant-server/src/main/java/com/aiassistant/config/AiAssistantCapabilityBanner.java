package com.aiassistant.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * 启动时在日志中打印一份当前已启用 / 已关闭的能力清单，便于运维快速核对配置。
 *
 * <p>这是一个被动展示组件：仅读取 {@link AiAssistantProperties}，不修改任何状态，也不阻塞启动。
 * 与 {@link AiAssistantSecurityPostureAdvisor} 配合使用，前者只汇总，后者只对高风险组合发出警告。
 *
 * <p>日志格式有意保持 ASCII 与对齐，方便 grep 和 K8s 日志收集系统稳定解析。
 */
public class AiAssistantCapabilityBanner {

    private static final Logger log = LoggerFactory.getLogger(AiAssistantCapabilityBanner.class);

    private final AiAssistantProperties properties;

    public AiAssistantCapabilityBanner(AiAssistantProperties properties) {
        this.properties = properties;
    }

    /** 在启动完成后调用一次，打印 banner。多次调用幂等（仅多打几行日志）。 */
    public void logBanner() {
        if (!log.isInfoEnabled()) {
            return;
        }

        StringBuilder sb = new StringBuilder(1024);
        appendDivider(sb);
        sb.append('\n').append("  AI Assistant — Enabled Capabilities");
        appendDivider(sb);

        appendSection(sb, "CORE");
        appendKv(sb, "Provider",         describeProvider());
        appendKv(sb, "Context path",     properties.getContextPath());
        appendKv(sb, "Access token",     describeAccessToken());
        appendKv(sb, "Allowed origins",  describeAllowedOrigins());
        appendKv(sb, "Rate limit",       describeRateLimit());

        appendSection(sb, "TOGGLES (default: false unless marked)");
        appendKv(sb, "Stats",                          onOff(properties.isEnableStats(),               true));
        appendKv(sb, "Admin API",                      onOff(properties.isAdminEnabled(),              false));
        appendKv(sb, "Connector mgmt API",             onOff(properties.isConnectorManagementEnabled(), false));
        appendKv(sb, "MCP Server",                     onOff(properties.isMcpServerEnabled(),          false));
        appendKv(sb, "WebSocket channel",              onOff(properties.isWebsocketEnabled(),          false));
        appendKv(sb, "URL fetch",                      onOff(properties.getUrlFetch().isEnabled(),     true));
        appendKv(sb, "  SSRF protection",              onOff(properties.getUrlFetch().isSsrfProtection(), true));
        appendKv(sb, "Headless URL fetch",             onOff(properties.isHeadlessFetchEnabled(),      false));
        appendKv(sb, "RAG",                            onOff(properties.isRagEnabled(),                false));
        appendKv(sb, "PII masking",                    onOff(properties.isPiiMaskingEnabled(),         true));
        appendKv(sb, "Allow client system prompt",     onOff(properties.isAllowClientSystemPrompt(),   true));
        appendKv(sb, "Query string token auth",        onOff(properties.isAllowQueryTokenAuth(),       false));

        appendSection(sb, "HINTS");
        sb.append("\n  Reference docs/guide/configuration.md for the full list of toggles.");
        sb.append("\n  For multi-replica deploys configure Redis-backed rate limit and session store.");
        sb.append("\n  Security warnings (if any) are logged separately by AiAssistantSecurityPostureAdvisor.");
        appendDivider(sb);

        log.info("\n{}", sb);
    }

    private void appendDivider(StringBuilder sb) {
        sb.append('\n').append("==========================================================");
    }

    private void appendSection(StringBuilder sb, String title) {
        sb.append('\n').append("-- ").append(title).append(" --");
    }

    private void appendKv(StringBuilder sb, String key, String value) {
        sb.append('\n').append("  ").append(padRight(key, 32)).append(' ').append(value);
    }

    private static String padRight(String value, int width) {
        if (value == null) value = "";
        if (value.length() >= width) return value;
        StringBuilder sb = new StringBuilder(width);
        sb.append(value);
        for (int i = value.length(); i < width; i++) sb.append(' ');
        return sb.toString();
    }

    /**
     * 渲染开关状态：与默认值不一致时附加 (custom) 标记，便于一眼识别被显式改动的开关。
     */
    private static String onOff(boolean current, boolean defaultValue) {
        String state = current ? "ON" : "OFF";
        return current == defaultValue ? state : state + " (custom)";
    }

    private String describeProvider() {
        String provider = properties.getProvider();
        String model = properties.getModel();
        if (model == null || model.isBlank()) {
            return provider + " (default model)";
        }
        return provider + " (model=" + model + ")";
    }

    private String describeAccessToken() {
        String token = properties.getAccessToken();
        if (token == null || token.isBlank()) {
            return "NOT SET (anyone can call the API)";
        }
        return "configured";
    }

    private String describeAllowedOrigins() {
        String origins = properties.getAllowedOrigins();
        if (origins == null || origins.isBlank()) return "(empty)";
        if ("*".equals(origins.trim())) return "* (any origin)";
        return origins;
    }

    private String describeRateLimit() {
        int rateLimit = properties.getRateLimit();
        if (rateLimit <= 0) return "OFF (no per-IP/Token quota)";
        return rateLimit + "/min per IP/Token";
    }
}
