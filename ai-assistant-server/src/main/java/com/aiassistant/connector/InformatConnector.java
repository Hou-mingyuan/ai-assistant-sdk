package com.aiassistant.connector;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.reactive.function.client.WebClient;

import reactor.util.retry.Retry;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * DataConnector implementation for 织信NEXT (Informat) low-code platform.
 * <p>
 * Calls Informat WebAPI endpoints (configured by the user) that wrap
 * {@code informat.app.moduleTree()}, {@code informat.table.getTableInfo()},
 * and {@code informat.table.queryList()}.
 * <p>
 * Alternatively, when {@code directScriptMode} is enabled, it invokes
 * built-in Informat script functions directly through the API gateway.
 */
public class InformatConnector implements DataConnector {

    private static final Logger log = LoggerFactory.getLogger(InformatConnector.class);

    private final String connectorId;
    private final String displayName;
    private final String baseUrl;
    private final String appId;
    private final String token;
    private final int timeoutSeconds;
    private final WebClient webClient;
    private final ObjectMapper mapper = new ObjectMapper();

    private java.util.Set<String> maskedFields = java.util.Set.of();

    private static final int MAX_RETRIES = 2;
    private static final Duration RETRY_MIN_BACKOFF = Duration.ofMillis(500);
    private static final Duration RETRY_MAX_BACKOFF = Duration.ofSeconds(5);

    private final CircuitBreaker circuitBreaker;
    private final ConcurrentHashMap<String, List<ModuleInfo>> moduleCache = new ConcurrentHashMap<>();
    private volatile long moduleCacheExpiry = 0;
    private static final long CACHE_TTL_MS = 300_000; // 5 min

    public InformatConnector(String connectorId, String displayName,
                             String baseUrl, String appId, String token,
                             int timeoutSeconds) {
        this.connectorId = connectorId != null ? connectorId : "informat";
        this.displayName = displayName != null ? displayName : "织信NEXT";
        Objects.requireNonNull(baseUrl, "baseUrl must not be null");
        this.baseUrl = baseUrl.endsWith("/") ? baseUrl.substring(0, baseUrl.length() - 1) : baseUrl;
        this.appId = appId;
        this.token = token;
        this.timeoutSeconds = Math.max(5, Math.min(timeoutSeconds, 120));
        this.webClient = WebClient.builder()
                .baseUrl(this.baseUrl)
                .defaultHeader("Content-Type", "application/json")
                .build();
        this.circuitBreaker = new CircuitBreaker("informat:" + this.connectorId);
        log.info("InformatConnector initialized: id={}, baseUrl={}, appId={}", this.connectorId, this.baseUrl, appId);
    }

    public void setMaskedFieldNames(java.util.Set<String> fields) {
        this.maskedFields = fields != null ? fields : java.util.Set.of();
    }

    @Override public java.util.Set<String> maskedFieldNames() { return maskedFields; }
    @Override public String id() { return connectorId; }
    @Override public String displayName() { return displayName; }

    @Override
    public List<ModuleInfo> listModules() {
        if (System.currentTimeMillis() < moduleCacheExpiry) {
            List<ModuleInfo> cached = moduleCache.get("modules");
            if (cached != null) return cached;
        }

        String url = "/web0/api/" + appId + "/ai-list-modules" + tokenParam();
        try {
            String body = get(url);
            JsonNode root = mapper.readTree(body);
            JsonNode data = root.isArray() ? root : root.path("data");
            if (!data.isArray()) {
                log.warn("Unexpected response from list-modules: {}", truncate(body, 200));
                return List.of();
            }
            List<ModuleInfo> result = new ArrayList<>();
            for (JsonNode node : data) {
                result.add(new ModuleInfo(
                        node.path("key").asText(node.path("id").asText()),
                        node.path("name").asText(""),
                        node.path("type").asText("Table")
                ));
            }
            moduleCache.put("modules", result);
            moduleCacheExpiry = System.currentTimeMillis() + CACHE_TTL_MS;
            return result;
        } catch (Exception e) {
            log.error("Failed to list modules from Informat: {}", e.getMessage());
            return List.of();
        }
    }

    @Override
    public TableSchema getSchema(String moduleId) {
        String url = "/web0/api/" + appId + "/ai-table-schema?tableId="
                + URLEncoder.encode(moduleId, StandardCharsets.UTF_8) + andToken();
        try {
            String body = get(url);
            JsonNode root = mapper.readTree(body);
            JsonNode tableNode = root.path("table");
            String tableName = tableNode.path("name").asText(moduleId);
            JsonNode fieldsNode = root.path("fields");
            if (!fieldsNode.isArray()) fieldsNode = root.path("tableFieldList");
            List<FieldInfo> fields = new ArrayList<>();
            if (fieldsNode.isArray()) {
                for (JsonNode f : fieldsNode) {
                    fields.add(new FieldInfo(
                            f.path("key").asText(f.path("id").asText()),
                            f.path("name").asText(""),
                            f.path("type").asText("")
                    ));
                }
            }
            return new TableSchema(moduleId, tableName, fields);
        } catch (Exception e) {
            log.error("Failed to get schema for {}: {}", moduleId, e.getMessage());
            return new TableSchema(moduleId, moduleId, List.of());
        }
    }

