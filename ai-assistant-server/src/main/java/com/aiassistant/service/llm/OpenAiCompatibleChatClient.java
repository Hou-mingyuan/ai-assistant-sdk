package com.aiassistant.service.llm;

import com.aiassistant.config.AiAssistantProperties;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.client.reactive.ReactorClientHttpConnector;
import org.springframework.http.codec.ServerSentEvent;
import org.springframework.web.reactive.function.client.ExchangeStrategies;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientRequestException;
import org.springframework.web.reactive.function.client.WebClientResponseException;
import reactor.core.Exceptions;
import reactor.core.publisher.Flux;
import reactor.util.retry.Retry;
import com.fasterxml.jackson.databind.node.ObjectNode;
import io.netty.channel.ChannelOption;
import reactor.netty.http.client.HttpClient;
import reactor.netty.resources.ConnectionProvider;

import java.io.IOException;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.TimeoutException;
import java.util.concurrent.atomic.AtomicBoolean;

public class OpenAiCompatibleChatClient implements ChatCompletionClient {

    private static final Logger log = LoggerFactory.getLogger(OpenAiCompatibleChatClient.class);

    private final ObjectMapper mapper = new ObjectMapper();
    private final WebClient webClient;
    private final Duration timeout;
    private final int maxRetries;

    public OpenAiCompatibleChatClient(AiAssistantProperties properties) {
        String base = properties.resolveBaseUrl();
        if (base.endsWith("/")) {
            base = base.substring(0, base.length() - 1);
        }
        this.timeout = Duration.ofSeconds(Math.max(1, Math.min(properties.getTimeoutSeconds(), 600)));
        this.maxRetries = Math.max(0, Math.min(5, properties.getLlmMaxRetries()));
        int codecBytes = Math.min(32 * 1024 * 1024, Math.max(4 * 1024 * 1024, properties.getChatMaxTotalChars() * 4));
        ExchangeStrategies strategies = ExchangeStrategies.builder()
                .codecs(c -> c.defaultCodecs().maxInMemorySize(codecBytes))
                .build();
        int connectMs = Math.min(60_000, Math.max(5_000, properties.getTimeoutSeconds() * 250));
        ConnectionProvider provider = ConnectionProvider.builder("llm-chat-completions")
                .maxConnections(64)
                .pendingAcquireMaxCount(256)
                .build();
        HttpClient reactorHttpClient = HttpClient.create(provider)
                .option(ChannelOption.CONNECT_TIMEOUT_MILLIS, connectMs);
        this.webClient = WebClient.builder()
                .baseUrl(base)
                .clientConnector(new ReactorClientHttpConnector(reactorHttpClient))
                .exchangeStrategies(strategies)
                .defaultHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                .build();
    }

