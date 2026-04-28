package com.aiassistant.webhook;

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

    public WebhookDelivery() {
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
        attemptDelivery(url, jsonPayload, 0, result);
        return result;
    }

    private void attemptDelivery(String url, String payload, int attempt, CompletableFuture<Boolean> result) {
        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
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
                () -> attemptDelivery(url, payload, attempt + 1, result),
                delay, TimeUnit.MILLISECONDS);
    }

    public void shutdown() {
        scheduler.shutdown();
    }
}
