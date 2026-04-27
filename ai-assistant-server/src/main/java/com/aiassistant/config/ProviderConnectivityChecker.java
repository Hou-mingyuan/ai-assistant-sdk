package com.aiassistant.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;

/**
 * Validates API key connectivity on application startup by sending a lightweight
 * request (GET /models or a minimal completion) to the configured provider.
 * Results are logged and exposed via {@link #getLastResult()}.
 */
public class ProviderConnectivityChecker {

    private static final Logger log = LoggerFactory.getLogger(ProviderConnectivityChecker.class);
    private static final Duration CONNECT_TIMEOUT = Duration.ofSeconds(10);

    private final AiAssistantProperties properties;
    private final HttpClient httpClient;
    private volatile ConnectivityResult lastResult;

    public ProviderConnectivityChecker(AiAssistantProperties properties) {
        this.properties = properties;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(CONNECT_TIMEOUT)
                .build();
    }

    /**
     * Run the connectivity check. Called once on application startup.
     */
    public void check() {
        String provider = properties.getProvider();
        String baseUrl = null;
        String apiKey = null;
        try {
            baseUrl = properties.resolveBaseUrl();
            List<String> keys = properties.resolveApiKeys();
            apiKey = keys.isEmpty() ? null : keys.get(0);
        } catch (Exception e) {
            lastResult = ConnectivityResult.failure(provider, e.getMessage());
            logResult();
            return;
        }

        if (apiKey == null || apiKey.isBlank()) {
            lastResult = ConnectivityResult.failure(provider, "No API key configured");
            logResult();
            return;
        }

        String modelsUrl = buildModelsUrl(baseUrl);
        String maskedKey = maskApiKey(apiKey);
        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(modelsUrl))
                    .timeout(CONNECT_TIMEOUT)
                    .header("Authorization", "Bearer " + apiKey)
                    .header("Accept", "application/json")
                    .GET()
                    .build();

            long start = System.currentTimeMillis();
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            long elapsed = System.currentTimeMillis() - start;
            int status = response.statusCode();

            if (status >= 200 && status < 300) {
                lastResult = ConnectivityResult.success(provider, maskedKey, elapsed, status);
            } else if (status == 401 || status == 403) {
                lastResult = ConnectivityResult.failure(provider,
                        "Authentication failed (HTTP " + status + "). Please check your API key: " + maskedKey);
            } else if (status == 404) {
                lastResult = ConnectivityResult.success(provider, maskedKey, elapsed, status);
            } else {
                String body = response.body();
                String snippet = body != null && body.length() > 200 ? body.substring(0, 200) + "..." : body;
                lastResult = ConnectivityResult.failure(provider,
                        "HTTP " + status + " from " + modelsUrl + ": " + snippet);
            }
        } catch (java.net.ConnectException e) {
            lastResult = ConnectivityResult.failure(provider,
                    "Connection refused: " + modelsUrl + ". Is the API server running?");
        } catch (java.net.http.HttpTimeoutException e) {
            lastResult = ConnectivityResult.failure(provider,
                    "Connection timed out after " + CONNECT_TIMEOUT.toSeconds() + "s: " + modelsUrl);
        } catch (Exception e) {
            lastResult = ConnectivityResult.failure(provider,
                    e.getClass().getSimpleName() + ": " + e.getMessage());
        }
        logResult();
    }

    private void logResult() {
        ConnectivityResult r = lastResult;
        if (r == null) return;
        if (r.success()) {
            log.info("\n" +
                    "╔══════════════════════════════════════════════════════════╗\n" +
                    "║  ✅ AI Provider connectivity check PASSED               ║\n" +
                    "║  Provider: {}\n" +
                    "║  API Key:  {}\n" +
                    "║  Latency:  {}ms (HTTP {})\n" +
                    "╚══════════════════════════════════════════════════════════╝",
                    r.provider(), r.maskedKey(), r.latencyMs(), r.httpStatus());
        } else {
            log.warn("\n" +
                    "╔══════════════════════════════════════════════════════════╗\n" +
                    "║  ❌ AI Provider connectivity check FAILED               ║\n" +
                    "║  Provider: {}\n" +
                    "║  Error:    {}\n" +
                    "║  The assistant may not work until this is resolved.     ║\n" +
                    "╚══════════════════════════════════════════════════════════╝",
                    r.provider(), r.errorMessage());
        }
    }

    public ConnectivityResult getLastResult() {
        return lastResult;
    }

    private String buildModelsUrl(String baseUrl) {
        String base = baseUrl.endsWith("/") ? baseUrl.substring(0, baseUrl.length() - 1) : baseUrl;
        return base + "/models";
    }

    static String maskApiKey(String key) {
        if (key == null || key.length() <= 8) return "****";
        return key.substring(0, 4) + "****" + key.substring(key.length() - 4);
    }

    public record ConnectivityResult(
            boolean success,
            String provider,
            String maskedKey,
            long latencyMs,
            int httpStatus,
            String errorMessage
    ) {
        static ConnectivityResult success(String provider, String maskedKey, long latencyMs, int httpStatus) {
            return new ConnectivityResult(true, provider, maskedKey, latencyMs, httpStatus, null);
        }

        static ConnectivityResult failure(String provider, String errorMessage) {
            return new ConnectivityResult(false, provider, null, -1, -1, errorMessage);
        }
    }
}
