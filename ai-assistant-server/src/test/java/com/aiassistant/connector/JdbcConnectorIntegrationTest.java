package com.aiassistant.connector;

import static org.junit.jupiter.api.Assertions.*;

import java.sql.Connection;
import java.sql.Statement;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

class JdbcConnectorIntegrationTest {

    private static org.h2.jdbcx.JdbcDataSource dataSource;

    @BeforeAll
    static void setUp() throws Exception {
        dataSource = new org.h2.jdbcx.JdbcDataSource();
        dataSource.setURL("jdbc:h2:mem:testdb;DB_CLOSE_DELAY=-1");
        dataSource.setUser("sa");
        dataSource.setPassword("");

        try (Connection conn = dataSource.getConnection();
                Statement stmt = conn.createStatement()) {
            stmt.execute(
                    "CREATE TABLE orders (id INT PRIMARY KEY, order_no VARCHAR(50), amount DECIMAL(10,2), status VARCHAR(20))");
            stmt.execute("INSERT INTO orders VALUES (1, 'PO-001', 1500.00, 'completed')");
            stmt.execute("INSERT INTO orders VALUES (2, 'PO-002', 3200.50, 'pending')");
            stmt.execute("INSERT INTO orders VALUES (3, 'PO-003', 800.00, 'completed')");

            stmt.execute(
                    "CREATE TABLE products (id INT PRIMARY KEY, name VARCHAR(100), price DECIMAL(10,2))");
            stmt.execute("INSERT INTO products VALUES (1, 'Widget', 29.99)");
        }
    }

    @AfterAll
    static void tearDown() throws Exception {
        try (Connection conn = dataSource.getConnection();
                Statement stmt = conn.createStatement()) {
            stmt.execute("DROP TABLE IF EXISTS orders");
            stmt.execute("DROP TABLE IF EXISTS products");
        }
    }

    @Test
    void listModules_returnsAllTables() {
        JdbcConnector connector = new JdbcConnector("test", "TestDB", dataSource, Set.of(), null);
        List<DataConnector.ModuleInfo> modules = connector.listModules();

        assertTrue(modules.size() >= 2);
        assertTrue(modules.stream().anyMatch(m -> m.id().equalsIgnoreCase("ORDERS")));
        assertTrue(modules.stream().anyMatch(m -> m.id().equalsIgnoreCase("PRODUCTS")));
    }

    @Test
    void listModules_respectsAllowedTables() {
        JdbcConnector connector =
                new JdbcConnector("test", "TestDB", dataSource, Set.of("orders"), null);
        List<DataConnector.ModuleInfo> modules = connector.listModules();

        assertEquals(1, modules.size());
        assertTrue(modules.get(0).id().equalsIgnoreCase("ORDERS"));
    }

    @Test
    void getSchema_returnsColumns() {
        JdbcConnector connector = new JdbcConnector("test", "TestDB", dataSource, Set.of(), null);
        DataConnector.TableSchema schema = connector.getSchema("ORDERS");

        assertEquals(4, schema.fields().size());
        assertTrue(schema.fields().stream().anyMatch(f -> f.id().equalsIgnoreCase("ORDER_NO")));
        assertTrue(schema.fields().stream().anyMatch(f -> f.id().equalsIgnoreCase("AMOUNT")));
    }

    @Test
    void queryData_returnsRecordsWithPagination() {
        JdbcConnector connector = new JdbcConnector("test", "TestDB", dataSource, Set.of(), null);
        var filter = new DataConnector.QueryFilter(List.of(), 1, 2, List.of());
        DataConnector.QueryResult result = connector.queryData("ORDERS", filter);

        assertEquals(2, result.records().size());
        assertEquals(3, result.total());
        assertEquals(1, result.pageIndex());
    }

    @Test
    void queryData_withConditions() {
        JdbcConnector connector = new JdbcConnector("test", "TestDB", dataSource, Set.of(), null);
        var condition = new DataConnector.QueryFilter.Condition("STATUS", "eq", "completed");
        var filter = new DataConnector.QueryFilter(List.of(condition), 1, 20, List.of());
        DataConnector.QueryResult result = connector.queryData("ORDERS", filter);

        assertEquals(2, result.records().size());
        assertEquals(2, result.total());
    }

    @Test
    void queryData_withSorting() {
        JdbcConnector connector = new JdbcConnector("test", "TestDB", dataSource, Set.of(), null);
        var orderBy = new DataConnector.QueryFilter.OrderBy("AMOUNT", "desc");
        var filter = new DataConnector.QueryFilter(List.of(), 1, 20, List.of(orderBy));
        DataConnector.QueryResult result = connector.queryData("ORDERS", filter);

        assertEquals(3, result.records().size());
        Number firstAmount = (Number) result.records().get(0).get("AMOUNT");
        Number lastAmount = (Number) result.records().get(2).get("AMOUNT");
        assertTrue(firstAmount.doubleValue() > lastAmount.doubleValue());
    }

    @Test
    void queryData_rejectsDisallowedTable() {
        JdbcConnector connector =
                new JdbcConnector("test", "TestDB", dataSource, Set.of("products"), null);
        var filter = new DataConnector.QueryFilter(List.of(), 1, 20, List.of());
        DataConnector.QueryResult result = connector.queryData("ORDERS", filter);

        assertEquals(0, result.total());
        assertTrue(result.records().isEmpty());
    }

    @Test
    void queryData_rejectsUnsafeTableName() {
        JdbcConnector connector = new JdbcConnector("test", "TestDB", dataSource, Set.of(), null);
        var filter = new DataConnector.QueryFilter(List.of(), 1, 20, List.of());

        assertThrows(
                IllegalArgumentException.class,
                () -> connector.queryData("orders; DROP TABLE users--", filter));
    }

    @Test
    void queryData_likeCondition() {
        JdbcConnector connector = new JdbcConnector("test", "TestDB", dataSource, Set.of(), null);
        var condition = new DataConnector.QueryFilter.Condition("ORDER_NO", "contains", "002");
        var filter = new DataConnector.QueryFilter(List.of(condition), 1, 20, List.of());
        DataConnector.QueryResult result = connector.queryData("ORDERS", filter);

        assertEquals(1, result.records().size());
    }
}
