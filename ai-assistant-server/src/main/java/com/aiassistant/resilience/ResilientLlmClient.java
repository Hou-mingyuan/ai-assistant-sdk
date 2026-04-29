package com.aiassistant.resilience;

import io.github.resilience4j.circuitbreaker.CircuitBreaker;
import io.github.resilience4j.circuitbreaker.CircuitBreakerConfig;
import io.github.resilience4j.retry.Retry;
import io.github.resilience4j.retry.RetryConfig;
import java.time.Duration;
import java.util.function.Supplier;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Wraps LLM API calls with Resilience4j retry (exponential backoff) and circuit breaker. Usage:
 * wrap any LLM supplier with {@code execute()} for automatic retry + fallback.
 */
public class ResilientLlmClient {

    private static final Logger log = LoggerFactory.getLogger(ResilientLlmClient.class);

    private final Retry retry;
    private final CircuitBreaker circuitBreaker;

    public ResilientLlmClient() {
        this(3, Duration.ofSeconds(2), 50, Duration.ofSeconds(30));
    }

    public ResilientLlmClient(
            int maxRetries,
            Duration waitDuration,
            int failureRateThreshold,
            Duration circuitBreakerWait) {
        this.retry =
                Retry.of(
                        "llm-retry",
                        RetryConfig.custom()
                                .maxAttempts(maxRetries)
                                .waitDuration(waitDuration)
                                .intervalFunction(
                                        attempt -> waitDuration.toMillis() * (1L << (attempt - 1)))
                                .retryOnException(this::isRetryable)
                                .build());

        this.circuitBreaker =
                CircuitBreaker.of(
                        "llm-circuit",
                        CircuitBreakerConfig.custom()
                                .failureRateThreshold(failureRateThreshold)
                                .waitDurationInOpenState(circuitBreakerWait)
                                .slidingWindowSize(10)
                                .minimumNumberOfCalls(5)
                                .permittedNumberOfCallsInHalfOpenState(3)
                                .build());

        retry.getEventPublisher()
                .onRetry(
                        event ->
                                log.warn(
                                        "LLM call retry #{}: {}",
                                        event.getNumberOfRetryAttempts(),
                                        event.getLastThrowable().getMessage()));

        circuitBreaker
                .getEventPublisher()
                .onStateTransition(
                        event ->
                                log.info(
                                        "LLM circuit breaker: {} -> {}",
                                        event.getStateTransition().getFromState(),
                                        event.getStateTransition().getToState()));
    }

    /** Execute a supplier with retry + circuit breaker protection. */
    public <T> T execute(Supplier<T> supplier) {
        Supplier<T> decorated =
                CircuitBreaker.decorateSupplier(
                        circuitBreaker, Retry.decorateSupplier(retry, supplier));
        return decorated.get();
    }

    /** Execute with a fallback when all retries and circuit breaker fail. */
    public <T> T executeWithFallback(Supplier<T> supplier, Supplier<T> fallback) {
        try {
            return execute(supplier);
        } catch (Exception e) {
            log.warn("LLM call failed after retries, using fallback: {}", e.getMessage());
            return fallback.get();
        }
    }

    public CircuitBreaker getCircuitBreaker() {
        return circuitBreaker;
    }

    public Retry getRetry() {
        return retry;
    }

    private boolean isRetryable(Throwable t) {
        String msg = t.getMessage();
        if (msg == null) return true;
        String lower = msg.toLowerCase(java.util.Locale.ROOT);
        if (lower.contains("rate limit") || lower.contains("429")) return true;
        if (lower.contains("timeout") || lower.contains("timed out")) return true;
        if (lower.contains("502") || lower.contains("503") || lower.contains("504")) return true;
        if (lower.contains("connection") && lower.contains("refused")) return true;
        return false;
    }
}
