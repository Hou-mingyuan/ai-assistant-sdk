package com.aiassistant.connector;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.reactive.function.client.WebClient;

import reactor.util.retry.Retry;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.*;

/**
 * DataConnector that proxies to a generic REST API.
 * Expects the target API to implement three endpoints:
 * <ul>
 *   <li>{baseUrl}/modules — GET → JSON array of {id, name, type}</li>
 *   <li>{baseUrl}/schema?moduleId=xxx — GET → {moduleId, moduleName, fields: [{id, name, type}]}</li>
 *   <li>{baseUrl}/query — POST → {records: [...], total: N}</li>
 * </ul>
 * The endpoint paths are configurable via constructor.
 */
public class RestApiConnector implements DataConnector {

    private static final Logger log = LoggerFactory.getLogger(RestApiConnector.class);

    private final String connectorId;
    private final String displayName;
    private final String modulesPath;
    private final String schemaPath;
    private final String queryPath;
    private final int timeoutSeconds;
    private final WebClient webClient;
    private final ObjectMapper mapper = new ObjectMapper();

    private java.util.Set<String> maskedFields = java.util.Set.of();
    private final CircuitBreaker circuitBreaker;

    private static final int MAX_RETRIES = 2;
    private static final Duration RETRY_MIN_BACKOFF = Duration.ofMillis(500);
    private static final Duration RETRY_MAX_BACKOFF = Duration.ofSeconds(5);

    /**
     * @param connectorId   unique connector id
     * @param displayName   human label for LLM
     * @param baseUrl       base URL of the REST API
     * @param modulesPath   path to list modules (GET), default "/modules"
     * @param schemaPath    path to get schema (GET with ?moduleId=), default "/schema"
     * @param queryPath     path to query data (POST), default "/query"
     * @param headers       extra headers to send (e.g. auth tokens)
     * @param timeoutSeconds request timeout
     */
    public RestApiConnector(String connectorId, String displayName,
                            String baseUrl, String modulesPath, String schemaPath,
                            String queryPath, Map<String, String> headers,
                            int timeoutSeconds) {
        this.connectorId = connectorId != null ? connectorId : "rest";
        this.displayName = displayName != null ? displayName : "REST API";
        this.modulesPath = modulesPath != null ? modulesPath : "/modules";
        this.schemaPath = schemaPath != null ? schemaPath : "/schema";
        this.queryPath = queryPath != null ? queryPath : "/query";
        this.timeoutSeconds = Math.max(5, Math.min(timeoutSeconds, 120));

        Objects.requireNonNull(baseUrl, "baseUrl must not be null");
        String url = baseUrl.endsWith("/") ? baseUrl.substring(0, baseUrl.length() - 1) : baseUrl;

        WebClient.Builder builder = WebClient.builder()
                .baseUrl(url)
                .defaultHeader("Content-Type", "application/json");
        if (headers != null) {
            headers.forEach(builder::defaultHeader);
        }
        this.webClient = builder.build();
        this.circuitBreaker = new CircuitBreaker("rest:" + this.connectorId);

        log.info("RestApiConnector initialized: id={}, baseUrl={}", this.connectorId, url);
    }

    public void setMaskedFieldNames(java.util.Set<String> fields) {
        this.maskedFields = fields != null ? fields : java.util.Set.of();
    }

    @Override public java.util.Set<String> maskedFieldNames() { return maskedFields; }
    @Override public String id() { return connectorId; }
    @Override public String displayName() { return displayName; }

    @Override
    public List<ModuleInfo> listModules() {
        try {
            String body = get(modulesPath);
            JsonNode root = mapper.readTree(body);
            JsonNode data = root.isArray() ? root : root.path("modules");
            if (!data.isArray()) data = root.path("data");
            if (!data.isArray()) return List.of();

            List<ModuleInfo> result = new ArrayList<>();
            for (JsonNode node : data) {
                result.add(new ModuleInfo(
                        node.path("id").asText(node.path("key").asText("")),
                        node.path("name").asText(""),
                        node.path("type").asText("Table")
                ));
            }
            return result;
        } catch (Exception e) {
            log.error("REST list modules failed: {}", e.getMessage());
            return List.of();
        }
    }

    @Override
    public TableSchema getSchema(String moduleId) {
        try {
            String body = get(schemaPath + "?moduleId=" + URLEncoder.encode(moduleId, StandardCharsets.UTF_8));
            JsonNode root = mapper.readTree(body);
            String moduleName = root.path("moduleName").asText(root.path("name").asText(moduleId));
            JsonNode fieldsNode = root.path("fields");
            if (!fieldsNode.isArray()) return new TableSchema(moduleId, moduleName, List.of());

            List<FieldInfo> fields = new ArrayList<>();
            for (JsonNode f : fieldsNode) {
                fields.add(new FieldInfo(
                        f.path("id").asText(f.path("key").asText("")),
                        f.path("name").asText(""),
                        f.path("type").asText("")
                ));
            }
            return new TableSchema(moduleId, moduleName, fields);
        } catch (Exception e) {
            log.error("REST get schema failed for {}: {}", moduleId, e.getMessage());
            return new TableSchema(moduleId, moduleId, List.of());
        }
    }

