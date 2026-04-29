package com.aiassistant.controller;

import com.aiassistant.config.AiAssistantProperties;
import com.aiassistant.config.AiAssistantSecurityPostureAdvisor;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Read-only runtime configuration summary for deployment verification.
 *
 * <p>The response intentionally avoids secrets such as API keys, access tokens and full upstream base URLs.
 */
@RestController
@RequestMapping("${ai-assistant.context-path:/ai-assistant}")
public class RuntimeConfigController {

    private final AiAssistantProperties properties;
    private final AiAssistantSecurityPostureAdvisor securityPostureAdvisor;

    public RuntimeConfigController(
            AiAssistantProperties properties,
            AiAssistantSecurityPostureAdvisor securityPostureAdvisor) {
        this.properties = properties;
        this.securityPostureAdvisor = securityPostureAdvisor;
    }

    @GetMapping("/runtime/config")
    public Map<String, Object> runtimeConfig() {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("success", true);
        result.put("service", service());
        result.put("security", security());
        result.put("features", features());
        result.put("limits", limits());
        return result;
    }

    private Map<String, Object> service() {
        Map<String, Object> service = new LinkedHashMap<>();
        service.put("contextPath", properties.getContextPath());
        service.put("provider", properties.getProvider());
        service.put("model", properties.resolveModel());
        service.put("models", properties.listModelsForClient());
        service.put("customBaseUrlConfigured", hasText(properties.getBaseUrl()));
        service.put("apiKeyConfigured", !properties.resolveApiKeys().isEmpty());
        return service;
    }

    private Map<String, Object> security() {
        String[] allowedOrigins = properties.resolveAllowedOrigins();
        boolean wildcardOrigins = allowedOrigins.length == 1 && "*".equals(allowedOrigins[0]);

        Map<String, Object> security = new LinkedHashMap<>();
        security.put("accessTokenConfigured", hasText(properties.getAccessToken()));
        security.put("queryTokenAuthEnabled", properties.isAllowQueryTokenAuth());
        security.put("allowedOriginsMode", wildcardOrigins ? "wildcard" : "explicit");
        security.put("allowedOriginsCount", wildcardOrigins ? 0 : allowedOrigins.length);
        security.put("securityWarnings", securityPostureAdvisor.warningCodes());
        return security;
    }

    private Map<String, Object> features() {
        Map<String, Object> features = new LinkedHashMap<>();
        features.put("adminEnabled", properties.isAdminEnabled());
        features.put("connectorManagementEnabled", properties.isConnectorManagementEnabled());
        features.put("mcpServerEnabled", properties.isMcpServerEnabled());
        features.put("websocketEnabled", properties.isWebsocketEnabled());
        features.put("ragEnabled", properties.isRagEnabled());
        features.put("piiMaskingEnabled", properties.isPiiMaskingEnabled());
        features.put("urlFetchEnabled", properties.isUrlFetchEnabled());
        features.put("urlFetchSsrfProtection", properties.isUrlFetchSsrfProtection());
        features.put("headlessFetchEnabled", properties.isHeadlessFetchEnabled());
        features.put("allowedModelsConfigured", properties.getAllowedModels() != null
                && !properties.getAllowedModels().isEmpty());
        return features;
    }

    private Map<String, Object> limits() {
        Map<String, Object> limits = new LinkedHashMap<>();
        limits.put("rateLimitPerMinute", properties.getRateLimit());
        limits.put("rateLimitPerAction", properties.getRateLimitPerAction());
        limits.put("timeoutSeconds", properties.getTimeoutSeconds());
        limits.put("maxTokens", properties.getMaxTokens());
        limits.put("temperature", properties.getTemperature());
        limits.put("llmMaxRetries", properties.getLlmMaxRetries());
        limits.put("fileMaxExtractedChars", properties.getFileMaxExtractedChars());
        limits.put("chatMaxTotalChars", properties.getChatMaxTotalChars());
        limits.put("chatHistoryMaxChars", properties.getChatHistoryMaxChars());
        limits.put("exportMaxMessages", properties.getExportMaxMessages());
        limits.put("exportMaxTotalChars", properties.getExportMaxTotalChars());
        limits.put("exportMaxImageBytes", properties.getExportMaxImageBytes());
        limits.put("exportMaxImageUrls", properties.getExportMaxImageUrls());
        limits.put("urlFetchMaxBytes", properties.getUrlFetchMaxBytes());
        limits.put("urlFetchTimeoutSeconds", properties.getUrlFetchTimeoutSeconds());
        limits.put("urlPreviewMaxImages", properties.getUrlPreviewMaxImages());
        limits.put("enabledActions", Arrays.asList("chat", "translate", "summarize", "stream", "export"));
        return limits;
    }

    private boolean hasText(String value) {
        return value != null && !value.isBlank();
    }
}
