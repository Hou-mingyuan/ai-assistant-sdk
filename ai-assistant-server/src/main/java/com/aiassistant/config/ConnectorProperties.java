package com.aiassistant.config;

/**
 * Configuration for a single data connector instance.
 * <p>YAML example:</p>
 * <pre>
 * ai-assistant:
 *   connectors:
 *     - type: informat
 *       id: erp
 *       display-name: 生产管理系统
 *       base-url: https://your-informat.com
 *       app-id: croe0zft168y3
 *       token: your-api-token
 *       timeout-seconds: 30
 * </pre>
 */
public class ConnectorProperties {

    /** Connector type: "informat", "jdbc", "rest". */
    private String type = "informat";
    /** Unique connector instance id (defaults to type). */
    private String id;
    /** Human-readable name shown to the LLM. */
    private String displayName;
    /** Base URL for the data source API (informat / rest). */
    private String baseUrl;
    /** Application ID (for Informat-type connectors). */
    private String appId;
    /** Authentication token for the data source (informat / rest). */
    private String token;
    /** Request timeout in seconds. */
    private int timeoutSeconds = 30;
    /** Restrict exposed tables (jdbc), comma-separated. Empty = all. */
    private String tables;
    /** Database schema to inspect (jdbc). Null = default. */
    private String schema;
    /** Extra headers as key=value pairs, comma-separated (rest). */
    private String headers;
    /** Sensitive field names to mask before sending to LLM, comma-separated. */
    private String maskedFields;

    public String getType() { return type; }
    public void setType(String type) { this.type = type; }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getDisplayName() { return displayName; }
    public void setDisplayName(String displayName) { this.displayName = displayName; }

    public String getBaseUrl() { return baseUrl; }
    public void setBaseUrl(String baseUrl) { this.baseUrl = baseUrl; }

    public String getAppId() { return appId; }
    public void setAppId(String appId) { this.appId = appId; }

    public String getToken() { return token; }
    public void setToken(String token) { this.token = token; }

    public int getTimeoutSeconds() { return timeoutSeconds; }
    public void setTimeoutSeconds(int timeoutSeconds) { this.timeoutSeconds = timeoutSeconds; }

    public String getTables() { return tables; }
    public void setTables(String tables) { this.tables = tables; }

    public String getSchema() { return schema; }
    public void setSchema(String schema) { this.schema = schema; }

    public String getHeaders() { return headers; }
    public void setHeaders(String headers) { this.headers = headers; }

    public String getMaskedFields() { return maskedFields; }
    public void setMaskedFields(String maskedFields) { this.maskedFields = maskedFields; }

    public java.util.Set<String> resolveMaskedFields() {
        if (maskedFields == null || maskedFields.isBlank()) return java.util.Set.of();
        java.util.Set<String> set = new java.util.LinkedHashSet<>();
        for (String f : maskedFields.split(",")) {
            String trimmed = f.trim().toLowerCase(java.util.Locale.ROOT);
            if (!trimmed.isEmpty()) set.add(trimmed);
        }
        return java.util.Set.copyOf(set);
    }

    public java.util.Set<String> resolveAllowedTables() {
        if (tables == null || tables.isBlank()) return java.util.Set.of();
        java.util.Set<String> set = new java.util.LinkedHashSet<>();
        for (String t : tables.split(",")) {
            String trimmed = t.trim();
            if (!trimmed.isEmpty()) set.add(trimmed);
        }
        return set;
    }

    public java.util.Map<String, String> resolveHeaders() {
        if (headers == null || headers.isBlank()) return java.util.Map.of();
        java.util.Map<String, String> map = new java.util.LinkedHashMap<>();
        for (String pair : headers.split(",")) {
            int eq = pair.indexOf('=');
            if (eq > 0) {
                map.put(pair.substring(0, eq).trim(), pair.substring(eq + 1).trim());
            }
        }
        return map;
    }

    public String resolveId() {
        return id != null && !id.isBlank() ? id : type;
    }

    public String resolveDisplayName() {
        if (displayName != null && !displayName.isBlank()) return displayName;
        return switch (type) {
            case "informat" -> "织信NEXT";
            default -> type;
        };
    }
}
