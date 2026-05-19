package com.aiassistant.security;

import static org.junit.jupiter.api.Assertions.*;

import java.util.Set;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

/**
 * 覆盖 {@link RbacProvider} SPI 默认实现 {@code AllowAll} + {@code hasPermission} default 方法。这是产品默认的 RBAC
 * 装配（在 ai-assistant.security.RbacProvider Bean 缺省时生效）。
 *
 * <p>Provided by T3-Wave2 coverage recovery.
 */
class RbacProviderTest {

    @Nested
    @DisplayName("AllowAll 默认实现")
    class AllowAllImpl {

        private final RbacProvider provider = new RbacProvider.AllowAll();

        @Test
        @DisplayName("getPermissions 返回所有 RbacPermission 枚举值")
        void grantsAllPermissionsForAnyTenantUser() {
            Set<RbacPermission> perms = provider.getPermissions("tenant-a", "user-1");
            for (RbacPermission p : RbacPermission.values()) {
                assertTrue(perms.contains(p), "AllowAll should grant " + p);
            }
            assertEquals(RbacPermission.values().length, perms.size());
        }

        @Test
        @DisplayName("hasPermission 对所有 RbacPermission 返回 true")
        void hasPermissionAlwaysTrue() {
            for (RbacPermission p : RbacPermission.values()) {
                assertTrue(provider.hasPermission("any-tenant", "any-user", p));
            }
        }

        @Test
        @DisplayName("hasPermission 在 null tenant / null user 时仍生效（AllowAll 不区分）")
        void hasPermissionWithNullTenantOrUser() {
            for (RbacPermission p : RbacPermission.values()) {
                assertTrue(provider.hasPermission(null, "u", p));
                assertTrue(provider.hasPermission("t", null, p));
                assertTrue(provider.hasPermission(null, null, p));
            }
        }
    }

    @Nested
    @DisplayName("自定义 RbacProvider 实现")
    class CustomImpl {

        @Test
        @DisplayName("hasPermission default 方法委托给 getPermissions")
        void defaultHasPermissionDelegatesToGetPermissions() {
            RbacPermission targetPerm = RbacPermission.values()[0];
            RbacProvider provider =
                    (tenantId, userId) -> {
                        if ("vip".equals(tenantId)) return Set.of(targetPerm);
                        return Set.of();
                    };
            assertTrue(provider.hasPermission("vip", "u1", targetPerm));
            assertFalse(provider.hasPermission("free", "u1", targetPerm));
        }

        @Test
        @DisplayName("getPermissions 返回空集时 hasPermission 全部为 false")
        void emptyPermissionsBlocksAll() {
            RbacProvider denyAll = (t, u) -> Set.of();
            for (RbacPermission p : RbacPermission.values()) {
                assertFalse(denyAll.hasPermission("t", "u", p));
            }
        }
    }
}
