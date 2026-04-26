package com.aiassistant.connector;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.sql.DataSource;
import java.sql.*;
import java.util.*;

/**
 * DataConnector backed by a JDBC DataSource.
 * Auto-discovers tables and columns via {@link DatabaseMetaData} and queries data
 * with parameterized SQL to prevent injection.
 */
public class JdbcConnector implements DataConnector {

    private static final Logger log = LoggerFactory.getLogger(JdbcConnector.class);

    private final String connectorId;
    private final String displayName;
    private final DataSource dataSource;
    private final Set<String> allowedTablesLower;
    private final String schema;

    private volatile List<ModuleInfo> cachedModules;
    private volatile long cacheExpiry = 0;
    private static final long CACHE_TTL_MS = 600_000; // 10 min
    private volatile PaginationDialect dialect;

    /**
     * @param connectorId unique id
     * @param displayName human label for LLM
     * @param dataSource  JDBC data source
     * @param allowedTables if non-empty, only expose these tables (case-insensitive); empty = all
     * @param schema      database schema to inspect (null = default)
     */
    public JdbcConnector(String connectorId, String displayName, DataSource dataSource,
                         Set<String> allowedTables, String schema) {
        this.connectorId = connectorId != null ? connectorId : "db";
        this.displayName = displayName != null ? displayName : "Database";
        this.dataSource = Objects.requireNonNull(dataSource, "dataSource must not be null");
        Set<String> raw = allowedTables != null ? allowedTables : Set.of();
        Set<String> lower = new HashSet<>(raw.size());
        for (String t : raw) lower.add(t.toLowerCase(Locale.ROOT));
        this.allowedTablesLower = Set.copyOf(lower);
        this.schema = schema;
        log.info("JdbcConnector initialized: id={}, schema={}, allowedTables={}",
                this.connectorId, schema, this.allowedTablesLower.isEmpty() ? "ALL" : this.allowedTablesLower);
    }

    @Override public String id() { return connectorId; }
    @Override public String displayName() { return displayName; }

    @Override
    public List<ModuleInfo> listModules() {
        if (System.currentTimeMillis() < cacheExpiry && cachedModules != null) {
            return cachedModules;
        }
        List<ModuleInfo> result = new ArrayList<>();
        try (Connection conn = dataSource.getConnection()) {
            DatabaseMetaData meta = conn.getMetaData();
            try (ResultSet rs = meta.getTables(null, schema, "%", new String[]{"TABLE", "VIEW"})) {
                while (rs.next()) {
                    String tableName = rs.getString("TABLE_NAME");
                    String tableType = rs.getString("TABLE_TYPE");
                    if (!allowedTablesLower.isEmpty() && !allowedTablesLower.contains(tableName.toLowerCase(Locale.ROOT))) {
                        continue;
                    }
                    String remarks = rs.getString("REMARKS");
                    String label = (remarks != null && !remarks.isBlank()) ? remarks : tableName;
                    result.add(new ModuleInfo(tableName, label, tableType));
                }
            }
        } catch (SQLException e) {
            log.error("Failed to list tables: {}", e.getMessage());
        }
        cachedModules = result;
        cacheExpiry = System.currentTimeMillis() + CACHE_TTL_MS;
        return result;
    }

    @Override
    public TableSchema getSchema(String moduleId) {
        List<FieldInfo> fields = new ArrayList<>();
        try (Connection conn = dataSource.getConnection()) {
            DatabaseMetaData meta = conn.getMetaData();
            try (ResultSet rs = meta.getColumns(null, schema, moduleId, "%")) {
                while (rs.next()) {
                    String colName = rs.getString("COLUMN_NAME");
                    String typeName = rs.getString("TYPE_NAME");
                    String remarks = rs.getString("REMARKS");
                    String label = (remarks != null && !remarks.isBlank()) ? remarks : colName;
                    fields.add(new FieldInfo(colName, label, typeName));
                }
            }
        } catch (SQLException e) {
            log.error("Failed to get schema for {}: {}", moduleId, e.getMessage());
        }
        return new TableSchema(moduleId, moduleId, fields);
    }

