package com.aiassistant.connector;

import com.aiassistant.connector.DataConnector.FieldInfo;
import com.aiassistant.connector.DataConnector.ModuleInfo;
import com.aiassistant.connector.DataConnector.QueryFilter;
import com.aiassistant.connector.DataConnector.QueryResult;
import com.aiassistant.connector.DataConnector.TableSchema;
import java.sql.Connection;
import java.sql.DatabaseMetaData;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.ResultSetMetaData;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Semaphore;
import java.util.concurrent.TimeUnit;
import javax.sql.DataSource;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * DataConnector backed by a JDBC DataSource. Auto-discovers tables and columns via {@link
 * DatabaseMetaData} and queries data with parameterized SQL to prevent injection.
 *
 * <p>Zero-config defaults: when {@code schema} is not set the connector resolves the schema the
 * JDBC connection itself belongs to (current user / catalog) instead of scanning every schema, so
 * only the tables of the configured account are exposed. Table and column ids coming from the LLM
 * are matched case-insensitively against the database metadata before they are quoted, and the
 * pagination dialect is detected by probing the server (works for OceanBase in Oracle and MySQL
 * mode, whose product name matches neither heuristic).
 */
public class JdbcConnector implements DataConnector {

    private static final Logger log = LoggerFactory.getLogger(JdbcConnector.class);

    private final String connectorId;
    private final String displayName;
    private final DataSource dataSource;
    private final Set<String> allowedTablesLower;
    private final String schema;

    private static final int MAX_CONCURRENT_QUERIES = 5;
    private static final int QUERY_TIMEOUT_SECONDS = 30;
    private static final int PROBE_TIMEOUT_SECONDS = 5;
    private final Semaphore querySemaphore = new Semaphore(MAX_CONCURRENT_QUERIES);

    private volatile List<ModuleInfo> cachedModules;
    private volatile long cacheExpiry = 0;
    private static final long CACHE_TTL_MS = 600_000; // 10 min
    private volatile PaginationDialect dialect;

    /** Schema resolved from the connection when {@link #schema} is blank; null = all schemas. */
    private volatile String effectiveSchema;
    private volatile boolean schemaResolved;

    /** table (lower-case) -> (column lower-case -> actual column name). */
    private final ConcurrentHashMap<String, Map<String, String>> columnCaseCache =
            new ConcurrentHashMap<>();

    private record ColumnMeta(FieldInfo field, String lowerName) {}

    /**
     * @param connectorId unique id
     * @param displayName human label for LLM
     * @param dataSource JDBC data source
     * @param allowedTables if non-empty, only expose these tables (case-insensitive); empty = all
     * @param schema database schema to inspect (null or blank = the connection's own schema)
     */
    public JdbcConnector(
            String connectorId,
            String displayName,
            DataSource dataSource,
            Set<String> allowedTables,
            String schema) {
        this.connectorId = connectorId != null ? connectorId : "db";
        this.displayName = displayName != null ? displayName : "Database";
        this.dataSource = Objects.requireNonNull(dataSource, "dataSource must not be null");
        Set<String> lower = new HashSet<>();
        if (allowedTables != null) {
            for (String t : allowedTables) {
                if (t != null && !t.isBlank()) {
                    lower.add(t.trim().toLowerCase(Locale.ROOT));
                }
            }
        }
        this.allowedTablesLower = Set.copyOf(lower);
        this.schema = schema;
        log.info(
                "JdbcConnector initialized: id={}, schema={}, allowedTables={}",
                this.connectorId,
                schema,
                allowedTablesLower.isEmpty() ? "ALL" : allowedTablesLower);
    }

    @Override
    public String id() {
        return connectorId;
    }

    @Override
    public String displayName() {
        return displayName;
    }

