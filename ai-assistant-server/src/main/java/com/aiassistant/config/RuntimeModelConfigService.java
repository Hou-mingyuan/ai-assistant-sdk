package com.aiassistant.config;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Properties;
import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.web.reactive.function.client.WebClient;

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
    private static final String API_KEY_ENCRYPTED_PROPERTY = "apiKeyEncrypted";
    private static final String WEB_SEARCH_API_KEY_ENCRYPTED_PROPERTY = "webSearchApiKeyEncrypted";
    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    private final AiAssistantProperties properties;
    private final Path storagePath;
    private final ProviderModelDiscovery modelDiscovery = new ProviderModelDiscovery();

    public RuntimeModelConfigService(AiAssistantProperties properties) {
        this(properties, defaultStoragePath(), properties.isAdminEnabled());
    }

    RuntimeModelConfigService(AiAssistantProperties properties, Path storagePath) {
        this(properties, storagePath, true);
    }

    private RuntimeModelConfigService(
            AiAssistantProperties properties, Path storagePath, boolean loadPersisted) {
        this.properties = properties;
        this.storagePath = storagePath;
        if (loadPersisted) {
            loadPersistedConfig();
        }
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
        if (request.getWarmupEnabled() != null) {
            properties.setWarmupEnabled(request.getWarmupEnabled());
        }
        applyLatencyConfig(request);
        if (hasText(request.getMinimaxVlmBaseUrl())) {
            properties.setMinimaxVlmBaseUrl(request.getMinimaxVlmBaseUrl().trim());
        }
        if (hasText(request.getWebSearchProvider())) {
            properties.getUrlFetch().setWebSearchProvider(request.getWebSearchProvider().trim());
        }
        if (hasText(request.getWebSearchApiKey())) {
            properties.getUrlFetch().setWebSearchApiKey(request.getWebSearchApiKey().trim());
        }
        if (request.getWebSearchMaxResults() != null) {
            properties
                    .getUrlFetch()
                    .setWebSearchMaxResults(
                            Math.max(1, Math.min(10, request.getWebSearchMaxResults())));
        }
        if (request.getWebSearchAllowedDomains() != null) {
            properties
                    .getUrlFetch()
                    .setWebSearchAllowedDomains(request.getWebSearchAllowedDomains().trim());
        }
        if (request.getWebSearchBlockedDomains() != null) {
            properties
                    .getUrlFetch()
                    .setWebSearchBlockedDomains(request.getWebSearchBlockedDomains().trim());
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

    public synchronized Map<String, Object> discoverProviderModels() {
        List<String> keys = properties.resolveApiKeys();
        if (keys.isEmpty()) {
            return Map.of("success", false, "error", "No provider API key configured");
        }
        try {
            String baseUrl = trimTrailingSlash(properties.resolveBaseUrl());
            String body =
                    WebClient.builder()
                            .baseUrl(baseUrl)
                            .defaultHeader(HttpHeaders.AUTHORIZATION, "Bearer " + keys.get(0))
                            .build()
                            .get()
                            .uri(modelDiscovery.modelsPath(properties.getProvider()))
                            .retrieve()
                            .bodyToMono(String.class)
                            .block();
            List<String> models = modelDiscovery.parseModels(properties.getProvider(), body);
            return Map.of("success", true, "models", models);
        } catch (Exception e) {
            return Map.of(
                    "success",
                    false,
                    "error",
                    e.getMessage() != null ? e.getMessage() : "Provider model discovery failed");
        }
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

    private void applyLatencyConfig(UpdateRequest request) {
        if (request.getFastRouteMaxChars() != null) {
            properties.getLatency().setFastRouteMaxChars(request.getFastRouteMaxChars());
        }
        if (request.getSlowTtftThresholdMs() != null) {
            properties.getLatency().setSlowTtftThresholdMs(request.getSlowTtftThresholdMs());
        }
        if (request.getSlowTotalThresholdMs() != null) {
            properties.getLatency().setSlowTotalThresholdMs(request.getSlowTotalThresholdMs());
        }
        if (request.getSlowRequestWarningStreak() != null) {
            properties
                    .getLatency()
                    .setSlowRequestWarningStreak(request.getSlowRequestWarningStreak());
        }
    }

    private static void setIntegerIfPresent(
            String raw, java.util.function.Consumer<Integer> consumer) {
        if (hasText(raw)) {
            consumer.accept(Integer.parseInt(raw));
        }
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
            String warmupEnabled = persisted.getProperty("warmupEnabled");
            if (hasText(warmupEnabled)) {
                request.setWarmupEnabled(Boolean.parseBoolean(warmupEnabled));
            }
            setIntegerIfPresent(
                    persisted.getProperty("fastRouteMaxChars"), request::setFastRouteMaxChars);
            setIntegerIfPresent(
                    persisted.getProperty("slowTtftThresholdMs"), request::setSlowTtftThresholdMs);
            setIntegerIfPresent(
                    persisted.getProperty("slowTotalThresholdMs"),
                    request::setSlowTotalThresholdMs);
            setIntegerIfPresent(
                    persisted.getProperty("slowRequestWarningStreak"),
                    request::setSlowRequestWarningStreak);
            request.setMinimaxVlmBaseUrl(persisted.getProperty("minimaxVlmBaseUrl"));
            request.setWebSearchProvider(persisted.getProperty("webSearchProvider"));
            request.setWebSearchAllowedDomains(persisted.getProperty("webSearchAllowedDomains"));
            request.setWebSearchBlockedDomains(persisted.getProperty("webSearchBlockedDomains"));
            String webSearchMax = persisted.getProperty("webSearchMaxResults");
            if (hasText(webSearchMax)) {
                request.setWebSearchMaxResults(Integer.parseInt(webSearchMax));
            }
            applyWithoutPersisting(request);
            restorePersistedApiKey(persisted.getProperty(API_KEY_ENCRYPTED_PROPERTY));
            restorePersistedWebSearchApiKey(
                    persisted.getProperty(WEB_SEARCH_API_KEY_ENCRYPTED_PROPERTY));
        } catch (IOException e) {
            log.warn("Runtime model config load skipped: {}", e.getMessage());
        } catch (NumberFormatException e) {
            log.warn("Runtime model config numeric field ignored: {}", e.getMessage());
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
        if (request.getWarmupEnabled() != null) {
            properties.setWarmupEnabled(request.getWarmupEnabled());
        }
        applyLatencyConfig(request);
        if (hasText(request.getMinimaxVlmBaseUrl())) {
            properties.setMinimaxVlmBaseUrl(request.getMinimaxVlmBaseUrl().trim());
        }
        if (hasText(request.getWebSearchProvider())) {
            properties.getUrlFetch().setWebSearchProvider(request.getWebSearchProvider().trim());
        }
        if (request.getWebSearchMaxResults() != null) {
            properties
                    .getUrlFetch()
                    .setWebSearchMaxResults(
                            Math.max(1, Math.min(10, request.getWebSearchMaxResults())));
        }
        if (request.getWebSearchAllowedDomains() != null) {
            properties
                    .getUrlFetch()
                    .setWebSearchAllowedDomains(request.getWebSearchAllowedDomains().trim());
        }
        if (request.getWebSearchBlockedDomains() != null) {
            properties
                    .getUrlFetch()
                    .setWebSearchBlockedDomains(request.getWebSearchBlockedDomains().trim());
        }
    }

    private void persistNonSecretConfig(Snapshot snapshot) {
        Properties persisted = new Properties();
        put(persisted, "provider", snapshot.provider);
        put(persisted, "baseUrl", snapshot.baseUrl);
        put(persisted, "model", snapshot.model);
        put(persisted, "allowedModels", String.join(",", snapshot.allowedModels));
        put(persisted, "warmupEnabled", String.valueOf(snapshot.warmupEnabled));
        put(persisted, "fastRouteMaxChars", String.valueOf(snapshot.fastRouteMaxChars));
        put(persisted, "slowTtftThresholdMs", String.valueOf(snapshot.slowTtftThresholdMs));
        put(persisted, "slowTotalThresholdMs", String.valueOf(snapshot.slowTotalThresholdMs));
        put(
                persisted,
                "slowRequestWarningStreak",
                String.valueOf(snapshot.slowRequestWarningStreak));
        put(persisted, "minimaxVlmBaseUrl", snapshot.minimaxVlmBaseUrl);
        put(persisted, "webSearchProvider", snapshot.webSearchProvider);
        put(persisted, "webSearchMaxResults", String.valueOf(snapshot.webSearchMaxResults));
        put(persisted, "webSearchAllowedDomains", snapshot.webSearchAllowedDomains);
        put(persisted, "webSearchBlockedDomains", snapshot.webSearchBlockedDomains);
        String encryptedApiKey = encryptRuntimeApiKey();
        put(persisted, API_KEY_ENCRYPTED_PROPERTY, encryptedApiKey);
        String encryptedWebSearchApiKey = encryptRuntimeWebSearchApiKey();
        put(persisted, WEB_SEARCH_API_KEY_ENCRYPTED_PROPERTY, encryptedWebSearchApiKey);
        try {
            Files.createDirectories(storagePath.getParent());
            try (OutputStream out = Files.newOutputStream(storagePath)) {
                persisted.store(
                        out,
                        "AI Assistant runtime model config (API key encrypted only when a runtime secret is configured)");
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
        String override = System.getProperty("ai.assistant.runtime.config.path");
        if (hasText(override)) {
            return Paths.get(override);
        }
        return Paths.get(
                System.getProperty("user.home"),
                ".ai-assistant",
                "runtime-model-config.properties");
    }

    private static String trimTrailingSlash(String value) {
        String normalized = value == null ? "" : value.trim();
        while (normalized.endsWith("/")) {
            normalized = normalized.substring(0, normalized.length() - 1);
        }
        return normalized;
    }

    private void restorePersistedApiKey(String encrypted) {
        if (!hasText(encrypted)) {
            return;
        }
        String secret = runtimeConfigSecret();
        if (!hasText(secret)) {
            log.info("Encrypted runtime API key ignored because no runtime config secret is set");
            return;
        }
        try {
            properties.setApiKey(decrypt(encrypted, secret));
            properties.setApiKeys(null);
        } catch (GeneralSecurityException | IllegalArgumentException e) {
            log.warn("Runtime API key decrypt skipped: {}", e.getMessage());
        }
    }

    private void restorePersistedWebSearchApiKey(String encrypted) {
        if (!hasText(encrypted)) {
            return;
        }
        String secret = runtimeConfigSecret();
        if (!hasText(secret)) {
            log.info(
                    "Encrypted runtime web search API key ignored because no runtime config secret is set");
            return;
        }
        try {
            properties.getUrlFetch().setWebSearchApiKey(decrypt(encrypted, secret));
        } catch (GeneralSecurityException | IllegalArgumentException e) {
            log.warn("Runtime web search API key decrypt skipped: {}", e.getMessage());
        }
    }

    private String encryptRuntimeApiKey() {
        String secret = runtimeConfigSecret();
        List<String> keys = properties.resolveApiKeys();
        if (!hasText(secret) || keys.isEmpty()) {
            return null;
        }
        try {
            return encrypt(keys.get(0), secret);
        } catch (GeneralSecurityException e) {
            log.warn("Runtime API key encrypt skipped: {}", e.getMessage());
            return null;
        }
    }

    private String encryptRuntimeWebSearchApiKey() {
        String secret = runtimeConfigSecret();
        String apiKey = properties.getUrlFetch().getWebSearchApiKey();
        if (!hasText(secret) || !hasText(apiKey)) {
            return null;
        }
        try {
            return encrypt(apiKey, secret);
        } catch (GeneralSecurityException e) {
            log.warn("Runtime web search API key encrypt skipped: {}", e.getMessage());
            return null;
        }
    }

    private String runtimeConfigSecret() {
        return properties.getAdmin().getRuntimeConfigSecretKey();
    }

    private static String encrypt(String plaintext, String secret) throws GeneralSecurityException {
        byte[] iv = new byte[12];
        SECURE_RANDOM.nextBytes(iv);
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.ENCRYPT_MODE, key(secret), new GCMParameterSpec(128, iv));
        byte[] ciphertext = cipher.doFinal(plaintext.getBytes(StandardCharsets.UTF_8));
        return Base64.getEncoder().encodeToString(iv)
                + "."
                + Base64.getEncoder().encodeToString(ciphertext);
    }

    private static String decrypt(String encrypted, String secret) throws GeneralSecurityException {
        String[] parts = encrypted.split("\\.", 2);
        if (parts.length != 2) {
            throw new GeneralSecurityException("invalid encrypted key payload");
        }
        byte[] iv = Base64.getDecoder().decode(parts[0]);
        byte[] ciphertext = Base64.getDecoder().decode(parts[1]);
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.DECRYPT_MODE, key(secret), new GCMParameterSpec(128, iv));
        return new String(cipher.doFinal(ciphertext), StandardCharsets.UTF_8);
    }

    private static SecretKeySpec key(String secret) throws GeneralSecurityException {
        byte[] digest =
                MessageDigest.getInstance("SHA-256")
                        .digest(secret.getBytes(StandardCharsets.UTF_8));
        return new SecretKeySpec(digest, "AES");
    }

    public static class UpdateRequest {
        private String provider;
        private String baseUrl;
        private String apiKey;
        private String model;
        private List<String> allowedModels;
        private String allowedModelsText;
        private Boolean warmupEnabled;
        private Integer fastRouteMaxChars;
        private Integer slowTtftThresholdMs;
        private Integer slowTotalThresholdMs;
        private Integer slowRequestWarningStreak;
        private String minimaxVlmBaseUrl;
        private String webSearchProvider;
        private String webSearchApiKey;
        private Integer webSearchMaxResults;
        private String webSearchAllowedDomains;
        private String webSearchBlockedDomains;

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

        public Boolean getWarmupEnabled() {
            return warmupEnabled;
        }

        public void setWarmupEnabled(Boolean warmupEnabled) {
            this.warmupEnabled = warmupEnabled;
        }

        public Integer getFastRouteMaxChars() {
            return fastRouteMaxChars;
        }

        public void setFastRouteMaxChars(Integer fastRouteMaxChars) {
            this.fastRouteMaxChars = fastRouteMaxChars;
        }

        public Integer getSlowTtftThresholdMs() {
            return slowTtftThresholdMs;
        }

        public void setSlowTtftThresholdMs(Integer slowTtftThresholdMs) {
            this.slowTtftThresholdMs = slowTtftThresholdMs;
        }

        public Integer getSlowTotalThresholdMs() {
            return slowTotalThresholdMs;
        }

        public void setSlowTotalThresholdMs(Integer slowTotalThresholdMs) {
            this.slowTotalThresholdMs = slowTotalThresholdMs;
        }

        public Integer getSlowRequestWarningStreak() {
            return slowRequestWarningStreak;
        }

        public void setSlowRequestWarningStreak(Integer slowRequestWarningStreak) {
            this.slowRequestWarningStreak = slowRequestWarningStreak;
        }

        public String getMinimaxVlmBaseUrl() {
            return minimaxVlmBaseUrl;
        }

        public void setMinimaxVlmBaseUrl(String minimaxVlmBaseUrl) {
            this.minimaxVlmBaseUrl = minimaxVlmBaseUrl;
        }

        public String getWebSearchProvider() {
            return webSearchProvider;
        }

        public void setWebSearchProvider(String webSearchProvider) {
            this.webSearchProvider = webSearchProvider;
        }

        public String getWebSearchApiKey() {
            return webSearchApiKey;
        }

        public void setWebSearchApiKey(String webSearchApiKey) {
            this.webSearchApiKey = webSearchApiKey;
        }

        public Integer getWebSearchMaxResults() {
            return webSearchMaxResults;
        }

        public void setWebSearchMaxResults(Integer webSearchMaxResults) {
            this.webSearchMaxResults = webSearchMaxResults;
        }

        public String getWebSearchAllowedDomains() {
            return webSearchAllowedDomains;
        }

        public void setWebSearchAllowedDomains(String webSearchAllowedDomains) {
            this.webSearchAllowedDomains = webSearchAllowedDomains;
        }

        public String getWebSearchBlockedDomains() {
            return webSearchBlockedDomains;
        }

        public void setWebSearchBlockedDomains(String webSearchBlockedDomains) {
            this.webSearchBlockedDomains = webSearchBlockedDomains;
        }
    }

    public static class Snapshot {
        private String provider;
        private String baseUrl;
        private String model;
        private List<String> allowedModels;
        private boolean warmupEnabled;
        private int fastRouteMaxChars;
        private int slowTtftThresholdMs;
        private int slowTotalThresholdMs;
        private int slowRequestWarningStreak;
        private boolean apiKeyConfigured;
        private String minimaxVlmBaseUrl;
        private String webSearchProvider;
        private int webSearchMaxResults;
        private boolean webSearchApiKeyConfigured;
        private String webSearchAllowedDomains;
        private String webSearchBlockedDomains;

        static Snapshot from(AiAssistantProperties properties) {
            Snapshot s = new Snapshot();
            s.provider = properties.getProvider();
            s.baseUrl = properties.resolveBaseUrl();
            s.model = properties.resolveModel();
            s.allowedModels = properties.listModelsForClient();
            s.warmupEnabled = properties.isWarmupEnabled();
            s.fastRouteMaxChars = properties.getLatency().getFastRouteMaxChars();
            s.slowTtftThresholdMs = properties.getLatency().getSlowTtftThresholdMs();
            s.slowTotalThresholdMs = properties.getLatency().getSlowTotalThresholdMs();
            s.slowRequestWarningStreak = properties.getLatency().getSlowRequestWarningStreak();
            s.apiKeyConfigured = !properties.resolveApiKeys().isEmpty();
            s.minimaxVlmBaseUrl = properties.resolveMinimaxVlmBaseUrl();
            s.webSearchProvider = properties.getUrlFetch().getWebSearchProvider();
            s.webSearchMaxResults = properties.getUrlFetch().getWebSearchMaxResults();
            s.webSearchApiKeyConfigured = hasText(properties.getUrlFetch().getWebSearchApiKey());
            s.webSearchAllowedDomains = properties.getUrlFetch().getWebSearchAllowedDomains();
            s.webSearchBlockedDomains = properties.getUrlFetch().getWebSearchBlockedDomains();
            return s;
        }

        public Map<String, Object> toResponse() {
            Map<String, Object> out = new LinkedHashMap<>();
            out.put("success", true);
            out.put("provider", provider);
            out.put("baseUrl", baseUrl);
            out.put("model", model);
            out.put("allowedModels", allowedModels);
            out.put("warmupEnabled", warmupEnabled);
            out.put("fastRouteMaxChars", fastRouteMaxChars);
            out.put("slowTtftThresholdMs", slowTtftThresholdMs);
            out.put("slowTotalThresholdMs", slowTotalThresholdMs);
            out.put("slowRequestWarningStreak", slowRequestWarningStreak);
            out.put("apiKeyConfigured", apiKeyConfigured);
            out.put("minimaxVlmBaseUrl", minimaxVlmBaseUrl);
            out.put("webSearchProvider", webSearchProvider);
            out.put("webSearchMaxResults", webSearchMaxResults);
            out.put("webSearchApiKeyConfigured", webSearchApiKeyConfigured);
            out.put("webSearchAllowedDomains", webSearchAllowedDomains);
            out.put("webSearchBlockedDomains", webSearchBlockedDomains);
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