    @Override
    public QueryResult queryData(String moduleId, QueryFilter filter) {
        if (!isTableAllowed(moduleId)) {
            return new QueryResult(List.of(), 0, filter.pageIndex(), filter.pageSize());
        }

        StringBuilder sql = new StringBuilder("SELECT * FROM ").append(quoteIdentifier(moduleId));
        List<Object> params = new ArrayList<>();

        if (filter.conditions() != null && !filter.conditions().isEmpty()) {
            sql.append(" WHERE ");
            List<String> clauses = new ArrayList<>();
            for (QueryFilter.Condition c : filter.conditions()) {
                String clause = buildCondition(c, params);
                if (clause != null) clauses.add(clause);
            }
            sql.append(String.join(" AND ", clauses));
        }

        if (filter.orderByList() != null && !filter.orderByList().isEmpty()) {
            sql.append(" ORDER BY ");
            List<String> orders = new ArrayList<>();
            for (QueryFilter.OrderBy ob : filter.orderByList()) {
                orders.add(quoteIdentifier(ob.fieldId()) + ("desc".equalsIgnoreCase(ob.direction()) ? " DESC" : " ASC"));
            }
            sql.append(String.join(", ", orders));
        }

        int offset = (filter.pageIndex() - 1) * filter.pageSize();
        appendPagination(sql, params, filter.pageSize(), offset);

        StringBuilder countSql = new StringBuilder("SELECT COUNT(*) FROM ").append(quoteIdentifier(moduleId));
        List<Object> countParams = new ArrayList<>();
        if (filter.conditions() != null && !filter.conditions().isEmpty()) {
            countSql.append(" WHERE ");
            List<String> countClauses = new ArrayList<>();
            for (QueryFilter.Condition c : filter.conditions()) {
                String clause = buildCondition(c, countParams);
                if (clause != null) countClauses.add(clause);
            }
            countSql.append(String.join(" AND ", countClauses));
        }

        List<Map<String, Object>> records = new ArrayList<>();
        int total = 0;
        try (Connection conn = dataSource.getConnection()) {
            try (PreparedStatement countStmt = conn.prepareStatement(countSql.toString())) {
                for (int i = 0; i < countParams.size(); i++) {
                    countStmt.setObject(i + 1, countParams.get(i));
                }
                try (ResultSet crs = countStmt.executeQuery()) {
                    if (crs.next()) total = crs.getInt(1);
                }
            }

            try (PreparedStatement stmt = conn.prepareStatement(sql.toString())) {
                for (int i = 0; i < params.size(); i++) {
                    stmt.setObject(i + 1, params.get(i));
                }
                try (ResultSet rs = stmt.executeQuery()) {
                    ResultSetMetaData rsMeta = rs.getMetaData();
                    int colCount = rsMeta.getColumnCount();
                    while (rs.next()) {
                        Map<String, Object> row = new LinkedHashMap<>();
                        for (int i = 1; i <= colCount; i++) {
                            row.put(rsMeta.getColumnLabel(i), rs.getObject(i));
                        }
                        records.add(row);
                    }
                }
            }
        } catch (SQLException e) {
            log.error("Query failed on {}: {}", moduleId, e.getMessage());
            return new QueryResult(List.of(), 0, filter.pageIndex(), filter.pageSize());
        }

        return new QueryResult(records, total, filter.pageIndex(), filter.pageSize());
    }

    private boolean isTableAllowed(String tableName) {
        if (allowedTablesLower.isEmpty()) return true;
        return allowedTablesLower.contains(tableName.toLowerCase(Locale.ROOT));
    }

    private String buildCondition(QueryFilter.Condition c, List<Object> params) {
        String col = quoteIdentifier(c.fieldId());
        String op = c.operator() != null ? c.operator().toLowerCase(Locale.ROOT) : "eq";
        return switch (op) {
            case "eq", "=", "==" -> { params.add(c.value()); yield col + " = ?"; }
            case "ne", "!=", "<>" -> { params.add(c.value()); yield col + " <> ?"; }
            case "gt", ">" -> { params.add(c.value()); yield col + " > ?"; }
            case "ge", ">=" -> { params.add(c.value()); yield col + " >= ?"; }
            case "lt", "<" -> { params.add(c.value()); yield col + " < ?"; }
            case "le", "<=" -> { params.add(c.value()); yield col + " <= ?"; }
            case "contains", "like" -> { params.add("%" + c.value() + "%"); yield col + " LIKE ?"; }
            case "startswith" -> { params.add(c.value() + "%"); yield col + " LIKE ?"; }
            case "endswith" -> { params.add("%" + c.value()); yield col + " LIKE ?"; }
            case "isnull" -> col + " IS NULL";
            case "isnotnull" -> col + " IS NOT NULL";
            case "in" -> {
                if (c.value() instanceof List<?> list && !list.isEmpty()) {
                    String placeholders = String.join(",", Collections.nCopies(list.size(), "?"));
                    params.addAll(list);
                    yield col + " IN (" + placeholders + ")";
                }
                yield "1=1";
            }
            default -> { params.add(c.value()); yield col + " = ?"; }
        };
    }

    private void appendPagination(StringBuilder sql, List<Object> params, int limit, int offset) {
        PaginationDialect d = resolveDialect();
        switch (d) {
            case LIMIT_OFFSET -> {
                sql.append(" LIMIT ? OFFSET ?");
                params.add(limit);
                params.add(offset);
            }
            case OFFSET_FETCH -> {
                if (!sql.toString().toUpperCase(Locale.ROOT).contains("ORDER BY")) {
                    sql.append(" ORDER BY 1");
                }
                sql.append(" OFFSET ? ROWS FETCH NEXT ? ROWS ONLY");
                params.add(offset);
                params.add(limit);
            }
        }
    }

    private PaginationDialect resolveDialect() {
        if (dialect != null) return dialect;
        try (Connection conn = dataSource.getConnection()) {
            String product = conn.getMetaData().getDatabaseProductName().toLowerCase(Locale.ROOT);
            if (product.contains("oracle") || product.contains("sql server") || product.contains("microsoft")) {
                dialect = PaginationDialect.OFFSET_FETCH;
            } else {
                dialect = PaginationDialect.LIMIT_OFFSET;
            }
        } catch (SQLException e) {
            log.warn("Could not detect DB dialect, defaulting to LIMIT/OFFSET: {}", e.getMessage());
            dialect = PaginationDialect.LIMIT_OFFSET;
        }
        return dialect;
    }

    private enum PaginationDialect {
        LIMIT_OFFSET,
        OFFSET_FETCH
    }

    /**
     * Simple identifier quoting to prevent SQL injection via column/table names.
     * Uses double-quote which is ANSI SQL standard.
     */
    private static String quoteIdentifier(String name) {
        return "\"" + name.replace("\"", "\"\"") + "\"";
    }
}
