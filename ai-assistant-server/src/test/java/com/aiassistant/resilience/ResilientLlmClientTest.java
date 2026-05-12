package com.aiassistant.resilience;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.github.resilience4j.circuitbreaker.CallNotPermittedException;
import io.github.resilience4j.circuitbreaker.CircuitBreaker;
import java.time.Duration;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;

/**
 * Unit-tests the resilience4j wiring used by {@link ResilientLlmClient}.
 *
 * <p>Round-3 upgraded resilience4j to 2.2.0 which tightened {@code RetryConfig.Builder} to reject
 * configurations that set both {@code waitDuration} and {@code intervalFunction}. The pre-fix
 * constructor combined them, so the class would throw an {@link IllegalStateException} the very
 * first time anyone instantiated it (including via auto-configuration). These tests lock in the
 * fix and exercise the retry-on-retryable / no-retry-on-fatal / circuit-breaker-trips axes that
 * matter to the LLM call path.
 */
class ResilientLlmClientTest {

    @Test
    void defaultConstructorBuildsClientWithoutResilience4jSanityFailure() {
        ResilientLlmClient client = new ResilientLlmClient();

        assertThat(client.getRetry()).isNotNull();
        assertThat(client.getCircuitBreaker()).isNotNull();
        assertThat(client.getCircuitBreaker().getState()).isEqualTo(CircuitBreaker.State.CLOSED);
    }

    @Test
    void retriesOnRetryableExceptionUpToMaxAttempts() {
        ResilientLlmClient client =
                new ResilientLlmClient(3, Duration.ofMillis(1), 50, Duration.ofSeconds(30));
        AtomicInteger calls = new AtomicInteger();

        assertThatThrownBy(
                        () ->
                                client.execute(
                                        () -> {
                                            calls.incrementAndGet();
                                            throw new RuntimeException("HTTP 503 service busy");
                                        }))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("503");

        /* maxAttempts in resilience4j counts the original call + retries, so 3 attempts total. */
        assertThat(calls.get()).isEqualTo(3);
    }

    @Test
    void doesNotRetryOnNonRetryableException() {
        ResilientLlmClient client =
                new ResilientLlmClient(3, Duration.ofMillis(1), 50, Duration.ofSeconds(30));
        AtomicInteger calls = new AtomicInteger();

        assertThatThrownBy(
                        () ->
                                client.execute(
                                        () -> {
                                            calls.incrementAndGet();
                                            throw new RuntimeException(
                                                    "HTTP 400: malformed prompt");
                                        }))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("400");

        /* 400 is not retryable per ResilientLlmClient.isRetryable, so exactly one attempt. */
        assertThat(calls.get()).isEqualTo(1);
    }

    @Test
    void executeWithFallbackRunsFallbackAfterFailure() {
        ResilientLlmClient client =
                new ResilientLlmClient(2, Duration.ofMillis(1), 50, Duration.ofSeconds(30));

        String result =
                client.executeWithFallback(
                        () -> {
                            throw new RuntimeException("HTTP 429 rate limited");
                        },
                        () -> "fallback");

        assertThat(result).isEqualTo("fallback");
    }

    @Test
    void circuitBreakerOpensAfterSustainedFailures() throws Exception {
        ResilientLlmClient client =
                new ResilientLlmClient(1, Duration.ofMillis(1), 50, Duration.ofSeconds(30));

        /* The CircuitBreaker is configured with minimumNumberOfCalls=5 and a 50% failure-rate
         * threshold; ten consecutive failures will trip it from CLOSED -> OPEN. */
        for (int i = 0; i < 10; i++) {
            try {
                client.execute(
                        () -> {
                            throw new RuntimeException("HTTP 503");
                        });
            } catch (RuntimeException ignored) {
                /* expected — we are deliberately driving failures */
            }
        }

        assertThat(client.getCircuitBreaker().getState()).isEqualTo(CircuitBreaker.State.OPEN);

        /* Once OPEN, the breaker should short-circuit further calls without invoking the
         * supplier. resilience4j surfaces this as CallNotPermittedException. */
        assertThatThrownBy(() -> client.execute(() -> "should not be invoked"))
                .isInstanceOf(CallNotPermittedException.class);
    }
}
