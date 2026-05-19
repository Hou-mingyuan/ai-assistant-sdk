package com.aiassistant.config;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Properties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Runtime-editable model provider configuration.
 *
 * <p>The service mutates {@link AiAssistantProperties} deliberately so existing request builders,
 * model list endpoints and LLM clients can observe the latest provider/baseUrl/key/model without
 * recreating Spring beans. Secrets are write-only from API responses: callers can set a new API key
 * but only receive a boolean "configured" flag back.
 */
public class RuntimeModelConfigService {

    private static final Logger log = LoggerFactory.getLogger(RuntimeModelConfigService.class);

    private final AiAssistantProperties properties;
    private final Path storagePath;

    public RuntimeModelConfigService(AiAssistantProperties properties) {
        this(properties, defaultStoragePath());
    }

    RuntimeModelConfigService(AiAssistantProperties properties, Path storagePath) {
        this.properties = properties;
        this.storagePath = storagePath;
        loadPersistedConfig();
    }

    public synchronized Snapshot snapshot() {
        return Snapshot.from(properties);
    }

    public synchronized Snapshot update(UpdateRequest request) {
        if (request == null) {
            return snapshot();
        }
        if (hasText(request.getProvider())) {
            properties.setProvider(request.getProvider().trim());
        }
        if (hasText(request.getBaseUrl())) {
            properties.setBaseUrl(request.getBaseUrl().trim());
        }
        if (hasText(request.getApiKey())) {
            properties.setApiKey(request.getApiKey().trim());
            properties.setApiKeys(null);
        }
        if (hasText(request.getModel())) {
            properties.setModel(request.getModel().trim());
        }
        if (request.getAllowedModels() != null) {
            properties.setAllowedModels(normalizeModels(request.getAllowedModels()));
        } else if (hasText(request.getAllowedModelsText())) {
            properties.setAllowedModels(parseModels(request.getAllowedModelsText()));
        }
        if (hasText(request.getMinimaxVlmBaseUrl())) {
            properties.setMinimaxVlmBaseUrl(request.getMinimaxVlmBaseUrl().trim());
        }
        Snapshot next = snapshot();
        persistNonSecretConfig(next);
        log.info(
                "Runtime model config updated: provider={}, baseUrl={}, model={}, models={}",
                next.getProvider(),
                next.getBaseUrl(),
                next.getModel(),
                next.getAllowedModels().size());
        return next;
    }

    private static boolean hasText(String value) {
        return value != null && !value.isBlank();
    }

    private static List<String> parseModels(String raw) {
        if (raw == null || raw.isBlank()) {
            return List.of();
        }
        return normalizeModels(List.of(raw.split(",")));
    }

    private static List<String> normalizeModels(List<String> raw) {
        List<String> result = new ArrayList<>();
        for (String item : raw) {
            if (item == null) continue;
            String model = item.trim();
            if (!model.isEmpty() && !result.contains(model)) {
                result.add(model);
            }
        }
        return result;
    }

    private void loadPersistedConfig() {
        if (!Files.isRegularFile(storagePath)) {
            return;
        }
        Properties persisted = new Properties();
        try (InputStream in = Files.newInputStream(storagePath)) {
            persisted.load(in);
            UpdateRequest request = new UpdateRequest();
            request.setProvider(persisted.getProperty("provider"));
            request.setBaseUrl(persisted.getProperty("baseUrl"));
            request.setModel(persisted.getProperty("model"));
            request.setAllowedModelsText(persisted.getProperty("allowedModels"));
            request.setMinimaxVlmBaseUrl(persisted.getProperty("minimaxVlmBaseUrl"));
            applyWithoutPersisting(request);
        } catch (IOException e) {
            log.warn("Runtime model config load skipped: {}", e.getMessage());
        }
    }

    private void applyWithoutPersisting(UpdateRequest request) {
        if (hasText(request.getProvider())) {
            properties.setProvider(request.getProvider().trim());
        }
        if (hasText(request.getBaseUrl())) {
            properties.setBaseUrl(request.getBaseUrl().trim());
        }
        if (hasText(request.getModel())) {
            properties.setModel(request.getModel().trim());
        }
        if (hasText(request.getAllowedModelsText())) {
            properties.setAllowedModels(parseModels(request.getAllowedModelsText()));
        }
        if (hasText(request.getMinimaxVlmBaseUrl())) {
            properties.setMinimaxVlmBaseUrl(request.getMinimaxVlmBaseUrl().trim());
        }
    }

