package com.aiassistant.security;

import java.util.Set;

/**
 * SPI for role-based access control.
 * Implement and register as a Spring Bean to enforce per-tenant/per-user permissions.
 * Default implementation allows all operations.
 */
public interface RbacProvider {

    /**
     * Get the permissions for the given tenant/user combination.
     * @param tenantId tenant identifier (from X-Tenant-Id header)
     * @param userId user identifier (from authentication context)
     * @return set of granted permissions
     */
    Set<RbacPermission> getPermissions(String tenantId, String userId);

    /**
     * Check if the tenant/user has the given permission.
     */
    default boolean hasPermission(String tenantId, String userId, RbacPermission permission) {
        return getPermissions(tenantId, userId).contains(permission);
    }

    /**
     * Default implementation that grants all permissions.
     */
    class AllowAll implements RbacProvider {
        @Override
        public Set<RbacPermission> getPermissions(String tenantId, String userId) {
            return Set.of(RbacPermission.values());
        }
    }
}
