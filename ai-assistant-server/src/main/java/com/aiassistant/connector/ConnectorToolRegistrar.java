package com.aiassistant.connector;

import com.aiassistant.tool.ToolDefinition;
import com.aiassistant.tool.ToolRegistry;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Bridges {@link DataConnector} instances into the {@link ToolRegistry} system. For each connector,
 * registers three Function Calling tools:
 *
 * <ul>
 *   <li>{prefix}_list_modules – discover available modules/tables
 *   <li>{prefix}_get_schema – inspect table structure
 *   <li>{prefix}_query_data – query records with filters
 * </ul>
 */
public class ConnectorToolRegistrar {

    private static final Logger log = LoggerFactory.getLogger(ConnectorToolRegistrar.class);
    private static final ObjectMapper mapper = new ObjectMapper();
    private static final long QUERY_CACHE_TTL_MS = 30_000; // 30 seconds
    private static final int QUERY_CACHE_MAX = 200;

    public static void register(DataConnector connector, ToolRegistry registry) {
        register(connector, registry, "zh");
    }

    public static void register(DataConnector connector, ToolRegistry registry, String locale) {
        String prefix = sanitize(connector.id());
        String label = connector.displayName();
        boolean en = "en".equalsIgnoreCase(locale);

        registry.register(listModulesTool(prefix, label, connector, en));
        registry.register(getSchemaTool(prefix, label, connector, en));
        registry.register(queryDataTool(prefix, label, connector, en));

        int toolCount = 3;
        if (connector.supportsWrite()) {
            registry.register(createRecordTool(prefix, label, connector, en));
            registry.register(updateRecordTool(prefix, label, connector, en));
            registry.register(deleteRecordTool(prefix, label, connector, en));
            toolCount = 6;
        }

        log.info(
                "Registered {} tools for connector '{}' (prefix={}, locale={}, write={})",
                toolCount,
                label,
                prefix,
                locale,
                connector.supportsWrite());
    }

    private static ToolDefinition listModulesTool(
            String prefix, String label, DataConnector connector, boolean en) {
        String name = prefix + "_list_modules";
        String desc =
                en
                        ? "List all available modules/tables in "
                                + label
                                + ". Call this first when the user mentions a business module to find the moduleId."
                        : "列出 " + label + " 中所有可用的数据模块/表。当用户提到某个业务模块时，先调用此工具查找对应的 moduleId。";
        String emptyHint = en ? "No modules found" : "未找到任何模块";

        ObjectNode schema = mapper.createObjectNode();
        schema.put("type", "object");
        schema.putObject("properties");

        return new ToolDefinition() {
            @Override
            public String name() {
                return name;
            }

            @Override
            public String description() {
                return desc;
            }

            @Override
            public JsonNode parametersSchema() {
                return schema;
            }

            @Override
            public String execute(JsonNode arguments) throws Exception {
                List<DataConnector.ModuleInfo> modules = connector.listModules();
                if (modules.isEmpty()) return "{\"modules\":[],\"hint\":\"" + emptyHint + "\"}";
                List<Object> list =
                        modules.stream()
                                .map(
                                        m ->
                                                java.util.Map.of(
                                                        "id", m.id(), "name", m.name(), "type",
                                                        m.type()))
                                .collect(Collectors.toList());
                return mapper.writeValueAsString(
                        java.util.Map.of("modules", list, "total", list.size()));
            }
        };
    }

    private static ToolDefinition getSchemaTool(
            String prefix, String label, DataConnector connector, boolean en) {
        String name = prefix + "_get_schema";
        String desc =
                en
                        ? "Get the field schema (field names, IDs, types) of a specific table in "
                                + label
                                + ". Must be called before query_data to understand the table structure."
                        : "获取 "
                                + label
                                + " 中指定数据表的字段结构（字段名称、标识符、类型）。在查询数据之前必须先调用此工具了解表结构，以便构造正确的过滤条件。";

        ObjectNode schema = mapper.createObjectNode();
        schema.put("type", "object");
        ObjectNode props = schema.putObject("properties");
        ObjectNode moduleIdProp = props.putObject("moduleId");
        moduleIdProp.put("type", "string");
        moduleIdProp.put("description", "数据模块的标识符(key)，通过 list_modules 获取");
        ArrayNode required = schema.putArray("required");
        required.add("moduleId");

        return new ToolDefinition() {
            @Override
            public String name() {
                return name;
            }

            @Override
            public String description() {
                return desc;
            }

            @Override
            public JsonNode parametersSchema() {
                return schema;
            }

            @Override
            public String execute(JsonNode arguments) throws Exception {
                String moduleId = arguments.path("moduleId").asText("");
                if (moduleId.isBlank()) return "{\"error\":\"moduleId is required\"}";
                DataConnector.TableSchema ts = connector.getSchema(moduleId);
                List<Object> fields =
                        ts.fields().stream()
                                .map(
                                        f ->
                                                java.util.Map.of(
                                                        "id", f.id(), "name", f.name(), "type",
                                                        f.type()))
                                .collect(Collectors.toList());
                return mapper.writeValueAsString(
                        java.util.Map.of(
                                "moduleId", ts.moduleId(),
                                "moduleName", ts.moduleName(),
                                "fields", fields));
            }
        };
    }

