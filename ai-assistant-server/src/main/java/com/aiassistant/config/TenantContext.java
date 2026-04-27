package com.aiassistant.config;

/**
 * Thread-local tenant context for multi-tenant isolation.
 * Set by authentication filters; consumed by services for
 * per-tenant model/connector/quota resolution.
 */
public final class TenantContext {

    private static final ThreadLocal<TenantInfo> CURRENT = new ThreadLocal<>();

    private TenantContext() {}

    public static void set(TenantInfo tenant) {
        CURRENT.set(tenant);
    }

    public static TenantInfo get() {
        return CURRENT.get();
    }

    public static void clear() {
        CURRENT.remove();
    }

    public static String tenantId() {
        TenantInfo t = CURRENT.get();
        return t != null ? t.tenantId() : "default";
    }

    public record TenantInfo(
            String tenantId,
            String displayName,
            String model,
            int rateLimit,
            java.util.Set<String> allowedConnectors
    ) {
        public TenantInfo(String tenantId) {
            this(tenantId, tenantId, null, 0, java.util.Set.of());
        }
    }
}