    @Override
    public QueryResult queryData(String moduleId, QueryFilter filter) {
        String url = "/web0/api/" + appId + "/ai-query-data" + tokenParam();
        try {
            ObjectNode reqBody = mapper.createObjectNode();
            reqBody.put("tableId", moduleId);
            reqBody.put("pageIndex", filter.pageIndex());
            reqBody.put("pageSize", filter.pageSize());

            if (filter.conditions() != null && !filter.conditions().isEmpty()) {
                ObjectNode filterNode = reqBody.putObject("filter");
                ArrayNode condList = filterNode.putArray("conditionList");
                for (QueryFilter.Condition c : filter.conditions()) {
                    ObjectNode cond = condList.addObject();
                    cond.put("fieldId", c.fieldId());
                    cond.put("opt", mapOperator(c.operator()));
                    cond.set("value", mapper.valueToTree(c.value()));
                }
                filterNode.put("opt", "and");
            }

            reqBody.put("returnOptionName", true);

            if (filter.orderByList() != null && !filter.orderByList().isEmpty()) {
                ArrayNode orderBy = reqBody.putArray("orderByList");
                for (QueryFilter.OrderBy ob : filter.orderByList()) {
                    ObjectNode o = orderBy.addObject();
                    o.put("field", ob.fieldId());
                    o.put("type", "desc".equalsIgnoreCase(ob.direction()) ? "desc" : "asc");
                }
            }

            String body = post(url, mapper.writeValueAsString(reqBody));
            JsonNode root = mapper.readTree(body);

            JsonNode records = root.isArray() ? root : root.path("records");
            if (!records.isArray()) records = root.path("data");
            if (!records.isArray()) {
                return new QueryResult(List.of(), 0, filter.pageIndex(), filter.pageSize());
            }

            List<Map<String, Object>> list = new ArrayList<>();
            for (JsonNode rec : records) {
                list.add(mapper.convertValue(rec, new TypeReference<>() {}));
            }

            int total = root.has("total") ? root.path("total").asInt(list.size()) : list.size();
            return new QueryResult(list, total, filter.pageIndex(), filter.pageSize());
        } catch (Exception e) {
            log.error("Failed to query data from {}: {}", moduleId, e.getMessage());
            return new QueryResult(List.of(), 0, filter.pageIndex(), filter.pageSize());
        }
    }

    private String tokenParam() {
        return token != null && !token.isBlank()
                ? "?token=" + URLEncoder.encode(token, StandardCharsets.UTF_8) : "";
    }

    private String andToken() {
        return token != null && !token.isBlank()
                ? "&token=" + URLEncoder.encode(token, StandardCharsets.UTF_8) : "";
    }

    private void checkCircuit(String op) {
        if (!circuitBreaker.allowRequest()) {
            throw new RuntimeException("Circuit breaker OPEN for " + connectorId + " (" + op + "), fast-failing");
        }
    }

    private String get(String path) {
        checkCircuit("GET " + path);
        String result = webClient.get()
                .uri(path)
                .retrieve()
                .onStatus(status -> status.is4xxClientError(),
                        resp -> resp.bodyToMono(String.class)
                                .map(body -> new RuntimeException(
                                        "Informat API " + resp.statusCode() + ": " + truncate(body, 200))))
                .onStatus(status -> status.is5xxServerError(),
                        resp -> resp.bodyToMono(String.class)
                                .map(body -> new RetryableException(
                                        "Informat API " + resp.statusCode() + ": " + truncate(body, 200))))
                .bodyToMono(String.class)
                .retryWhen(retrySpec("GET " + path))
                .block(Duration.ofSeconds(timeoutSeconds));
        if (result == null) {
            circuitBreaker.recordFailure();
            throw new RuntimeException("Empty response from Informat GET " + path);
        }
        circuitBreaker.recordSuccess();
        return result;
    }

    private String post(String path, String jsonBody) {
        checkCircuit("POST " + path);
        String result = webClient.post()
                .uri(path)
                .bodyValue(jsonBody)
                .retrieve()
                .onStatus(status -> status.is4xxClientError(),
                        resp -> resp.bodyToMono(String.class)
                                .map(body -> new RuntimeException(
                                        "Informat API " + resp.statusCode() + ": " + truncate(body, 200))))
                .onStatus(status -> status.is5xxServerError(),
                        resp -> resp.bodyToMono(String.class)
                                .map(body -> new RetryableException(
                                        "Informat API " + resp.statusCode() + ": " + truncate(body, 200))))
                .bodyToMono(String.class)
                .retryWhen(retrySpec("POST " + path))
                .block(Duration.ofSeconds(timeoutSeconds));
        if (result == null) {
            circuitBreaker.recordFailure();
            throw new RuntimeException("Empty response from Informat POST " + path);
        }
        circuitBreaker.recordSuccess();
        return result;
    }

    private Retry retrySpec(String context) {
        return Retry.backoff(MAX_RETRIES, RETRY_MIN_BACKOFF)
                .maxBackoff(RETRY_MAX_BACKOFF)
                .filter(RetryableException::isRetryable)
                .doBeforeRetry(sig -> log.warn("Retry #{} for {}: {}",
                        sig.totalRetries() + 1, context, sig.failure().getMessage()));
    }

    /**
     * Map common operator aliases to Informat's TableRecordConditionOpt.
     */
    private static String mapOperator(String op) {
        if (op == null) return "eq";
        return switch (op.toLowerCase(Locale.ROOT)) {
            case "=", "==", "equals" -> "eq";
            case "!=", "<>", "ne" -> "ne";
            case ">", "gt" -> "gt";
            case ">=", "gte", "ge" -> "ge";
            case "<", "lt" -> "lt";
            case "<=", "lte", "le" -> "le";
            case "like", "contains" -> "contains";
            case "startswith" -> "startswith";
            case "endswith" -> "endswith";
            case "in" -> "in";
            case "isnull" -> "isnull";
            case "isnotnull" -> "isnotnull";
            case "between" -> "between";
            default -> op;
        };
    }

    private static String truncate(String s, int max) {
        return s != null && s.length() > max ? s.substring(0, max) + "…" : s;
    }
}