    private static ToolDefinition queryDataTool(
            String prefix, String label, DataConnector connector, boolean en) {
        String name = prefix + "_query_data";
        String desc =
                en
                        ? "Query records from a table in "
                                + label
                                + ". Supports field filtering (eq, gt, contains, etc.), sorting, and pagination. Use get_schema first to learn the field structure."
                        : "从 "
                                + label
                                + " 的指定数据表中查询记录。支持字段过滤（等于、大于、包含等）、排序和分页。先用 get_schema 获取字段结构，再用正确的 fieldId 构造条件。";

        ObjectNode schema = mapper.createObjectNode();
        schema.put("type", "object");
        ObjectNode props = schema.putObject("properties");

        ObjectNode tblProp = props.putObject("moduleId");
        tblProp.put("type", "string");
        tblProp.put("description", "数据表标识符");

        ObjectNode condsProp = props.putObject("conditions");
        condsProp.put("type", "array");
        condsProp.put("description", "过滤条件列表");
        ObjectNode condItem = condsProp.putObject("items");
        condItem.put("type", "object");
        ObjectNode condProps = condItem.putObject("properties");
        condProps.putObject("fieldId").put("type", "string").put("description", "字段标识符");
        condProps
                .putObject("operator")
                .put("type", "string")
                .put(
                        "description",
                        "比较方式: eq/ne/gt/ge/lt/le/contains/startswith/in/between/isnull/isnotnull");
        condProps.putObject("value").put("description", "比较值");

        ObjectNode pageProp = props.putObject("pageSize");
        pageProp.put("type", "integer");
        pageProp.put("description", "每页记录数，默认20，最大200");

        ObjectNode pageIdxProp = props.putObject("pageIndex");
        pageIdxProp.put("type", "integer");
        pageIdxProp.put("description", "页码，从1开始");

        ObjectNode orderProp = props.putObject("orderByList");
        orderProp.put("type", "array");
        orderProp.put("description", "排序规则");
        ObjectNode orderItem = orderProp.putObject("items");
        orderItem.put("type", "object");
        ObjectNode orderProps = orderItem.putObject("properties");
        orderProps.putObject("fieldId").put("type", "string");
        orderProps.putObject("direction").put("type", "string").put("description", "asc 或 desc");

        ArrayNode required = schema.putArray("required");
        required.add("moduleId");

        return new ToolDefinition() {
            @Override
            public String name() {
                return name;
            }

            @Override
            public String description() {
                return desc;
            }

            @Override
            public JsonNode parametersSchema() {
                return schema;
            }

            @Override
            public String execute(JsonNode arguments) throws Exception {
                String moduleId = arguments.path("moduleId").asText("");
                if (moduleId.isBlank()) return "{\"error\":\"moduleId is required\"}";

                List<DataConnector.QueryFilter.Condition> conditions = new ArrayList<>();
                JsonNode condsNode = arguments.path("conditions");
                if (condsNode.isArray()) {
                    for (JsonNode c : condsNode) {
                        conditions.add(
                                new DataConnector.QueryFilter.Condition(
                                        c.path("fieldId").asText(""),
                                        c.path("operator").asText("eq"),
                                        parseValue(c.path("value"))));
                    }
                }

                List<DataConnector.QueryFilter.OrderBy> orderBy = new ArrayList<>();
                JsonNode orderNode = arguments.path("orderByList");
                if (orderNode.isArray()) {
                    for (JsonNode o : orderNode) {
                        orderBy.add(
                                new DataConnector.QueryFilter.OrderBy(
                                        o.path("fieldId").asText(""),
                                        o.path("direction").asText("asc")));
                    }
                }

                int pageSize = arguments.path("pageSize").asInt(20);
                int pageIndex = arguments.path("pageIndex").asInt(1);

                DataConnector.QueryFilter filter =
                        new DataConnector.QueryFilter(conditions, pageIndex, pageSize, orderBy);

                String ck = cacheKey(connector.id(), moduleId, filter);
                CacheEntry cached = queryCache.get(ck);
                if (cached != null && !cached.isExpired()) {
                    return cached.json();
                }

                DataConnector.QueryResult result = connector.queryData(moduleId, filter);

                List<Map<String, Object>> records = result.records();
                java.util.Set<String> masked = connector.maskedFieldNames();
                if (!masked.isEmpty() && !records.isEmpty()) {
                    records = maskRecords(records, masked);
                }

                String json =
                        mapper.writeValueAsString(
                                java.util.Map.of(
                                        "records", records,
                                        "total", result.total(),
                                        "pageIndex", result.pageIndex(),
                                        "pageSize", result.pageSize()));

                evictExpired();
                queryCache.put(
                        ck, new CacheEntry(json, System.currentTimeMillis() + QUERY_CACHE_TTL_MS));
                return json;
            }
        };
    }

