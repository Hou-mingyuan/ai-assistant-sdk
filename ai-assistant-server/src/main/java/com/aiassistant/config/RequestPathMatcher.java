package com.aiassistant.config;

/**
 * Shared request-path boundary matcher for assistant servlet filters.
 * <p>Only a request exactly at the configured context path, or below it as a
 * child path, is considered in scope. This avoids treating paths such as
 * {@code /ai-assistant2/chat} as if they belonged to {@code /ai-assistant}.</p>
 */
final class RequestPathMatcher {

    private RequestPathMatcher() {
    }

    static boolean matchesContextPath(String requestUri, String contextPath) {
        if (requestUri == null || contextPath == null || contextPath.isBlank()) {
            return false;
        }
        String context = normalizeContextPath(contextPath);
        return requestUri.equals(context) || requestUri.startsWith(context + "/");
    }

    private static String normalizeContextPath(String contextPath) {
        String normalized = contextPath.trim();
        if (!normalized.startsWith("/")) {
            normalized = "/" + normalized;
        }
        while (normalized.length() > 1 && normalized.endsWith("/")) {
            normalized = normalized.substring(0, normalized.length() - 1);
        }
        return normalized;
    }
}
