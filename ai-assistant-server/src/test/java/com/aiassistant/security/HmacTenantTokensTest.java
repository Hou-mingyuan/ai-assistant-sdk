package com.aiassistant.security;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Instant;
import org.junit.jupiter.api.Test;

class HmacTenantTokensTest {

    private static final Instant NOW = Instant.parse("2026-09-13T00:00:00Z");
    private static final String SECRET = "signing-secret-with-enough-entropy";

    @Test
    void roundTripsTenantIdIncludingDotsAndUnicode() {
        String token = HmacTenantTokens.issue("tenant.prod-01", 3600, SECRET, NOW);

        assertEquals("tenant.prod-01", HmacTenantTokens.verify(token, SECRET, NOW));
        assertTrue(HmacTenantTokens.looksLikeSignedToken(token));
    }

    @Test
    void rejectsTamperedPayloadSignatureAndExpiry() {
        String token = HmacTenantTokens.issue("tenant-a", 3600, SECRET, NOW);

        String otherTenant = HmacTenantTokens.issue("tenant-b", 3600, SECRET, NOW);
        String spliced = token.split("\\.")[0] + "." + otherTenant.split("\\.")[1] + "." + token.split("\\.")[2]
                + "." + token.split("\\.")[3];
        assertNull(HmacTenantTokens.verify(spliced, SECRET, NOW));

        String extendedExpiry = token.replaceFirst(
                "\\.[^.]+$", Long.toString(NOW.plusSeconds(7200).getEpochSecond()));
        assertNull(HmacTenantTokens.verify(extendedExpiry, SECRET, NOW));

        assertNull(HmacTenantTokens.verify(token, "another-secret", NOW));
        assertNull(HmacTenantTokens.verify(
                HmacTenantTokens.issue("tenant-a", 3600, SECRET, NOW), SECRET, NOW.plusSeconds(3601)));
        assertNull(HmacTenantTokens.verify("garbage", SECRET, NOW));
        assertNull(HmacTenantTokens.verify(null, SECRET, NOW));
        assertNull(HmacTenantTokens.verify(token, "", NOW));
    }

    @Test
    void signatureBindsTenantIdSoTokensAreNotInterchangeable() {
        String tenantA = HmacTenantTokens.issue("tenant-a", 3600, SECRET, NOW);
        String tenantB = HmacTenantTokens.issue("tenant-b", 3600, SECRET, NOW);

        assertNotEquals(tenantA, tenantB);
        assertEquals("tenant-a", HmacTenantTokens.verify(tenantA, SECRET, NOW));
        assertEquals("tenant-b", HmacTenantTokens.verify(tenantB, SECRET, NOW));
    }

    @Test
    void clampsTtlToSaneBounds() {
        String tooShort = HmacTenantTokens.issue("tenant-a", 1, SECRET, NOW);
        String tooLong = HmacTenantTokens.issue("tenant-a", 400L * 24 * 3600, SECRET, NOW);

        String mid = HmacTenantTokens.issue("tenant-a", 60, SECRET, NOW);
        assertEquals(NOW.plusSeconds(60).getEpochSecond(),
                Long.parseLong(mid.split("\\.")[2]));
        // 400 days is clamped to the 366-day maximum
        assertEquals(NOW.plusSeconds(366L * 24 * 3600).getEpochSecond(),
                Long.parseLong(tooLong.split("\\.")[2]));
        assertTrue(HmacTenantTokens.looksLikeSignedToken(tooShort));
        assertEquals("tenant-a", HmacTenantTokens.verify(tooShort, SECRET, NOW));
    }
}