    private static ToolDefinition createRecordTool(
            String prefix, String label, DataConnector connector, boolean en) {
        String name = prefix + "_create_record";
        String desc =
                en
                        ? "Create a new record in a table of "
                                + label
                                + ". Provide moduleId and a fields object with field IDs as keys."
                        : "在 " + label + " 的指定数据表中创建一条新记录。提供 moduleId 和包含字段标识符为 key 的 fields 对象。";

        ObjectNode schema = mapper.createObjectNode();
        schema.put("type", "object");
        ObjectNode props = schema.putObject("properties");
        props.putObject("moduleId").put("type", "string").put("description", "数据表标识符");
        props.putObject("fields").put("type", "object").put("description", "字段键值对");
        schema.putArray("required").add("moduleId").add("fields");

        return new ToolDefinition() {
            @Override
            public String name() {
                return name;
            }

            @Override
            public String description() {
                return desc;
            }

            @Override
            public JsonNode parametersSchema() {
                return schema;
            }

            @Override
            public String execute(JsonNode arguments) throws Exception {
                String moduleId = arguments.path("moduleId").asText("");
                if (moduleId.isBlank()) return "{\"error\":\"moduleId is required\"}";
                JsonNode fieldsNode = arguments.path("fields");
                if (!fieldsNode.isObject()) return "{\"error\":\"fields must be an object\"}";
                java.util.Map<String, Object> fields =
                        mapper.convertValue(
                                fieldsNode,
                                new com.fasterxml.jackson.core.type.TypeReference<>() {});
                java.util.Map<String, Object> result = connector.createRecord(moduleId, fields);
                return mapper.writeValueAsString(
                        java.util.Map.of("success", true, "record", result));
            }
        };
    }

    private static ToolDefinition updateRecordTool(
            String prefix, String label, DataConnector connector, boolean en) {
        String name = prefix + "_update_record";
        String desc =
                en
                        ? "Update an existing record in "
                                + label
                                + ". Provide moduleId, recordId, and fields to update."
                        : "更新 " + label + " 中的一条已有记录。提供 moduleId、recordId 和要更新的字段。";

        ObjectNode schema = mapper.createObjectNode();
        schema.put("type", "object");
        ObjectNode props = schema.putObject("properties");
        props.putObject("moduleId").put("type", "string").put("description", "数据表标识符");
        props.putObject("recordId").put("type", "string").put("description", "记录ID");
        props.putObject("fields").put("type", "object").put("description", "要更新的字段键值对");
        schema.putArray("required").add("moduleId").add("recordId").add("fields");

        return new ToolDefinition() {
            @Override
            public String name() {
                return name;
            }

            @Override
            public String description() {
                return desc;
            }

            @Override
            public JsonNode parametersSchema() {
                return schema;
            }

            @Override
            public String execute(JsonNode arguments) throws Exception {
                String moduleId = arguments.path("moduleId").asText("");
                String recordId = arguments.path("recordId").asText("");
                if (moduleId.isBlank()) return "{\"error\":\"moduleId is required\"}";
                if (recordId.isBlank()) return "{\"error\":\"recordId is required\"}";
                JsonNode fieldsNode = arguments.path("fields");
                if (!fieldsNode.isObject()) return "{\"error\":\"fields must be an object\"}";
                java.util.Map<String, Object> fields =
                        mapper.convertValue(
                                fieldsNode,
                                new com.fasterxml.jackson.core.type.TypeReference<>() {});
                java.util.Map<String, Object> result =
                        connector.updateRecord(moduleId, recordId, fields);
                return mapper.writeValueAsString(
                        java.util.Map.of("success", true, "record", result));
            }
        };
    }

