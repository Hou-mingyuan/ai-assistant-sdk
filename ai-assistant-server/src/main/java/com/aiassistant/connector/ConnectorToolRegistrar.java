package com.aiassistant.connector;

import com.aiassistant.tool.ToolDefinition;
import com.aiassistant.tool.ToolRegistry;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Bridges {@link DataConnector} instances into the {@link ToolRegistry} system.
 * For each connector, registers three Function Calling tools:
 * <ul>
 *   <li>{prefix}_list_modules – discover available modules/tables</li>
 *   <li>{prefix}_get_schema – inspect table structure</li>
 *   <li>{prefix}_query_data – query records with filters</li>
 * </ul>
 */
public class ConnectorToolRegistrar {

    private static final Logger log = LoggerFactory.getLogger(ConnectorToolRegistrar.class);
    private static final ObjectMapper mapper = new ObjectMapper();

    public static void register(DataConnector connector, ToolRegistry registry) {
        String prefix = sanitize(connector.id());
        String label = connector.displayName();

        registry.register(listModulesTool(prefix, label, connector));
        registry.register(getSchemaTool(prefix, label, connector));
        registry.register(queryDataTool(prefix, label, connector));

        log.info("Registered 3 tools for connector '{}' (prefix={})", label, prefix);
    }

    private static ToolDefinition listModulesTool(String prefix, String label, DataConnector connector) {
        String name = prefix + "_list_modules";
        String desc = "列出 " + label + " 中所有可用的数据模块/表。"
                + "当用户提到某个业务模块时，先调用此工具查找对应的 moduleId。";

        ObjectNode schema = mapper.createObjectNode();
        schema.put("type", "object");
        schema.putObject("properties");

        return new ToolDefinition() {
            @Override public String name() { return name; }
            @Override public String description() { return desc; }
            @Override public JsonNode parametersSchema() { return schema; }
            @Override
            public String execute(JsonNode arguments) throws Exception {
                List<DataConnector.ModuleInfo> modules = connector.listModules();
                if (modules.isEmpty()) return "{\"modules\":[],\"hint\":\"未找到任何模块\"}";
                List<Object> list = modules.stream()
                        .map(m -> java.util.Map.of("id", m.id(), "name", m.name(), "type", m.type()))
                        .collect(Collectors.toList());
                return mapper.writeValueAsString(java.util.Map.of("modules", list, "total", list.size()));
            }
        };
    }

    private static ToolDefinition getSchemaTool(String prefix, String label, DataConnector connector) {
        String name = prefix + "_get_schema";
        String desc = "获取 " + label + " 中指定数据表的字段结构（字段名称、标识符、类型）。"
                + "在查询数据之前必须先调用此工具了解表结构，以便构造正确的过滤条件。";

        ObjectNode schema = mapper.createObjectNode();
        schema.put("type", "object");
        ObjectNode props = schema.putObject("properties");
        ObjectNode moduleIdProp = props.putObject("moduleId");
        moduleIdProp.put("type", "string");
        moduleIdProp.put("description", "数据模块的标识符(key)，通过 list_modules 获取");
        ArrayNode required = schema.putArray("required");
        required.add("moduleId");

        return new ToolDefinition() {
            @Override public String name() { return name; }
            @Override public String description() { return desc; }
            @Override public JsonNode parametersSchema() { return schema; }
            @Override
            public String execute(JsonNode arguments) throws Exception {
                String moduleId = arguments.path("moduleId").asText("");
                if (moduleId.isBlank()) return "{\"error\":\"moduleId is required\"}";
                DataConnector.TableSchema ts = connector.getSchema(moduleId);
                List<Object> fields = ts.fields().stream()
                        .map(f -> java.util.Map.of("id", f.id(), "name", f.name(), "type", f.type()))
                        .collect(Collectors.toList());
                return mapper.writeValueAsString(java.util.Map.of(
                        "moduleId", ts.moduleId(),
                        "moduleName", ts.moduleName(),
                        "fields", fields
                ));
            }
        };
    }

    private static ToolDefinition queryDataTool(String prefix, String label, DataConnector connector) {
        String name = prefix + "_query_data";
        String desc = "从 " + label + " 的指定数据表中查询记录。"
                + "支持字段过滤（等于、大于、包含等）、排序和分页。"
                + "先用 get_schema 获取字段结构，再用正确的 fieldId 构造条件。";

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
        condProps.putObject("operator").put("type", "string")
                .put("description", "比较方式: eq/ne/gt/ge/lt/le/contains/startswith/in/between/isnull/isnotnull");
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
            @Override public String name() { return name; }
            @Override public String description() { return desc; }
            @Override public JsonNode parametersSchema() { return schema; }
            @Override
            public String execute(JsonNode arguments) throws Exception {
                String moduleId = arguments.path("moduleId").asText("");
                if (moduleId.isBlank()) return "{\"error\":\"moduleId is required\"}";

                List<DataConnector.QueryFilter.Condition> conditions = new ArrayList<>();
                JsonNode condsNode = arguments.path("conditions");
                if (condsNode.isArray()) {
                    for (JsonNode c : condsNode) {
                        conditions.add(new DataConnector.QueryFilter.Condition(
                                c.path("fieldId").asText(""),
                                c.path("operator").asText("eq"),
                                parseValue(c.path("value"))
                        ));
                    }
                }

                List<DataConnector.QueryFilter.OrderBy> orderBy = new ArrayList<>();
                JsonNode orderNode = arguments.path("orderByList");
                if (orderNode.isArray()) {
                    for (JsonNode o : orderNode) {
                        orderBy.add(new DataConnector.QueryFilter.OrderBy(
                                o.path("fieldId").asText(""),
                                o.path("direction").asText("asc")
                        ));
                    }
                }

                int pageSize = arguments.path("pageSize").asInt(20);
                int pageIndex = arguments.path("pageIndex").asInt(1);

                DataConnector.QueryFilter filter = new DataConnector.QueryFilter(
                        conditions, pageIndex, pageSize, orderBy);
                DataConnector.QueryResult result = connector.queryData(moduleId, filter);

                return mapper.writeValueAsString(java.util.Map.of(
                        "records", result.records(),
                        "total", result.total(),
                        "pageIndex", result.pageIndex(),
                        "pageSize", result.pageSize()
                ));
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

    private static String sanitize(String id) {
        return id.replaceAll("[^a-zA-Z0-9_]", "_").toLowerCase();
    }
}
