package com.aiassistant.config;

import static org.junit.jupiter.api.Assertions.*;

import java.util.Set;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

class TenantContextTest {

    @AfterEach
    void cleanup() {
        TenantContext.clear();
    }

    @Test
    void defaultTenantId_isDefault() {
        assertEquals("default", TenantContext.tenantId());
    }

    @Test
    void setAndGet_preservesTenantInfo() {
        var info = new TenantContext.TenantInfo("t1", "Tenant One", "gpt-4", 100, Set.of("conn1"));
        TenantContext.set(info);

        assertEquals("t1", TenantContext.tenantId());
        assertEquals("Tenant One", TenantContext.get().displayName());
        assertEquals("gpt-4", TenantContext.get().model());
        assertEquals(100, TenantContext.get().rateLimit());
        assertTrue(TenantContext.get().allowedConnectors().contains("conn1"));
    }

    @Test
    void clear_resetsTenantToDefault() {
        TenantContext.set(new TenantContext.TenantInfo("t2"));
        assertEquals("t2", TenantContext.tenantId());
        TenantContext.clear();
        assertEquals("default", TenantContext.tenantId());
    }

    @Test
    void shortConstructor_setsDefaults() {
        var info = new TenantContext.TenantInfo("t3");
        assertEquals("t3", info.tenantId());
        assertEquals("t3", info.displayName());
        assertNull(info.model());
        assertEquals(0, info.rateLimit());
        assertTrue(info.allowedConnectors().isEmpty());
    }

    @Test
    void threadIsolation() throws InterruptedException {
        TenantContext.set(new TenantContext.TenantInfo("main"));

        Thread other =
                new Thread(
                        () -> {
                            assertNull(TenantContext.get());
                            assertEquals("default", TenantContext.tenantId());
                        });
        other.start();
        other.join();

        assertEquals("main", TenantContext.tenantId());
    }
}