    private static ToolDefinition deleteRecordTool(
            String prefix, String label, DataConnector connector, boolean en) {
        String name = prefix + "_delete_record";
        String desc =
                en
                        ? "Delete a record from a table in " + label + " by its record ID."
                        : "根据 recordId 从 " + label + " 的数据表中删除一条记录。";

        ObjectNode schema = mapper.createObjectNode();
        schema.put("type", "object");
        ObjectNode props = schema.putObject("properties");
        props.putObject("moduleId").put("type", "string").put("description", "数据表标识符");
        props.putObject("recordId").put("type", "string").put("description", "记录ID");
        schema.putArray("required").add("moduleId").add("recordId");

        return new ToolDefinition() {
            @Override
            public String name() {
                return name;
            }

            @Override
            public String description() {
                return desc;
            }

            @Override
            public JsonNode parametersSchema() {
                return schema;
            }

            @Override
            public String execute(JsonNode arguments) throws Exception {
                String moduleId = arguments.path("moduleId").asText("");
                String recordId = arguments.path("recordId").asText("");
                if (moduleId.isBlank()) return "{\"error\":\"moduleId is required\"}";
                if (recordId.isBlank()) return "{\"error\":\"recordId is required\"}";
                boolean deleted = connector.deleteRecord(moduleId, recordId);
                return mapper.writeValueAsString(java.util.Map.of("success", deleted));
            }
        };
    }

    private static Object parseValue(JsonNode node) {
        if (node == null || node.isMissingNode() || node.isNull()) return null;
        if (node.isTextual()) return node.asText();
        if (node.isInt()) return node.asInt();
        if (node.isLong()) return node.asLong();
        if (node.isDouble() || node.isFloat()) return node.asDouble();
        if (node.isBoolean()) return node.asBoolean();
        if (node.isArray()) {
            List<Object> list = new ArrayList<>();
            for (JsonNode item : node) list.add(parseValue(item));
            return list;
        }
        return node.toString();
    }

    private static List<Map<String, Object>> maskRecords(
            List<Map<String, Object>> records, Set<String> maskedFields) {
        List<Map<String, Object>> result = new ArrayList<>(records.size());
        for (Map<String, Object> row : records) {
            Map<String, Object> masked = new LinkedHashMap<>(row);
            for (Map.Entry<String, Object> entry : masked.entrySet()) {
                if (maskedFields.contains(entry.getKey().toLowerCase(Locale.ROOT))
                        && entry.getValue() != null) {
                    String val = String.valueOf(entry.getValue());
                    entry.setValue(maskValue(val));
                }
            }
            result.add(masked);
        }
        return result;
    }

    private static final java.util.concurrent.ConcurrentHashMap<String, CacheEntry> queryCache =
            new java.util.concurrent.ConcurrentHashMap<>();

    private record CacheEntry(String json, long expiresAt) {
        boolean isExpired() {
            return System.currentTimeMillis() > expiresAt;
        }
    }

    private static String cacheKey(
            String connectorId, String moduleId, DataConnector.QueryFilter filter) {
        return connectorId
                + "|"
                + moduleId
                + "|"
                + filter.pageIndex()
                + "|"
                + filter.pageSize()
                + "|"
                + filter.conditions()
                + "|"
                + filter.orderByList();
    }

    private static void evictExpired() {
        queryCache.entrySet().removeIf(e -> e.getValue().isExpired());
        if (queryCache.size() > QUERY_CACHE_MAX) {
            queryCache.entrySet().stream()
                    .sorted(java.util.Comparator.comparingLong(e -> e.getValue().expiresAt()))
                    .limit(queryCache.size() - QUERY_CACHE_MAX)
                    .map(java.util.Map.Entry::getKey)
                    .toList()
                    .forEach(queryCache::remove);
        }
    }

    private static String maskValue(String value) {
        if (value.length() <= 2) return "**";
        if (value.length() <= 6) return value.charAt(0) + "****" + value.charAt(value.length() - 1);
        return value.substring(0, 3) + "****" + value.substring(value.length() - 3);
    }

    private static String sanitize(String id) {
        return id.replaceAll("[^a-zA-Z0-9_]", "_").toLowerCase();
    }
}
