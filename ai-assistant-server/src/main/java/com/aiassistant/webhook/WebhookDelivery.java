package com.aiassistant.webhook;

import com.aiassistant.config.AiAssistantProperties;
import com.aiassistant.util.UrlFetchSafety;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Delivers webhook payloads with exponential backoff retry and dead-letter logging.
 */
public class WebhookDelivery {

    private static final Logger log = LoggerFactory.getLogger(WebhookDelivery.class);
    private static final int MAX_RETRIES = 5;
    private static final long INITIAL_DELAY_MS = 1000;

    private final HttpClient httpClient;
    private final ScheduledExecutorService scheduler;
    private final AiAssistantProperties properties;

    public WebhookDelivery() {
        this(new AiAssistantProperties());
    }

    public WebhookDelivery(AiAssistantProperties properties) {
        this.properties = properties != null ? properties : new AiAssistantProperties();
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(10))
                .build();
        this.scheduler = Executors.newScheduledThreadPool(2, r -> {
            Thread t = new Thread(r, "webhook-retry");
            t.setDaemon(true);
            return t;
        });
    }

    /**
     * Deliver a JSON payload to the given URL with retry.
     * Returns a future that completes when delivery succeeds or all retries are exhausted.
     */
    public CompletableFuture<Boolean> deliver(String url, String jsonPayload) {
        CompletableFuture<Boolean> result = new CompletableFuture<>();
        URI uri;
        try {
            uri = validateWebhookUrl(url);
        } catch (Exception e) {
            log.warn("Webhook delivery rejected before retry: url={} error={}", safeUrlForLog(url), e.getMessage());
            result.complete(false);
            return result;
        }
        attemptDelivery(uri, jsonPayload, 0, result);
        return result;
    }

    private URI validateWebhookUrl(String url) {
        if (url == null || url.isBlank()) {
            throw new IllegalArgumentException("webhook url is required");
        }
        URI uri = URI.create(url.trim());
        String scheme = uri.getScheme();
        if (scheme == null || (!"http".equalsIgnoreCase(scheme) && !"https".equalsIgnoreCase(scheme))) {
            throw new IllegalArgumentException("only http(s) webhook urls are supported");
        }
        if (properties.isUrlFetchSsrfProtection()) {
            UrlFetchSafety.validateHttpUrlForServerSideFetch(uri);
        }
        return uri;
    }

    private void attemptDelivery(URI uri, String payload, int attempt, CompletableFuture<Boolean> result) {
        String url = uri.toString();
        try {
            if (properties.isUrlFetchSsrfProtection()) {
                UrlFetchSafety.validateHttpUrlForServerSideFetch(uri);
            }
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(uri)
                    .header("Content-Type", "application/json")
                    .header("X-Webhook-Attempt", String.valueOf(attempt + 1))
                    .POST(HttpRequest.BodyPublishers.ofString(payload))
                    .timeout(Duration.ofSeconds(15))
                    .build();

            httpClient.sendAsync(request, HttpResponse.BodyHandlers.ofString())
                    .thenAccept(response -> {
                        if (response.statusCode() >= 200 && response.statusCode() < 300) {
                            log.debug("Webhook delivered to {} (attempt {})", url, attempt + 1);
                            result.complete(true);
                        } else {
                            handleFailure(url, payload, attempt, result,
                                    "HTTP " + response.statusCode());
                        }
                    })
                    .exceptionally(ex -> {
                        handleFailure(url, payload, attempt, result, ex.getMessage());
                        return null;
                    });
        } catch (IllegalArgumentException e) {
            log.warn("Webhook delivery rejected during retry: url={} error={}", safeUrlForLog(url), e.getMessage());
            result.complete(false);
        } catch (Exception e) {
            handleFailure(url, payload, attempt, result, e.getMessage());
        }
    }

    private void handleFailure(String url, String payload, int attempt,
                                CompletableFuture<Boolean> result, String reason) {
        if (attempt >= MAX_RETRIES - 1) {
            log.error("Webhook dead-letter: all {} attempts failed for {}. Last error: {}",
                    MAX_RETRIES, url, reason);
            result.complete(false);
            return;
        }
        long delay = INITIAL_DELAY_MS * (1L << attempt);
        log.warn("Webhook delivery failed (attempt {}/{}): {}. Retrying in {}ms",
                attempt + 1, MAX_RETRIES, reason, delay);
        scheduler.schedule(
                () -> attemptDelivery(URI.create(url), payload, attempt + 1, result),
                delay, TimeUnit.MILLISECONDS);
    }

    private String safeUrlForLog(String url) {
        if (url == null) {
            return "";
        }
        return url.length() > 160 ? url.substring(0, 160) + "…" : url;
    }

    public void shutdown() {
        scheduler.shutdown();
    }
}