    @Override
    public String complete(ObjectNode requestBody, String apiKey) {
        for (int attempt = 0; ; attempt++) {
            try {
                String body = webClient.post()
                        .uri("/chat/completions")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + apiKey)
                        .bodyValue(requestBody)
                        .retrieve()
                        .bodyToMono(String.class)
                        .timeout(timeout)
                        .block();
                return parseNonStreamContent(body);
            } catch (IllegalStateException e) {
                throw e;
            } catch (WebClientResponseException e) {
                int code = e.getStatusCode().value();
                log.warn("chat completion HTTP {} (try {}/{}): {}",
                        code, attempt + 1, maxRetries + 1, truncateForLog(e.getResponseBodyAsString()));
                if (attempt < maxRetries && isRetriableStatus(code)) {
                    sleepBackoff(attempt);
                    continue;
                }
                throw new IllegalStateException("LLM error: HTTP " + code, e);
            } catch (Exception e) {
                if (attempt < maxRetries && isRetriableNetwork(e)) {
                    log.warn("chat completion transient error (try {}/{}): {}",
                            attempt + 1, maxRetries + 1, e.toString());
                    sleepBackoff(attempt);
                    continue;
                }
                throw new IllegalStateException("LLM request failed: " + e.getMessage(), e);
            }
        }
    }

    private static boolean isRetriableStatus(int code) {
        return code == 408 || code == 429 || code == 502 || code == 503 || code == 504;
    }

    private static boolean isRetriableNetwork(Throwable e) {
        for (Throwable c = e; c != null; c = c.getCause()) {
            if (c instanceof WebClientRequestException || c instanceof TimeoutException) {
                return true;
            }
            if (c instanceof IOException) {
                return true;
            }
        }
        return false;
    }

    private void sleepBackoff(int zeroBasedAttempt) {
        try {
            long ms = Math.min(10_000L, 200L * (1L << zeroBasedAttempt));
            Thread.sleep(ms);
        } catch (InterruptedException ie) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("LLM retry interrupted", ie);
        }
    }

    private static String truncateForLog(String s) {
        if (s == null) {
            return "";
        }
        String t = s.replace('\n', ' ').trim();
        return t.length() > 500 ? t.substring(0, 500) + "…" : t;
    }

    @Override
    public Flux<String> completeStream(ObjectNode requestBody, String apiKey) {
        return Flux.defer(() -> {
            AtomicBoolean emittedChunk = new AtomicBoolean(false);
            Flux<String> lines = streamEventLines(requestBody, apiKey)
                    .doOnNext(s -> {
                        if (s != null && !s.isBlank()) {
                            emittedChunk.set(true);
                        }
                    })
                    .timeout(timeout);
            if (maxRetries <= 0) {
                return lines;
            }
            return lines.retryWhen(Retry.backoff(maxRetries, Duration.ofMillis(200))
                    .maxBackoff(Duration.ofSeconds(10))
                    .filter(err -> !emittedChunk.get() && isRetriableStreamError(Exceptions.unwrap(err)))
                    .jitter(0.1)
                    .doBeforeRetry(sig -> log.warn("LLM stream retry (no text chunks yet): {}", sig.failure())));
        }).onErrorResume(e -> Flux.just("Error: " + e.getMessage()));
    }

    private Flux<String> streamEventLines(ObjectNode requestBody, String apiKey) {
        return webClient.post()
                .uri("/chat/completions")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + apiKey)
                .accept(MediaType.TEXT_EVENT_STREAM)
                .bodyValue(requestBody)
                .retrieve()
                .bodyToFlux(new ParameterizedTypeReference<ServerSentEvent<String>>() {
                })
                .flatMapSequential(evt -> {
                    String data = evt.data();
                    if (data == null || data.isBlank() || "[DONE]".equals(data.strip())) {
                        return Flux.empty();
                    }
                    List<String> deltas = parseStreamDeltas(data);
                    return Flux.fromIterable(deltas);
                });
    }

    private boolean isRetriableStreamError(Throwable e) {
        if (e instanceof WebClientResponseException w) {
            return isRetriableStatus(w.getStatusCode().value());
        }
        return isRetriableNetwork(e);
    }

    private String parseNonStreamContent(String json) throws Exception {
        if (json == null || json.isBlank()) {
            return "";
        }
        JsonNode root = mapper.readTree(json);
        JsonNode choices = root.path("choices");
        if (choices.isArray() && choices.size() > 0) {
            JsonNode msg = choices.get(0).path("message");
            if (msg.hasNonNull("content")) {
                return msg.get("content").asText("");
            }
        }
        JsonNode err = root.path("error");
        if (err.isObject() && err.has("message")) {
            throw new IllegalStateException(err.get("message").asText("LLM error"));
        }
        throw new IllegalStateException("Unexpected LLM response shape");
    }

    private List<String> parseStreamDeltas(String dataLine) {
        List<String> out = new ArrayList<>();
        try {
            JsonNode root = mapper.readTree(dataLine);
            JsonNode choices = root.path("choices");
            if (choices.isArray() && choices.size() > 0) {
                JsonNode delta = choices.get(0).path("delta");
                if (delta.hasNonNull("content")) {
                    out.add(delta.get("content").asText(""));
                }
            }
        } catch (Exception e) {
            log.trace("skip sse line: {}", e.toString());
        }
        return out;
    }
}