    @Override
    public List<ModuleInfo> listModules() {
        if (System.currentTimeMillis() < cacheExpiry && cachedModules != null) {
            return cachedModules;
        }
        List<ModuleInfo> result = new ArrayList<>();
        try (Connection conn = dataSource.getConnection()) {
            DatabaseMetaData meta = conn.getMetaData();
            String eff = resolveEffectiveSchema(conn, meta);
            try (ResultSet rs = meta.getTables(null, eff, "%", new String[] {"TABLE", "VIEW"})) {
                while (rs.next()) {
                    String tableName = rs.getString("TABLE_NAME");
                    if (tableName == null || tableName.isBlank()) {
                        continue;
                    }
                    if (!isTableAllowed(tableName)) {
                        continue;
                    }
                    String tableType = rs.getString("TABLE_TYPE");
                    String remarks = rs.getString("REMARKS");
                    String label = remarks != null && !remarks.isBlank() ? remarks : tableName;
                    result.add(new ModuleInfo(tableName, label, tableType));
                }
            }
            result.sort(Comparator.comparing(ModuleInfo::id, String.CASE_INSENSITIVE_ORDER));
        } catch (SQLException e) {
            // Do not cache: a transient failure must not pin an empty module list for 10 minutes.
            log.error("Failed to list tables: {}", e.getMessage());
            return result;
        }
        cachedModules = Collections.unmodifiableList(result);
        cacheExpiry = System.currentTimeMillis() + CACHE_TTL_MS;
        return result;
    }

    @Override
    public TableSchema getSchema(String moduleId) {
        String table = resolveTableName(moduleId);
        List<FieldInfo> fields = new ArrayList<>();
        try (Connection conn = dataSource.getConnection()) {
            DatabaseMetaData meta = conn.getMetaData();
            String eff = resolveEffectiveSchema(conn, meta);
            List<ColumnMeta> columns = readColumns(meta, eff, table);
            for (ColumnMeta c : columns) {
                fields.add(c.field());
            }
            columnCaseCache.put(table.toLowerCase(Locale.ROOT), toCaseMap(columns));
        } catch (SQLException e) {
            log.error("Failed to get schema for {}: {}", moduleId, e.getMessage());
        }
        return new TableSchema(table, moduleLabel(table), fields);
    }

    @Override
    public QueryResult queryData(String moduleId, QueryFilter filter) {
        if (!isTableAllowed(moduleId)) {
            return new QueryResult(List.of(), 0, filter.pageIndex(), filter.pageSize());
        }
        boolean acquired;
        try {
            acquired = querySemaphore.tryAcquire(QUERY_TIMEOUT_SECONDS, TimeUnit.SECONDS);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            log.warn("Interrupted waiting for query semaphore on {}", moduleId);
            return new QueryResult(List.of(), 0, filter.pageIndex(), filter.pageSize());
        }
        if (!acquired) {
            log.warn("Query semaphore exhausted for {} (max={})", moduleId, MAX_CONCURRENT_QUERIES);
            return new QueryResult(List.of(), 0, filter.pageIndex(), filter.pageSize());
        }
        try {
            return executeQuery(moduleId, filter);
        } finally {
            querySemaphore.release();
        }
    }

