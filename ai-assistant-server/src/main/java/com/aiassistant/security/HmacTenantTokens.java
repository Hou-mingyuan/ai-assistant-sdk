package com.aiassistant.security;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.Base64;

/**
 * Stateless per-tenant bearer tokens for the {@code hmac} auth mode.
 *
 * <p>Token format: {@code v1.<base64url(tenantId)>.<expiryEpochSeconds>.<base64url(hmac-sha256)>}.
 * The HMAC covers the prefix, the encoded tenant id and the expiry, so a token cannot be
 * forged, extended, or reused across tenants. Verification is constant-time. Tenant ids are
 * base64url-encoded to keep the dot-separated format unambiguous for any tenant naming scheme.
 */
public final class HmacTenantTokens {

    private static final String PREFIX = "v1";
    private static final long MIN_TTL_SECONDS = 60;
    private static final long MAX_TTL_SECONDS = 366L * 24 * 3600;

    private HmacTenantTokens() {
    }

    /**
     * Issues a signed tenant token.
     *
     * @throws IllegalArgumentException when tenant id is blank or the secret is missing
     */
    public static String issue(String tenantId, long ttlSeconds, String secret, Instant now) {
        if (tenantId == null || tenantId.isBlank()) {
            throw new IllegalArgumentException("tenantId must not be blank");
        }
        if (secret == null || secret.isBlank()) {
            throw new IllegalArgumentException("signing secret must not be blank");
        }
        long ttl = Math.min(Math.max(ttlSeconds, MIN_TTL_SECONDS), MAX_TTL_SECONDS);
        long expiry = now.plusSeconds(ttl).getEpochSecond();
        String encodedTenant = Base64.getUrlEncoder().withoutPadding()
                .encodeToString(tenantId.trim().getBytes(StandardCharsets.UTF_8));
        String payload = PREFIX + "." + encodedTenant + "." + expiry;
        String signature = Base64.getUrlEncoder().withoutPadding().encodeToString(hmac(payload, secret));
        return payload + "." + signature;
    }

    /**
     * Verifies a signed tenant token.
     *
     * @return the tenant id embedded in the token, or {@code null} when the token is malformed,
     *         expired, or fails the signature check
     */
    public static String verify(String token, String secret, Instant now) {
        if (token == null || secret == null || secret.isBlank()) {
            return null;
        }
        String[] parts = token.split("\\.");
        if (parts.length != 4 || !PREFIX.equals(parts[0]) || parts[1].isBlank()) {
            return null;
        }
        long expiry;
        try {
            expiry = Long.parseLong(parts[2]);
        } catch (NumberFormatException e) {
            return null;
        }
        if (expiry < now.getEpochSecond()) {
            return null;
        }
        byte[] expected = hmac(parts[0] + "." + parts[1] + "." + parts[2], secret);
        byte[] provided;
        try {
            provided = Base64.getUrlDecoder().decode(parts[3]);
        } catch (IllegalArgumentException e) {
            return null;
        }
        if (!MessageDigest.isEqual(expected, provided)) {
            return null;
        }
        String tenantId = new String(Base64.getUrlDecoder().decode(parts[1]), StandardCharsets.UTF_8).trim();
        return tenantId.isBlank() ? null : tenantId;
    }

    /** Cheap pre-check so filters can distinguish signed tokens from legacy shared secrets. */
    public static boolean looksLikeSignedToken(String token) {
        return token != null && token.startsWith(PREFIX + ".");
    }

    private static byte[] hmac(String payload, String secret) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            return mac.doFinal(payload.getBytes(StandardCharsets.UTF_8));
        } catch (Exception e) {
            throw new IllegalStateException("HMAC-SHA256 is unavailable on this JVM", e);
        }
    }
}