    @Override
    public QueryResult queryData(String moduleId, QueryFilter filter) {
        try {
            Map<String, Object> body = new LinkedHashMap<>();
            body.put("moduleId", moduleId);
            body.put("pageIndex", filter.pageIndex());
            body.put("pageSize", filter.pageSize());
            if (filter.conditions() != null && !filter.conditions().isEmpty()) {
                body.put("conditions", filter.conditions().stream()
                        .map(c -> Map.of("fieldId", c.fieldId(), "operator", c.operator(), "value", c.value() != null ? c.value() : ""))
                        .toList());
            }
            if (filter.orderByList() != null && !filter.orderByList().isEmpty()) {
                body.put("orderByList", filter.orderByList().stream()
                        .map(o -> Map.of("fieldId", o.fieldId(), "direction", o.direction()))
                        .toList());
            }

            String response = post(queryPath, mapper.writeValueAsString(body));
            JsonNode root = mapper.readTree(response);
            JsonNode recordsNode = root.path("records");
            if (!recordsNode.isArray()) recordsNode = root.path("data");
            if (!recordsNode.isArray()) {
                return new QueryResult(List.of(), 0, filter.pageIndex(), filter.pageSize());
            }

            List<Map<String, Object>> records = new ArrayList<>();
            for (JsonNode rec : recordsNode) {
                records.add(mapper.convertValue(rec, new TypeReference<>() {}));
            }
            int total = root.has("total") ? root.path("total").asInt(records.size()) : records.size();
            return new QueryResult(records, total, filter.pageIndex(), filter.pageSize());
        } catch (Exception e) {
            log.error("REST query failed for {}: {}", moduleId, e.getMessage());
            return new QueryResult(List.of(), 0, filter.pageIndex(), filter.pageSize());
        }
    }

    private void checkCircuit(String op) {
        if (!circuitBreaker.allowRequest()) {
            throw new RuntimeException("Circuit breaker OPEN for " + connectorId + " (" + op + "), fast-failing");
        }
    }

    private String get(String path) {
        checkCircuit("GET " + path);
        try {
            String result = webClient.get().uri(path)
                    .retrieve()
                    .onStatus(status -> status.is4xxClientError(),
                            resp -> resp.bodyToMono(String.class)
                                    .map(body -> new RuntimeException(
                                            "REST API " + resp.statusCode() + ": " + truncate(body, 200))))
                    .onStatus(status -> status.is5xxServerError(),
                            resp -> resp.bodyToMono(String.class)
                                    .map(body -> new RetryableException(
                                            "REST API " + resp.statusCode() + ": " + truncate(body, 200))))
                    .bodyToMono(String.class)
                    .retryWhen(retrySpec("GET " + path))
                    .block(Duration.ofSeconds(timeoutSeconds));
            if (result == null) throw new RuntimeException("Empty response from REST GET " + path);
            circuitBreaker.recordSuccess();
            return result;
        } catch (Exception e) {
            circuitBreaker.recordFailure();
            throw e;
        }
    }

    private String post(String path, String jsonBody) {
        checkCircuit("POST " + path);
        try {
            String result = webClient.post().uri(path)
                    .bodyValue(jsonBody)
                    .retrieve()
                    .onStatus(status -> status.is4xxClientError(),
                            resp -> resp.bodyToMono(String.class)
                                    .map(body -> new RuntimeException(
                                            "REST API " + resp.statusCode() + ": " + truncate(body, 200))))
                    .onStatus(status -> status.is5xxServerError(),
                            resp -> resp.bodyToMono(String.class)
                                    .map(body -> new RetryableException(
                                            "REST API " + resp.statusCode() + ": " + truncate(body, 200))))
                    .bodyToMono(String.class)
                    .retryWhen(retrySpec("POST " + path))
                    .block(Duration.ofSeconds(timeoutSeconds));
            if (result == null) throw new RuntimeException("Empty response from REST POST " + path);
            circuitBreaker.recordSuccess();
            return result;
        } catch (Exception e) {
            circuitBreaker.recordFailure();
            throw e;
        }
    }

    private Retry retrySpec(String context) {
        return Retry.backoff(MAX_RETRIES, RETRY_MIN_BACKOFF)
                .maxBackoff(RETRY_MAX_BACKOFF)
                .filter(RetryableException::isRetryable)
                .doBeforeRetry(sig -> log.warn("Retry #{} for {}: {}",
                        sig.totalRetries() + 1, context, sig.failure().getMessage()));
    }

    private static String truncate(String s, int max) {
        return (s != null && s.length() > max) ? s.substring(0, max) + "..." : s;
    }
}