    private QueryResult executeQuery(String moduleId, QueryFilter filter) {
        String table = resolveTableName(moduleId);
        List<Map<String, Object>> records = new ArrayList<>();
        int total = 0;
        try (Connection conn = dataSource.getConnection()) {
            List<Object> params = new ArrayList<>();
            String base = " FROM " + quoteIdentifier(table) + buildWhere(table, filter, params);
            String countSql = "SELECT COUNT(*)" + base;
            List<Object> countParams = new ArrayList<>(params);

            StringBuilder sql = new StringBuilder("SELECT *").append(base).append(buildOrderBy(table, filter));
            int offset = (filter.pageIndex() - 1) * filter.pageSize();
            appendPagination(sql, params, filter.pageSize(), offset);

            try (PreparedStatement countStmt = conn.prepareStatement(countSql)) {
                countStmt.setQueryTimeout(QUERY_TIMEOUT_SECONDS);
                bind(countStmt, countParams);
                try (ResultSet crs = countStmt.executeQuery()) {
                    if (crs.next()) {
                        total = crs.getInt(1);
                    }
                }
            }
            try (PreparedStatement stmt = conn.prepareStatement(sql.toString())) {
                stmt.setQueryTimeout(QUERY_TIMEOUT_SECONDS);
                bind(stmt, params);
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
        if (allowedTablesLower.isEmpty()) {
            return true;
        }
        return tableName != null && allowedTablesLower.contains(tableName.toLowerCase(Locale.ROOT));
    }

    // ---------------------------------------------------------------- zero-config helpers

    /**
     * Returns the configured schema, or when none is configured the schema the connection belongs
     * to. Candidates are validated with a metadata probe because drivers disagree: MySQL returns
     * {@code root@localhost} from {@code getUserName()} and null from {@code getSchema()}, Oracle
     * returns the owning user from both. When no candidate owns a table, null keeps the original
     * "all schemas" behaviour.
     */
    private String resolveEffectiveSchema(Connection conn, DatabaseMetaData meta)
            throws SQLException {
        if (schema != null && !schema.isBlank()) {
            return schema;
        }
        if (schemaResolved) {
            return effectiveSchema;
        }
        LinkedHashSet<String> candidates = new LinkedHashSet<>();
        try {
            addCandidate(candidates, conn.getSchema());
        } catch (SQLException | AbstractMethodError e) {
            log.debug("getSchema() not supported by driver: {}", e.toString());
        }
        addCandidate(candidates, meta.getUserName());
        addCandidate(candidates, conn.getCatalog());

        String resolved = null;
        for (String candidate : candidates) {
            if (hasAnyTable(meta, candidate)) {
                resolved = candidate;
                break;
            }
        }
        effectiveSchema = resolved;
        schemaResolved = true;
        log.info(
                "JdbcConnector {}: no schema configured, resolved to {}",
                connectorId,
                resolved == null ? "all schemas" : resolved);
        return resolved;
    }

    private static void addCandidate(Set<String> target, String value) {
        if (value != null && !value.isBlank()) {
            target.add(value);
        }
    }

    private static boolean hasAnyTable(DatabaseMetaData meta, String schemaName) throws SQLException {
        try (ResultSet rs = meta.getTables(null, schemaName, "%", new String[] {"TABLE", "VIEW"})) {
            return rs.next();
        }
    }

    /** LLM-supplied table ids are matched case-insensitively against the live module list. */
    private String resolveTableName(String moduleId) {
        if (moduleId == null) {
            return null;
        }
        for (ModuleInfo m : listModules()) {
            if (m.id().equalsIgnoreCase(moduleId)) {
                return m.id();
            }
        }
        return moduleId;
    }

    private String moduleLabel(String table) {
        for (ModuleInfo m : listModules()) {
            if (m.id().equalsIgnoreCase(table)) {
                return m.name();
            }
        }
        return table;
    }

    private String resolveColumn(String table, String fieldId) {
        if (fieldId == null || table == null) {
            return fieldId;
        }
        Map<String, String> caseMap =
                columnCaseCache.computeIfAbsent(table.toLowerCase(Locale.ROOT), k -> {
                    try (Connection conn = dataSource.getConnection()) {
                        return toCaseMap(readColumns(conn.getMetaData(), resolveEffectiveSchema(conn, conn.getMetaData()), table));
                    } catch (SQLException e) {
                        log.warn("Could not load columns of {}: {}", table, e.getMessage());
                        return Map.of();
                    }
                });
        String actual = caseMap.get(fieldId.toLowerCase(Locale.ROOT));
        return actual != null ? actual : fieldId;
    }

    private static List<ColumnMeta> readColumns(DatabaseMetaData meta, String eff, String table)
            throws SQLException {
        List<ColumnMeta> columns = new ArrayList<>();
        try (ResultSet rs = meta.getColumns(null, eff, table, "%")) {
            while (rs.next()) {
                String colName = rs.getString("COLUMN_NAME");
                if (colName == null || colName.isBlank()) {
                    continue;
                }
                String typeName = rs.getString("TYPE_NAME");
                String remarks = rs.getString("REMARKS");
                String label = remarks != null && !remarks.isBlank() ? remarks : colName;
                columns.add(new ColumnMeta(new FieldInfo(colName, label, typeName), colName.toLowerCase(Locale.ROOT)));
            }
        }
        return columns;
    }

    private static Map<String, String> toCaseMap(List<ColumnMeta> columns) {
        Map<String, String> caseMap = new LinkedHashMap<>();
        for (ColumnMeta c : columns) {
            caseMap.put(c.lowerName(), c.field().id());
        }
        return Map.copyOf(caseMap);
    }

    // ---------------------------------------------------------------- SQL building

    private String buildWhere(String table, DataConnector.QueryFilter filter, List<Object> params) {
        List<DataConnector.QueryFilter.Condition> conditions =
                filter.conditions() == null ? List.of() : filter.conditions();
        List<String> clauses = new ArrayList<>();
        for (DataConnector.QueryFilter.Condition c : conditions) {
            String clause = buildCondition(table, c, params);
            if (clause != null) {
                clauses.add(clause);
            }
        }
        return clauses.isEmpty() ? "" : " WHERE " + String.join(" AND ", clauses);
    }

    private String buildOrderBy(String table, DataConnector.QueryFilter filter) {
        List<DataConnector.QueryFilter.OrderBy> orderBy =
                filter.orderByList() == null ? List.of() : filter.orderByList();
        if (orderBy.isEmpty()) {
            return "";
        }
        List<String> parts = new ArrayList<>();
        for (DataConnector.QueryFilter.OrderBy ob : orderBy) {
            if (ob == null || ob.fieldId() == null) {
                continue;
            }
            String dir = "desc".equalsIgnoreCase(ob.direction()) ? " DESC" : " ASC";
            parts.add(quoteIdentifier(resolveColumn(table, ob.fieldId())) + dir);
        }
        return parts.isEmpty() ? "" : " ORDER BY " + String.join(", ", parts);
    }

    private String buildCondition(
            String table, DataConnector.QueryFilter.Condition c, List<Object> params) {
        String col = quoteIdentifier(resolveColumn(table, c.fieldId()));
        String op = c.operator() != null ? c.operator().toLowerCase(Locale.ROOT) : "eq";
        switch (op) {
            case "eq", "=", "==" -> {
                params.add(c.value());
                return col + " = ?";
            }
            case "ne", "!=", "<>" -> {
                params.add(c.value());
                return col + " <> ?";
            }
            case "gt", ">" -> {
                params.add(c.value());
                return col + " > ?";
            }
            case "ge", ">=" -> {
                params.add(c.value());
                return col + " >= ?";
            }
            case "lt", "<" -> {
                params.add(c.value());
                return col + " < ?";
            }
            case "le", "<=" -> {
                params.add(c.value());
                return col + " <= ?";
            }
            case "contains", "like" -> {
                params.add("%" + escapeLike(c.value()) + "%");
                return col + " LIKE ? ESCAPE '\\'";
            }
            case "startswith" -> {
                params.add(escapeLike(c.value()) + "%");
                return col + " LIKE ? ESCAPE '\\'";
            }
            case "endswith" -> {
                params.add("%" + escapeLike(c.value()));
                return col + " LIKE ? ESCAPE '\\'";
            }
            case "isnull" -> {
                return col + " IS NULL";
            }
            case "isnotnull" -> {
                return col + " IS NOT NULL";
            }
            case "in" -> {
                if (c.value() instanceof List<?> list && !list.isEmpty()) {
                    String placeholders = String.join(",", Collections.nCopies(list.size(), "?"));
                    params.addAll(list);
                    return col + " IN (" + placeholders + ")";
                }
                return "1=1";
            }
            case "between" -> {
                if (c.value() instanceof List<?> list && list.size() >= 2) {
                    params.add(list.get(0));
                    params.add(list.get(1));
                    return col + " BETWEEN ? AND ?";
                }
                params.add(c.value());
                return col + " = ?";
            }
            default -> {
                params.add(c.value());
                return col + " = ?";
            }
        }
    }

    private static void bind(PreparedStatement stmt, List<Object> params) throws SQLException {
        for (int i = 0; i < params.size(); i++) {
            stmt.setObject(i + 1, params.get(i));
        }
    }

    private static String escapeLike(Object value) {
        if (value == null) {
            return "";
        }
        return value.toString()
                .replace("\\", "\\\\")
                .replace("%", "\\%")
                .replace("_", "\\_");
    }

    private void appendPagination(StringBuilder sql, List<Object> params, int limit, int offset) {
        PaginationDialect d = resolveDialect();
        if (d == PaginationDialect.LIMIT_OFFSET) {
            sql.append(" LIMIT ? OFFSET ?");
            params.add(limit);
            params.add(offset);
        } else {
            if (!sql.toString().toUpperCase(Locale.ROOT).contains("ORDER BY")) {
                sql.append(" ORDER BY 1");
            }
            sql.append(" OFFSET ? ROWS FETCH NEXT ? ROWS ONLY");
            params.add(offset);
            params.add(limit);
        }
    }

    /**
     * Detects the pagination dialect by asking the server which syntax it accepts. Product names
     * are not enough: OceanBase reports its own name in both Oracle and MySQL mode, so the old
     * heuristic would pick LIMIT/OFFSET even for an Oracle-mode tenant.
     */
    private PaginationDialect resolveDialect() {
        PaginationDialect d = dialect;
        if (d != null) {
            return d;
        }
        PaginationDialect detected;
        try (Connection conn = dataSource.getConnection()) {
            if (probe(conn, "SELECT 1 ORDER BY 1 OFFSET 0 ROWS FETCH NEXT 1 ROWS ONLY")
                    || probe(conn, "SELECT 1 FROM DUAL ORDER BY 1 OFFSET 0 ROWS FETCH NEXT 1 ROWS ONLY")) {
                detected = PaginationDialect.OFFSET_FETCH;
            } else if (probe(conn, "SELECT 1 LIMIT 1")) {
                detected = PaginationDialect.LIMIT_OFFSET;
            } else {
                String product = conn.getMetaData().getDatabaseProductName().toLowerCase(Locale.ROOT);
                detected = product.contains("oracle") || product.contains("sql server") || product.contains("microsoft")
                        ? PaginationDialect.OFFSET_FETCH
                        : PaginationDialect.LIMIT_OFFSET;
                log.warn(
                        "No pagination probe succeeded for product '{}', falling back to {}",
                        product,
                        detected);
            }
        } catch (SQLException e) {
            log.warn("Could not detect DB dialect, defaulting to LIMIT/OFFSET: {}", e.getMessage());
            detected = PaginationDialect.LIMIT_OFFSET;
        }
        dialect = detected;
        log.info("JdbcConnector {}: pagination dialect = {}", connectorId, detected);
        return detected;
    }

    private static boolean probe(Connection conn, String sql) {
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setQueryTimeout(PROBE_TIMEOUT_SECONDS);
            try (ResultSet rs = ps.executeQuery()) {
                rs.next();
                return true;
            }
        } catch (SQLException e) {
            return false;
        }
    }

    private static final java.util.regex.Pattern SAFE_IDENTIFIER =
            java.util.regex.Pattern.compile("^[A-Za-z_][A-Za-z0-9_]{0,127}$");

    /**
     * Validates and double-quotes an identifier. Anything beyond [A-Za-z0-9_] is rejected before it
     * can reach the database.
     */
    private static String quoteIdentifier(String name) {
        if (name == null || !SAFE_IDENTIFIER.matcher(name).matches()) {
            throw new IllegalArgumentException("Unsafe SQL identifier rejected: " + name);
        }
        return "\"" + name.replace("\"", "\"\"") + "\"";
    }

    enum PaginationDialect {
        LIMIT_OFFSET,
        OFFSET_FETCH
    }
}
