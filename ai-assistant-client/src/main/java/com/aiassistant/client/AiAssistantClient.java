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
import java.util.regex.Pattern;

/**
 * Java client SDK for AI Assistant.
 *
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

    private static final Pattern SAFE_TENANT_ID = Pattern.compile("[a-zA-Z0-9_.:-]{1,64}");

    private final String baseUrl;
    private final String token;
    private final String tenantId;
    private final HttpClient httpClient;
    private final ObjectMapper mapper;
    private final Duration timeout;

    private AiAssistantClient(Builder builder) {
        this.baseUrl = normalizeBaseUrl(builder.baseUrl);
        this.token = normalizeToken(builder.token);
        this.tenantId = normalizeTenantId(builder.tenantId);
        this.timeout = validateTimeout(builder.timeout);
        this.mapper = new ObjectMapper();
        this.httpClient = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
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
        JsonNode resp =
                post(
                        "/chat",
                        Map.of("text", text, "action", "translate", "targetLang", targetLang));
        return readResult(resp);
    }

    public String summarize(String text) throws Exception {
        JsonNode resp = post("/chat", Map.of("text", text, "action", "summarize"));
        return readResult(resp);
    }

    public void chatStream(String text, Consumer<String> onChunk) throws Exception {
        chatStream(text, null, null, onChunk);
    }

    public void chatStream(String text, String systemPrompt, String model, Consumer<String> onChunk)
            throws Exception {
        if (onChunk == null) {
            throw new IllegalArgumentException("onChunk is required");
        }

        Map<String, Object> body = new java.util.HashMap<>();
        body.put("text", text);
        body.put("action", "chat");
        if (systemPrompt != null) body.put("systemPrompt", systemPrompt);
        if (model != null) body.put("model", model);

        HttpRequest request =
                buildRequest("/stream", body).header("Accept", "text/event-stream").build();

        HttpResponse<java.io.InputStream> response =
                httpClient.send(request, HttpResponse.BodyHandlers.ofInputStream());
        if (response.statusCode() >= 400) {
            String errorBody;
            try (BufferedReader reader =
                    new BufferedReader(
                            new InputStreamReader(response.body(), StandardCharsets.UTF_8))) {
                errorBody = reader.lines().collect(java.util.stream.Collectors.joining("\n"));
            }
            throw apiException(response.statusCode(), errorBody, response.headers());
        }

        try (BufferedReader reader =
                new BufferedReader(
                        new InputStreamReader(response.body(), StandardCharsets.UTF_8))) {
            String line;
            StringBuilder eventData = new StringBuilder();
            while ((line = reader.readLine()) != null) {
                if (line.isEmpty()) {
                    if (dispatchSseEvent(
                            eventData,
                            onChunk,
                            response.headers().firstValue("X-Request-Id").orElse(null))) {
                        break;
                    }
                    continue;
                }
                if (line.startsWith("data:")) {
                    if (!eventData.isEmpty()) {
                        eventData.append('\n');
                    }
                    eventData.append(parseSseDataLine(line));
                }
            }
            if (!eventData.isEmpty()) {
                dispatchSseEvent(
                        eventData,
                        onChunk,
                        response.headers().firstValue("X-Request-Id").orElse(null));
            }
        }
    }

    public List<Map<String, Object>> listCapabilities() throws Exception {
        HttpRequest request = buildGet("/capabilities");
        HttpResponse<String> response =
                httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() >= 400) {
            throw apiException(response.statusCode(), response.body(), response.headers());
        }
        return mapper.readValue(
                response.body(),
                mapper.getTypeFactory().constructCollectionType(List.class, Map.class));
    }

    private JsonNode post(String path, Object body) throws Exception {
        HttpRequest request = buildRequest(path, body).build();
        HttpResponse<String> response =
                httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() >= 400) {
            throw apiException(response.statusCode(), response.body(), response.headers());
        }
        JsonNode root = mapper.readTree(response.body());
        if (root.has("success") && !root.path("success").asBoolean()) {
            throw apiException(response.statusCode(), response.body(), root, response.headers());
        }
        return root;
    }

    private String readResult(JsonNode resp) {
        return resp.path("result").asText();
    }

    private ApiException apiException(int statusCode, String body) {
        return apiException(statusCode, body, (java.net.http.HttpHeaders) null);
    }

    private ApiException apiException(
            int statusCode, String body, java.net.http.HttpHeaders headers) {
        try {
            return apiException(statusCode, body, mapper.readTree(body), headers);
        } catch (Exception ignored) {
            return new ApiException(
                    statusCode,
                    null,
                    "AI Assistant API error " + statusCode + ": " + body,
                    body,
                    requestId(headers));
        }
    }

    private ApiException apiException(int statusCode, String body, JsonNode root) {
        return apiException(statusCode, body, root, null);
    }

    private ApiException apiException(
            int statusCode, String body, JsonNode root, java.net.http.HttpHeaders headers) {
        String errorCode = root.path("errorCode").asText(null);
        String error = root.path("error").asText(null);
        if (error == null || error.isBlank()) {
            error = "AI Assistant API error " + statusCode;
        }
        return new ApiException(statusCode, errorCode, error, body, requestId(headers));
    }

    private static String requestId(java.net.http.HttpHeaders headers) {
        return headers == null ? null : headers.firstValue("X-Request-Id").orElse(null);
    }

    private static boolean dispatchSseEvent(
            StringBuilder eventData, Consumer<String> onChunk, String requestId) {
        if (eventData.isEmpty()) {
            return false;
        }
        String data = eventData.toString();
        eventData.setLength(0);
        if ("[DONE]".equals(data)) {
            return true;
        }
        if (data.startsWith("[") && data.contains("]")) {
            int markerEnd = data.indexOf(']');
            String code = data.substring(1, markerEnd);
            if (code.endsWith("ERROR")
                    || "RATE_LIMITED".equals(code)
                    || "TIMEOUT".equals(code)
                    || "QUOTA_EXCEEDED".equals(code)
                    || "VALIDATION_ERROR".equals(code)) {
                String message = data.substring(markerEnd + 1).trim();
                throw new ApiException(200, code, message, data, requestId);
            }
        }
        onChunk.accept(data);
        return false;
    }

    private static String parseSseDataLine(String line) {
        String data = line.substring(5);
        return data.startsWith(" ") ? data.substring(1) : data;
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

    private static String normalizeTenantId(String tenantId) {
        if (tenantId == null || tenantId.isBlank()) {
            return null;
        }
        String normalized = tenantId.trim();
        if (!SAFE_TENANT_ID.matcher(normalized).matches()) {
            throw new IllegalArgumentException(
                    "tenantId must be 1-64 characters using letters, digits, _, ., :, or -");
        }
        return normalized;
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
        HttpRequest.Builder builder =
                HttpRequest.newBuilder()
                        .uri(URI.create(baseUrl + path))
                        .header("Content-Type", "application/json")
                        .timeout(timeout)
                        .POST(HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(body)));
        if (token != null) {
            builder.header("X-AI-Token", token);
        }
        if (tenantId != null) {
            builder.header("X-Tenant-Id", tenantId);
        }
        return builder;
    }

    private HttpRequest buildGet(String path) {
        HttpRequest.Builder builder =
                HttpRequest.newBuilder().uri(URI.create(baseUrl + path)).timeout(timeout).GET();
        if (token != null) {
            builder.header("X-AI-Token", token);
        }
        if (tenantId != null) {
            builder.header("X-Tenant-Id", tenantId);
        }
        return builder.build();
    }

    public static class Builder {
        private String baseUrl = "http://localhost:8080/ai-assistant";
        private String token;
        private String tenantId;
        private Duration timeout = Duration.ofSeconds(60);

        public Builder baseUrl(String baseUrl) {
            this.baseUrl = baseUrl;
            return this;
        }

        public Builder token(String token) {
            this.token = token;
            return this;
        }

        public Builder tenantId(String tenantId) {
            this.tenantId = tenantId;
            return this;
        }

        public Builder timeout(Duration timeout) {
            this.timeout = timeout;
            return this;
        }

        public AiAssistantClient build() {
            return new AiAssistantClient(this);
        }
    }

    public static class ApiException extends RuntimeException {
        private final int statusCode;
        private final String errorCode;
        private final String responseBody;
        private final String requestId;

        public ApiException(int statusCode, String errorCode, String message, String responseBody) {
            this(statusCode, errorCode, message, responseBody, null);
        }

        public ApiException(
                int statusCode,
                String errorCode,
                String message,
                String responseBody,
                String requestId) {
            super(message);
            this.statusCode = statusCode;
            this.errorCode = errorCode;
            this.responseBody = responseBody;
            this.requestId = requestId;
        }

        public int statusCode() {
            return statusCode;
        }

        public String errorCode() {
            return errorCode;
        }

        public String responseBody() {
            return responseBody;
        }

        public String requestId() {
            return requestId;
        }
    }
}
