package com.aiassistant.util;

import jakarta.servlet.http.HttpServletRequest;

/**
 * Resolves a stable client identifier from the HTTP request.
 * Priority: X-AI-Token header > first IP in X-Forwarded-For > remoteAddr.
 */
public final class ClientIdentity {

    private ClientIdentity() {}

    public static String resolve(HttpServletRequest request) {
        String token = request.getHeader("X-AI-Token");
        if (token != null && !token.isBlank()) return "token:" + token;
        String xff = request.getHeader("X-Forwarded-For");
        if (xff != null && !xff.isBlank()) {
            return "ip:" + xff.split(",")[0].trim();
        }
        return "ip:" + request.getRemoteAddr();
    }
}
