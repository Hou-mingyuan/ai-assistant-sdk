package com.aiassistant.connector;

import java.util.List;
import java.util.Map;

/**
 * Abstraction for external data source connectors (low-code platforms, databases, REST APIs, etc.).
 * Each connector implementation is automatically registered as Function Calling tools for the LLM.
 */
public interface DataConnector {

    /** Unique identifier for this connector instance (used in tool name prefix). */
    String id();

    /** Human-readable label shown to the LLM in tool descriptions. */
    String displayName();

    /** List all available modules / tables in this data source. */
    List<ModuleInfo> listModules();

    /** Get schema (fields) for a specific module / table. */
    TableSchema getSchema(String moduleId);

    /** Query data from a module / table with optional filters. */
    QueryResult queryData(String moduleId, QueryFilter filter);

    // ── Value objects ──────────────────────────────────────────────────

    record ModuleInfo(String id, String name, String type) {}

    record TableSchema(String moduleId, String moduleName, List<FieldInfo> fields) {}

    record FieldInfo(String id, String name, String type) {}

    record QueryFilter(
            List<Condition> conditions,
            int pageIndex,
            int pageSize,
            List<OrderBy> orderByList
    ) {
        public QueryFilter {
            if (pageIndex <= 0) pageIndex = 1;
            if (pageSize <= 0) pageSize = 20;
            if (pageSize > 200) pageSize = 200;
        }

        public record Condition(String fieldId, String operator, Object value) {}
        public record OrderBy(String fieldId, String direction) {}
    }

    record QueryResult(
            List<Map<String, Object>> records,
            int total,
            int pageIndex,
            int pageSize
    ) {}
}
