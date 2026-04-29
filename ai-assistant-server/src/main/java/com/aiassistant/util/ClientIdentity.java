package com.aiassistant.util;

import jakarta.servlet.http.HttpServletRequest;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;

/**
 * Resolves a stable client identifier from the HTTP request. Priority: X-AI-Token header > first IP
 * in X-Forwarded-For > remoteAddr.
 */
public final class ClientIdentity {

    private ClientIdentity() {}

    public static String resolve(HttpServletRequest request) {
        String token = request.getHeader("X-AI-Token");
        if (token != null && !token.isBlank()) return "token:" + tokenFingerprint(token);
        String xff = request.getHeader("X-Forwarded-For");
        if (xff != null && !xff.isBlank()) {
            return "ip:" + xff.split(",")[0].trim();
        }
        return "ip:" + request.getRemoteAddr();
    }

    public static String tokenFingerprint(String token) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(token.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash, 0, 16);
        } catch (NoSuchAlgorithmException e) {
            return Integer.toHexString(token.hashCode());
        }
    }
}
