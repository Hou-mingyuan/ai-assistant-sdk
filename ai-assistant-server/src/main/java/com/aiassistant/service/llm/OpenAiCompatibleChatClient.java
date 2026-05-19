package com.aiassistant.service.llm;

import com.aiassistant.config.AiAssistantProperties;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import io.netty.channel.ChannelOption;
import java.io.IOException;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.TimeoutException;
import java.util.concurrent.atomic.AtomicBoolean;
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
import reactor.netty.http.client.HttpClient;
import reactor.netty.resources.ConnectionProvider;
import reactor.util.retry.Retry;

public class OpenAiCompatibleChatClient
        implements ChatCompletionClient, org.springframework.beans.factory.DisposableBean {

    private static final Logger log = LoggerFactory.getLogger(OpenAiCompatibleChatClient.class);

    private final AiAssistantProperties properties;
    private final ObjectMapper mapper = new ObjectMapper();
    private final Duration timeout;
    private final int maxRetries;
    private final ConnectionProvider connectionProvider;
    private final ReactorClientHttpConnector clientConnector;
    private final ExchangeStrategies exchangeStrategies;

    public OpenAiCompatibleChatClient(AiAssistantProperties properties) {
        this.properties = properties;
        this.timeout =
                Duration.ofSeconds(Math.max(1, Math.min(properties.getTimeoutSeconds(), 600)));
        this.maxRetries = Math.max(0, Math.min(5, properties.getLlmMaxRetries()));
        int codecBytes =
                Math.min(
                        32 * 1024 * 1024,
                        Math.max(4 * 1024 * 1024, properties.getChatMaxTotalChars() * 4));
        this.exchangeStrategies =
                ExchangeStrategies.builder()
                        .codecs(c -> c.defaultCodecs().maxInMemorySize(codecBytes))
                        .build();
        int connectMs = Math.min(60_000, Math.max(5_000, properties.getTimeoutSeconds() * 250));
        this.connectionProvider =
                ConnectionProvider.builder("llm-chat-completions")
                        .maxConnections(64)
                        .pendingAcquireMaxCount(256)
                        .build();
        HttpClient reactorHttpClient =
                HttpClient.create(connectionProvider)
                        .option(ChannelOption.CONNECT_TIMEOUT_MILLIS, connectMs);
        this.clientConnector = new ReactorClientHttpConnector(reactorHttpClient);
    }

    @Override
    public void destroy() {
        connectionProvider.dispose();
        log.debug("LLM ConnectionProvider disposed");
    }

    private WebClient webClient() {
        return webClient(properties.resolveBaseUrl());
    }

    private WebClient minimaxVisionWebClient() {
        return webClient(properties.resolveMinimaxVlmBaseUrl());
    }

    private WebClient webClient(String baseUrl) {
        String base = baseUrl;
        if (base.endsWith("/")) {
            base = base.substring(0, base.length() - 1);
        }
        return WebClient.builder()
                .baseUrl(base)
                .clientConnector(clientConnector)
                .exchangeStrategies(exchangeStrategies)
                .defaultHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                .build();
    }

    @Override
    public String completeRaw(ObjectNode requestBody, String apiKey) {
        for (int attempt = 0; ; attempt++) {
            try {
                String body =
                        webClient()
                                .post()
                                .uri("/chat/completions")
                                .header(HttpHeaders.AUTHORIZATION, "Bearer " + apiKey)
                                .bodyValue(requestBody)
                                .retrieve()
                                .bodyToMono(String.class)
                                .timeout(timeout)
                                .subscribeOn(reactor.core.scheduler.Schedulers.boundedElastic())
                                .block();
                return body != null ? body : "";
            } catch (IllegalStateException e) {
                throw e;
            } catch (WebClientResponseException e) {
                int code = e.getStatusCode().value();
                log.warn(
                        "chat completion raw HTTP {} (try {}/{})",
                        code,
                        attempt + 1,
                        maxRetries + 1);
                if (attempt < maxRetries && isRetriableStatus(code)) {
                    sleepBackoff(attempt);
                    continue;
                }
                throw new IllegalStateException("LLM error: HTTP " + code, e);
            } catch (Exception e) {
                if (attempt < maxRetries && isRetriableNetwork(e)) {
                    sleepBackoff(attempt);
                    continue;
                }
                throw new IllegalStateException("LLM request failed: " + e.getMessage(), e);
            }
        }
    }

    @Override
    public String complete(ObjectNode requestBody, String apiKey) {
        if (shouldUseMinimaxVision(requestBody)) {
            return completeMinimaxVision(requestBody, apiKey);
        }
        for (int attempt = 0; ; attempt++) {
            try {
                String body =
                        webClient()
                                .post()
                                .uri("/chat/completions")
                                .header(HttpHeaders.AUTHORIZATION, "Bearer " + apiKey)
                                .bodyValue(requestBody)
                                .retrieve()
                                .bodyToMono(String.class)
                                .timeout(timeout)
                                .subscribeOn(reactor.core.scheduler.Schedulers.boundedElastic())
                                .block();
                return parseNonStreamContent(body);
            } catch (IllegalStateException e) {
                throw e;
            } catch (WebClientResponseException e) {
                int code = e.getStatusCode().value();
                log.warn(
                        "chat completion HTTP {} (try {}/{}): {}",
                        code,
                        attempt + 1,
                        maxRetries + 1,
                        truncateForLog(e.getResponseBodyAsString()));
                if (attempt < maxRetries && isRetriableStatus(code)) {
                    sleepBackoff(attempt);
                    continue;
                }
                throw new IllegalStateException("LLM error: HTTP " + code, e);
            } catch (Exception e) {
                if (attempt < maxRetries && isRetriableNetwork(e)) {
                    log.warn(
                            "chat completion transient error (try {}/{}): {}",
                            attempt + 1,
                            maxRetries + 1,
                            e.toString());
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
        if (shouldUseMinimaxVision(requestBody)) {
            return Flux.defer(() -> Flux.just(completeMinimaxVision(requestBody, apiKey)));
        }
        return Flux.defer(
                () -> {
                    AtomicBoolean emittedChunk = new AtomicBoolean(false);
                    Flux<String> lines =
                            streamEventLines(requestBody, apiKey)
                                    .doOnNext(
                                            s -> {
                                                if (s != null && !s.isBlank()) {
                                                    emittedChunk.set(true);
                                                }
                                            })
                                    .timeout(timeout);
                    if (maxRetries <= 0) {
                        return lines;
                    }
                    return lines.retryWhen(
                            Retry.backoff(maxRetries, Duration.ofMillis(200))
                                    .maxBackoff(Duration.ofSeconds(10))
                                    .filter(
                                            err ->
                                                    !emittedChunk.get()
                                                            && isRetriableStreamError(
                                                                    Exceptions.unwrap(err)))
                                    .jitter(0.1)
                                    .doBeforeRetry(
                                            sig ->
                                                    log.warn(
                                                            "LLM stream retry (no text chunks yet): {}",
                                                            sig.failure())));
                });
    }

    private Flux<String> streamEventLines(ObjectNode requestBody, String apiKey) {
        return webClient()
                .post()
                .uri("/chat/completions")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + apiKey)
                .accept(MediaType.TEXT_EVENT_STREAM)
                .bodyValue(requestBody)
                .retrieve()
                .bodyToFlux(new ParameterizedTypeReference<ServerSentEvent<String>>() {})
                .flatMapSequential(
                        evt -> {
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

    private boolean shouldUseMinimaxVision(ObjectNode requestBody) {
        return "minimax".equalsIgnoreCase(properties.getProvider())
                && !firstImageUrl(requestBody).isBlank();
    }

    private String completeMinimaxVision(ObjectNode requestBody, String apiKey) {
        List<String> imageUrls = imageUrls(requestBody);
        if (imageUrls.size() <= 1) {
            return completeMinimaxVisionImage(firstUserText(requestBody), imageUrls.get(0), apiKey);
        }
        String prompt = firstUserText(requestBody);
        List<String> results = new ArrayList<>(imageUrls.size());
        for (int i = 0; i < imageUrls.size(); i++) {
            String imagePrompt = prompt + "\n\nImage " + (i + 1) + " of " + imageUrls.size() + ".";
            String content = completeMinimaxVisionImage(imagePrompt, imageUrls.get(i), apiKey);
            results.add("Image " + (i + 1) + ":\n" + content);
        }
        return String.join("\n\n", results);
    }

    private String completeMinimaxVisionImage(String prompt, String imageUrl, String apiKey) {
        ObjectNode vlmBody = mapper.createObjectNode();
        vlmBody.put("prompt", prompt);
        vlmBody.put("image_url", imageUrl);
        try {
            String body =
                    minimaxVisionWebClient()
                            .post()
                            .uri("/coding_plan/vlm")
                            .header(HttpHeaders.AUTHORIZATION, "Bearer " + apiKey)
                            .bodyValue(vlmBody)
                            .retrieve()
                            .bodyToMono(String.class)
                            .timeout(timeout)
                            .subscribeOn(reactor.core.scheduler.Schedulers.boundedElastic())
                            .block();
            return parseMinimaxVisionContent(body);
        } catch (WebClientResponseException e) {
            throw new IllegalStateException(
                    "MiniMax VLM error: HTTP " + e.getStatusCode().value(), e);
        } catch (Exception e) {
            if (e instanceof IllegalStateException ise) {
                throw ise;
            }
            throw new IllegalStateException("MiniMax VLM request failed: " + e.getMessage(), e);
        }
    }

    private String parseMinimaxVisionContent(String json) throws Exception {
        if (json == null || json.isBlank()) {
            throw new IllegalStateException("MiniMax VLM returned empty content");
        }
        JsonNode root = mapper.readTree(json);
        JsonNode err = root.path("error");
        if (err.isObject() && err.has("message")) {
            throw new IllegalStateException(err.get("message").asText("MiniMax VLM error"));
        }
        JsonNode baseResp = root.path("base_resp");
        if (baseResp.isObject()
                && baseResp.has("status_code")
                && baseResp.path("status_code").asInt(0) != 0) {
            throw new IllegalStateException(
                    baseResp.path("status_msg").asText("MiniMax VLM error"));
        }
        String content = firstContentText(root);
        if (content.isBlank()) {
            throw new IllegalStateException("MiniMax VLM returned empty content");
        }
        return content;
    }

    private String firstContentText(JsonNode root) {
        String direct = firstText(root, "content", "output", "text", "result");
        if (!direct.isBlank()) return direct;
        JsonNode choices = root.path("choices");
        if (choices.isArray() && choices.size() > 0) {
            JsonNode message = choices.get(0).path("message");
            String choiceContent = firstText(message, "content");
            if (!choiceContent.isBlank()) return choiceContent;
        }
        return "";
    }

    private String firstUserText(ObjectNode requestBody) {
        JsonNode messages = requestBody.path("messages");
        if (!messages.isArray()) return "";
        for (int i = messages.size() - 1; i >= 0; i--) {
            JsonNode msg = messages.get(i);
            if (!"user".equals(msg.path("role").asText())) continue;
            JsonNode content = msg.path("content");
            if (content.isTextual()) return content.asText("");
            if (content.isArray()) {
                for (JsonNode part : content) {
                    if ("text".equals(part.path("type").asText()) && part.hasNonNull("text")) {
                        return part.get("text").asText("");
                    }
                }
            }
        }
        return "";
    }

    private String firstImageUrl(ObjectNode requestBody) {
        JsonNode messages = requestBody.path("messages");
        if (!messages.isArray()) return "";
        for (JsonNode msg : messages) {
            JsonNode content = msg.path("content");
            if (!content.isArray()) continue;
            for (JsonNode part : content) {
                if (!"image_url".equals(part.path("type").asText())) continue;
                String url = part.path("image_url").path("url").asText("");
                if (!url.isBlank()) return url;
            }
        }
        return "";
    }

    private List<String> imageUrls(ObjectNode requestBody) {
        JsonNode messages = requestBody.path("messages");
        if (!messages.isArray()) return List.of();
        List<String> urls = new ArrayList<>();
        for (JsonNode msg : messages) {
            JsonNode content = msg.path("content");
            if (!content.isArray()) continue;
            for (JsonNode part : content) {
                if (!"image_url".equals(part.path("type").asText())) continue;
                String url = part.path("image_url").path("url").asText("");
                if (!url.isBlank()) urls.add(url);
            }
        }
        return List.copyOf(urls);
    }

    private List<String> parseStreamDeltas(String dataLine) {
        List<String> out = new ArrayList<>();
        try {
            JsonNode root = mapper.readTree(dataLine);
            JsonNode choices = root.path("choices");
            if (choices.isArray() && choices.size() > 0) {
                JsonNode delta = choices.get(0).path("delta");
                String reasoning = firstText(delta, "reasoning_content", "reasoningContent");
                if (!reasoning.isEmpty()) {
                    out.add("<think>" + reasoning + "</think>");
                }
                if (delta.hasNonNull("content")) {
                    out.add(delta.get("content").asText(""));
                }
            }
        } catch (Exception e) {
            log.trace("skip sse line: {}", e.toString());
        }
        return out;
    }

    private String firstText(JsonNode node, String... fields) {
        for (String field : fields) {
            if (node.hasNonNull(field)) {
                return node.get(field).asText("");
            }
        }
        return "";
    }
}