    private void persistNonSecretConfig(Snapshot snapshot) {
        Properties persisted = new Properties();
        put(persisted, "provider", snapshot.provider);
        put(persisted, "baseUrl", snapshot.baseUrl);
        put(persisted, "model", snapshot.model);
        put(persisted, "allowedModels", String.join(",", snapshot.allowedModels));
        put(persisted, "minimaxVlmBaseUrl", snapshot.minimaxVlmBaseUrl);
        try {
            Files.createDirectories(storagePath.getParent());
            try (OutputStream out = Files.newOutputStream(storagePath)) {
                persisted.store(
                        out, "AI Assistant runtime model config (API key is not persisted)");
            }
        } catch (IOException e) {
            log.warn("Runtime model config persist skipped: {}", e.getMessage());
        }
    }

    private static void put(Properties properties, String key, String value) {
        if (value != null && !value.isBlank()) {
            properties.setProperty(key, value);
        }
    }

    private static Path defaultStoragePath() {
        return Paths.get(
                System.getProperty("user.home"),
                ".ai-assistant",
                "runtime-model-config.properties");
    }

    public static class UpdateRequest {
        private String provider;
        private String baseUrl;
        private String apiKey;
        private String model;
        private List<String> allowedModels;
        private String allowedModelsText;
        private String minimaxVlmBaseUrl;

        public String getProvider() {
            return provider;
        }

        public void setProvider(String provider) {
            this.provider = provider;
        }

        public String getBaseUrl() {
            return baseUrl;
        }

        public void setBaseUrl(String baseUrl) {
            this.baseUrl = baseUrl;
        }

        public String getApiKey() {
            return apiKey;
        }

        public void setApiKey(String apiKey) {
            this.apiKey = apiKey;
        }

        public String getModel() {
            return model;
        }

        public void setModel(String model) {
            this.model = model;
        }

        public List<String> getAllowedModels() {
            return allowedModels;
        }

        public void setAllowedModels(List<String> allowedModels) {
            this.allowedModels = allowedModels;
        }

        public String getAllowedModelsText() {
            return allowedModelsText;
        }

        public void setAllowedModelsText(String allowedModelsText) {
            this.allowedModelsText = allowedModelsText;
        }

        public String getMinimaxVlmBaseUrl() {
            return minimaxVlmBaseUrl;
        }

        public void setMinimaxVlmBaseUrl(String minimaxVlmBaseUrl) {
            this.minimaxVlmBaseUrl = minimaxVlmBaseUrl;
        }
    }

    public static class Snapshot {
        private String provider;
        private String baseUrl;
        private String model;
        private List<String> allowedModels;
        private boolean apiKeyConfigured;
        private String minimaxVlmBaseUrl;

        static Snapshot from(AiAssistantProperties properties) {
            Snapshot s = new Snapshot();
            s.provider = properties.getProvider();
            s.baseUrl = properties.resolveBaseUrl();
            s.model = properties.resolveModel();
            s.allowedModels = properties.listModelsForClient();
            s.apiKeyConfigured = !properties.resolveApiKeys().isEmpty();
            s.minimaxVlmBaseUrl = properties.resolveMinimaxVlmBaseUrl();
            return s;
        }

        public Map<String, Object> toResponse() {
            Map<String, Object> out = new LinkedHashMap<>();
            out.put("success", true);
            out.put("provider", provider);
            out.put("baseUrl", baseUrl);
            out.put("model", model);
            out.put("allowedModels", allowedModels);
            out.put("apiKeyConfigured", apiKeyConfigured);
            out.put("minimaxVlmBaseUrl", minimaxVlmBaseUrl);
            return out;
        }

        public String getProvider() {
            return provider;
        }

        public String getBaseUrl() {
            return baseUrl;
        }

        public String getModel() {
            return model;
        }

        public List<String> getAllowedModels() {
            return allowedModels;
        }
    }
}
