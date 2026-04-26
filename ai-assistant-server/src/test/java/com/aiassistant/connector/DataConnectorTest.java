package com.aiassistant.connector;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class DataConnectorTest {

    @Test
    void queryFilter_normalizesPageBounds() {
        var filter = new DataConnector.QueryFilter(List.of(), 0, 0, List.of());
        assertEquals(1, filter.pageIndex());
        assertEquals(20, filter.pageSize());
    }

    @Test
    void queryFilter_capsPageSize() {
        var filter = new DataConnector.QueryFilter(List.of(), 1, 500, List.of());
        assertEquals(200, filter.pageSize());
    }

    @Test
    void queryFilter_preservesValidValues() {
        var filter = new DataConnector.QueryFilter(List.of(), 3, 50, List.of());
        assertEquals(3, filter.pageIndex());
        assertEquals(50, filter.pageSize());
    }

    @Test
    void moduleInfo_recordAccessors() {
        var m = new DataConnector.ModuleInfo("orders", "订单", "Table");
        assertEquals("orders", m.id());
        assertEquals("订单", m.name());
        assertEquals("Table", m.type());
    }

    @Test
    void fieldInfo_recordAccessors() {
        var f = new DataConnector.FieldInfo("col1", "列1", "VARCHAR");
        assertEquals("col1", f.id());
        assertEquals("列1", f.name());
        assertEquals("VARCHAR", f.type());
    }

    @Test
    void queryResult_recordAccessors() {
        var r = new DataConnector.QueryResult(List.of(), 0, 1, 20);
        assertEquals(0, r.total());
        assertEquals(1, r.pageIndex());
        assertTrue(r.records().isEmpty());
    }

    @Test
    void condition_recordAccessors() {
        var c = new DataConnector.QueryFilter.Condition("name", "eq", "test");
        assertEquals("name", c.fieldId());
        assertEquals("eq", c.operator());
        assertEquals("test", c.value());
    }
}
