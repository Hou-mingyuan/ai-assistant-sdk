package com.aiassistant.connector;

import static org.junit.jupiter.api.Assertions.*;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import okhttp3.mockwebserver.MockResponse;
import okhttp3.mockwebserver.MockWebServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class RestApiConnectorTest {

    private MockWebServer server;
    private RestApiConnector connector;

    @BeforeEach
    void setUp() throws IOException {
        server = new MockWebServer();
        server.start();

        connector =
                new RestApiConnector(
                        "rest-test",
                        "Test REST",
                        server.url("/").toString(),
                        null,
                        null,
                        null,
                        Map.of("X-Custom", "test-header"),
                        10);
    }

    @AfterEach
    void tearDown() throws IOException {
        server.shutdown();
    }

    @Test
    void listModules_parsesJsonArray() {
        server.enqueue(
                new MockResponse()
                        .setHeader("Content-Type", "application/json")
                        .setBody(
                                "[{\"id\":\"orders\",\"name\":\"Orders\",\"type\":\"Table\"},"
                                        + "{\"id\":\"products\",\"name\":\"Products\",\"type\":\"Table\"}]"));

        List<DataConnector.ModuleInfo> modules = connector.listModules();
        assertEquals(2, modules.size());
        assertEquals("orders", modules.get(0).id());
        assertEquals("Products", modules.get(1).name());
    }

    @Test
    void listModules_parsesWrappedResponse() {
        server.enqueue(
                new MockResponse()
                        .setHeader("Content-Type", "application/json")
                        .setBody(
                                "{\"modules\":[{\"id\":\"m1\",\"name\":\"Module1\",\"type\":\"View\"}]}"));

        List<DataConnector.ModuleInfo> modules = connector.listModules();
        assertEquals(1, modules.size());
        assertEquals("m1", modules.get(0).id());
    }

    @Test
    void listModules_returnsEmptyOnError() {
        server.enqueue(new MockResponse().setResponseCode(500).setBody("Internal Error"));

        List<DataConnector.ModuleInfo> modules = connector.listModules();
        assertTrue(modules.isEmpty());
    }

    @Test
    void getSchema_parsesFields() {
        server.enqueue(
                new MockResponse()
                        .setHeader("Content-Type", "application/json")
                        .setBody(
                                "{\"moduleId\":\"orders\",\"moduleName\":\"Orders\","
                                        + "\"fields\":[{\"id\":\"order_no\",\"name\":\"Order No\",\"type\":\"String\"},"
                                        + "{\"id\":\"amount\",\"name\":\"Amount\",\"type\":\"Number\"}]}"));

        DataConnector.TableSchema schema = connector.getSchema("orders");
        assertEquals("orders", schema.moduleId());
        assertEquals("Orders", schema.moduleName());
        assertEquals(2, schema.fields().size());
        assertEquals("order_no", schema.fields().get(0).id());
    }

    @Test
    void queryData_parsesRecords() {
        server.enqueue(
                new MockResponse()
                        .setHeader("Content-Type", "application/json")
                        .setBody(
                                "{\"records\":[{\"id\":1,\"name\":\"Item1\"},{\"id\":2,\"name\":\"Item2\"}],\"total\":2}"));

        var filter = new DataConnector.QueryFilter(List.of(), 1, 20, List.of());
        DataConnector.QueryResult result = connector.queryData("orders", filter);

        assertEquals(2, result.records().size());
        assertEquals(2, result.total());
        assertEquals("Item1", result.records().get(0).get("name"));
    }

    @Test
    void queryData_handlesDataWrapper() {
        server.enqueue(
                new MockResponse()
                        .setHeader("Content-Type", "application/json")
                        .setBody("{\"data\":[{\"id\":1}],\"total\":1}"));

        var filter = new DataConnector.QueryFilter(List.of(), 1, 20, List.of());
        DataConnector.QueryResult result = connector.queryData("orders", filter);

        assertEquals(1, result.records().size());
    }

    @Test
    void queryData_returnsEmptyOnClientError() {
        server.enqueue(new MockResponse().setResponseCode(404).setBody("Not Found"));

        var filter = new DataConnector.QueryFilter(List.of(), 1, 20, List.of());
        DataConnector.QueryResult result = connector.queryData("nonexistent", filter);

        assertEquals(0, result.total());
        assertTrue(result.records().isEmpty());
    }
}
