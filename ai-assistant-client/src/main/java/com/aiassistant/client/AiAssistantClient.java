package com.aiassistant.client;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.function.Consumer;

/**
 * Java client SDK for AI Assistant.
 * <pre>{@code
 * var client = AiAssistantClient.builder()
 *     .baseUrl("http://localhost:8080/ai-assistant")
 *     .token("your-token")
 *     .build();
 *
 * String reply = client.chat("Hello!");
 * client.chatStream("Tell me a joke", chunk -> System.out.print(chunk));
 * }</pre>
 */
public class AiAssistantClient {

    private final String baseUrl;
    private final String token;
    private final HttpClient httpClient;
    private final ObjectMapper mapper;
    private final Duration timeout;

    private AiAssistantClient(Builder builder) {
        this.baseUrl = normalizeBaseUrl(builder.baseUrl);
        this.token = normalizeToken(builder.token);
        this.timeout = validateTimeout(builder.timeout);
        this.mapper = new ObjectMapper();
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(10))
                .build();
    }

    public static Builder builder() {
        return new Builder();
    }

    public String chat(String text) throws Exception {
        return chat(text, null, null);
    }

    public String chat(String text, String systemPrompt, String model) throws Exception {
        Map<String, Object> body = new java.util.HashMap<>();
        body.put("text", text);
        body.put("action", "chat");
        if (systemPrompt != null) body.put("systemPrompt", systemPrompt);
        if (model != null) body.put("model", model);

        JsonNode resp = post("/chat", body);
        return readResult(resp);
    }

    public String translate(String text, String targetLang) throws Exception {
        JsonNode resp = post("/chat", Map.of("text", text, "action", "translate",
                "targetLang", targetLang));
        return readResult(resp);
    }

    public String summarize(String text) throws Exception {
        JsonNode resp = post("/chat", Map.of("text", text, "action", "summarize"));
        return readResult(resp);
    }

    public void chatStream(String text, Consumer<String> onChunk) throws Exception {
        chatStream(text, null, null, onChunk);
    }

    public void chatStream(String text, String systemPrompt, String model,
                           Consumer<String> onChunk) throws Exception {
        if (onChunk == null) {
            throw new IllegalArgumentException("onChunk is required");
        }

        Map<String, Object> body = new java.util.HashMap<>();
        body.put("text", text);
        body.put("action", "chat");
        if (systemPrompt != null) body.put("systemPrompt", systemPrompt);
        if (model != null) body.put("model", model);

        HttpRequest request = buildRequest("/stream", body)
                .header("Accept", "text/event-stream")
                .build();

        HttpResponse<java.io.InputStream> response = httpClient.send(request,
                HttpResponse.BodyHandlers.ofInputStream());
        if (response.statusCode() >= 400) {
            String errorBody;
            try (BufferedReader reader = new BufferedReader(
                    new InputStreamReader(response.body(), StandardCharsets.UTF_8))) {
                errorBody = reader.lines().collect(java.util.stream.Collectors.joining("\n"));
            }
            throw new ApiException(response.statusCode(), null,
                    extractErrorMessage(errorBody, "AI Assistant stream API error " + response.statusCode()),
                    errorBody);
        }

        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(response.body(), StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) {
                if (line.startsWith("data:")) {
                    String data = line.substring(5).trim();
                    if ("[DONE]".equals(data)) break;
                    onChunk.accept(data);
                }
            }
        }
    }

    public List<Map<String, Object>> listCapabilities() throws Exception {
        HttpRequest request = buildGet("/capabilities");
        HttpResponse<String> response = httpClient.send(request,
                HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() >= 400) {
            throw apiException(response.statusCode(), response.body());
        }
        return mapper.readValue(response.body(),
                mapper.getTypeFactory().constructCollectionType(List.class, Map.class));
    }

    private JsonNode post(String path, Object body) throws Exception {
        HttpRequest request = buildRequest(path, body).build();
        HttpResponse<String> response = httpClient.send(request,
                HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() >= 400) {
            throw apiException(response.statusCode(), response.body());
        }
        JsonNode root = mapper.readTree(response.body());
        if (root.has("success") && !root.path("success").asBoolean()) {
            throw apiException(response.statusCode(), response.body(), root);
        }
        return root;
    }

    private String readResult(JsonNode resp) {
        return resp.path("result").asText();
    }

    private ApiException apiException(int statusCode, String body) {
        try {
            return apiException(statusCode, body, mapper.readTree(body));
        } catch (Exception ignored) {
            return new ApiException(statusCode, null,
                    "AI Assistant API error " + statusCode + ": " + body, body);
        }
    }

    private ApiException apiException(int statusCode, String body, JsonNode root) {
        String errorCode = root.path("errorCode").asText(null);
        String error = root.path("error").asText(null);
        if (error == null || error.isBlank()) {
            error = "AI Assistant API error " + statusCode;
        }
        return new ApiException(statusCode, errorCode, error, body);
    }

    private static String extractErrorMessage(String body, String fallback) {
        if (body == null || body.isBlank()) {
            return fallback;
        }
        return body;
    }

    private static String normalizeBaseUrl(String baseUrl) {
        if (baseUrl == null) {
            throw new IllegalArgumentException("baseUrl is required");
        }
        String trimmed = baseUrl.trim();
        if (trimmed.isEmpty()) {
            throw new IllegalArgumentException("baseUrl is required");
        }

        URI uri;
        try {
            uri = URI.create(trimmed);
        } catch (IllegalArgumentException ex) {
            throw new IllegalArgumentException("baseUrl must be a valid URI", ex);
        }

        String scheme = uri.getScheme();
        if (!"http".equalsIgnoreCase(scheme) && !"https".equalsIgnoreCase(scheme)) {
            throw new IllegalArgumentException("baseUrl must use http or https");
        }
        if (uri.getHost() == null || uri.getHost().isBlank()) {
            throw new IllegalArgumentException("baseUrl must include a host");
        }

        return trimmed.replaceAll("/+$", "");
    }

    private static String normalizeToken(String token) {
        if (token == null) {
            return null;
        }
        String trimmed = token.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private static Duration validateTimeout(Duration timeout) {
        if (timeout == null) {
            throw new IllegalArgumentException("timeout is required");
        }
        if (timeout.isZero() || timeout.isNegative()) {
            throw new IllegalArgumentException("timeout must be positive");
        }
        return timeout;
    }

    private HttpRequest.Builder buildRequest(String path, Object body) throws Exception {
        HttpRequest.Builder builder = HttpRequest.newBuilder()
                .uri(URI.create(baseUrl + path))
                .header("Content-Type", "application/json")
                .timeout(timeout)
                .POST(HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(body)));
        if (token != null) {
            builder.header("X-AI-Token", token);
        }
        return builder;
    }

    private HttpRequest buildGet(String path) {
        HttpRequest.Builder builder = HttpRequest.newBuilder()
                .uri(URI.create(baseUrl + path))
                .timeout(timeout)
                .GET();
        if (token != null) {
            builder.header("X-AI-Token", token);
        }
        return builder.build();
    }

    public static class Builder {
        private String baseUrl = "http://localhost:8080/ai-assistant";
        private String token;
        private Duration timeout = Duration.ofSeconds(60);

        public Builder baseUrl(String baseUrl) { this.baseUrl = baseUrl; return this; }
        public Builder token(String token) { this.token = token; return this; }
        public Builder timeout(Duration timeout) { this.timeout = timeout; return this; }

        public AiAssistantClient build() {
            return new AiAssistantClient(this);
        }
    }

    public static class ApiException extends RuntimeException {
        private final int statusCode;
        private final String errorCode;
        private final String responseBody;

        public ApiException(int statusCode, String errorCode, String message, String responseBody) {
            super(message);
            this.statusCode = statusCode;
            this.errorCode = errorCode;
            this.responseBody = responseBody;
        }

        public int statusCode() { return statusCode; }
        public String errorCode() { return errorCode; }
        public String responseBody() { return responseBody; }
    }
}
