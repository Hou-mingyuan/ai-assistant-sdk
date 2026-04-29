package com.aiassistant.connector;

import static org.junit.jupiter.api.Assertions.*;

import com.aiassistant.tool.ToolDefinition;
import com.aiassistant.tool.ToolRegistry;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class ConnectorToolRegistrarTest {

    private ToolRegistry registry;
    private final ObjectMapper mapper = new ObjectMapper();

    @BeforeEach
    void setUp() {
        registry = new ToolRegistry(List.of());
    }

    @Test
    void register_createsThreeTools() {
        DataConnector stub = new StubConnector("test", "TestSource");
        ConnectorToolRegistrar.register(stub, registry);

        assertNotNull(registry.get("test_list_modules"));
        assertNotNull(registry.get("test_get_schema"));
        assertNotNull(registry.get("test_query_data"));
        assertEquals(3, registry.all().size());
    }

    @Test
    void listModules_returnsJsonWithModules() throws Exception {
        DataConnector stub = new StubConnector("demo", "Demo");
        ConnectorToolRegistrar.register(stub, registry);

        ToolDefinition tool = registry.get("demo_list_modules");
        String result = tool.execute(mapper.createObjectNode());
        JsonNode root = mapper.readTree(result);

        assertTrue(root.has("modules"));
        assertEquals(2, root.path("modules").size());
        assertEquals("orders", root.path("modules").get(0).path("id").asText());
    }

    @Test
    void getSchema_returnsFieldList() throws Exception {
        DataConnector stub = new StubConnector("demo", "Demo");
        ConnectorToolRegistrar.register(stub, registry);

        ToolDefinition tool = registry.get("demo_get_schema");
        var args = mapper.createObjectNode().put("moduleId", "orders");
        String result = tool.execute(args);
        JsonNode root = mapper.readTree(result);

        assertEquals("orders", root.path("moduleId").asText());
        assertTrue(root.path("fields").size() > 0);
    }

    @Test
    void getSchema_rejectsMissingModuleId() throws Exception {
        DataConnector stub = new StubConnector("demo", "Demo");
        ConnectorToolRegistrar.register(stub, registry);

        ToolDefinition tool = registry.get("demo_get_schema");
        String result = tool.execute(mapper.createObjectNode());
        assertTrue(result.contains("error"));
    }

    @Test
    void queryData_returnsRecords() throws Exception {
        DataConnector stub = new StubConnector("demo", "Demo");
        ConnectorToolRegistrar.register(stub, registry);

        ToolDefinition tool = registry.get("demo_query_data");
        var args = mapper.createObjectNode().put("moduleId", "orders");
        String result = tool.execute(args);
        JsonNode root = mapper.readTree(result);

        assertTrue(root.path("records").isArray());
        assertEquals(1, root.path("records").size());
        assertEquals("PO-001", root.path("records").get(0).path("order_no").asText());
    }

    @Test
    void queryData_withConditions() throws Exception {
        DataConnector stub = new StubConnector("demo", "Demo");
        ConnectorToolRegistrar.register(stub, registry);

        ToolDefinition tool = registry.get("demo_query_data");
        var args = mapper.createObjectNode().put("moduleId", "orders");
        var conds = args.putArray("conditions");
        conds.addObject().put("fieldId", "amount").put("operator", "gt").put("value", 100);

        String result = tool.execute(args);
        JsonNode root = mapper.readTree(result);
        assertEquals(1, root.path("records").size());
    }

    @Test
    void sanitizesSpecialCharsInId() {
        DataConnector stub = new StubConnector("my-data.source", "My Source");
        ConnectorToolRegistrar.register(stub, registry);

        assertNotNull(registry.get("my_data_source_list_modules"));
    }

    @Test
    void toolDescriptionsContainDisplayName() {
        DataConnector stub = new StubConnector("demo", "生产管理系统");
        ConnectorToolRegistrar.register(stub, registry);

        ToolDefinition tool = registry.get("demo_list_modules");
        assertTrue(tool.description().contains("生产管理系统"));
    }

    /** Stub DataConnector for testing. */
    static class StubConnector implements DataConnector {
        private final String id;
        private final String name;

        StubConnector(String id, String name) {
            this.id = id;
            this.name = name;
        }

        @Override
        public String id() {
            return id;
        }

        @Override
        public String displayName() {
            return name;
        }

        @Override
        public List<ModuleInfo> listModules() {
            return List.of(
                    new ModuleInfo("orders", "订单管理", "Table"),
                    new ModuleInfo("products", "产品管理", "Table"));
        }

        @Override
        public TableSchema getSchema(String moduleId) {
            return new TableSchema(
                    moduleId,
                    moduleId,
                    List.of(
                            new FieldInfo("order_no", "订单编号", "SingleText"),
                            new FieldInfo("amount", "金额", "Number"),
                            new FieldInfo("create_time", "创建时间", "Date")));
        }

        @Override
        public QueryResult queryData(String moduleId, QueryFilter filter) {
            return new QueryResult(
                    List.of(
                            Map.of(
                                    "order_no",
                                    "PO-001",
                                    "amount",
                                    1500,
                                    "create_time",
                                    "2024-01-15")),
                    1,
                    filter.pageIndex(),
                    filter.pageSize());
        }
    }
}
