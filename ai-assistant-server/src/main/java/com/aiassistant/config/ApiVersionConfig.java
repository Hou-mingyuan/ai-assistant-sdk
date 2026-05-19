package com.aiassistant.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletRequestWrapper;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Rewrites versioned aliases to the base routed context path for backward-compatible API
 * versioning.
 *
 * <p>Controllers stay mounted under {@code ai-assistant.context-path}; when {@code
 * ai-assistant.api-version} is configured, clients may call either {@code /ai-assistant/v1/*} or
 * {@code /api/v1/ai-assistant/*}. The filter rewrites both aliases back to the base controller
 * path.
 */
public class ApiVersionConfig {

    public static final String V1_PREFIX = "/api/v1";

    private ApiVersionConfig() {}

    public static String resolveExternalPrefix(String contextPath, String apiVersion) {
        return V1_PREFIX + baseContextPath(contextPath, apiVersion);
    }

    public static String resolveVersionedContextPath(String contextPath, String apiVersion) {
        if (apiVersion == null || apiVersion.isBlank()) {
            return null;
        }
        return baseContextPath(contextPath, apiVersion) + versionSegment(apiVersion);
    }

    public static String[] resolveAssistantUrlPatterns(String contextPath, String apiVersion) {
        java.util.LinkedHashSet<String> patterns = new java.util.LinkedHashSet<>();
        String base = baseContextPath(contextPath, apiVersion);
        patterns.add(base + "/*");
        String versioned = resolveVersionedContextPath(base, apiVersion);
        if (versioned != null) {
            patterns.add(versioned + "/*");
        }
        patterns.add(resolveExternalPrefix(base, apiVersion) + "/*");
        return patterns.toArray(String[]::new);
    }

    public static String[] resolveAdminUrlPatterns(String contextPath, String apiVersion) {
        java.util.LinkedHashSet<String> patterns = new java.util.LinkedHashSet<>();
        String base = baseContextPath(contextPath, apiVersion);
        patterns.add(base + "/admin/*");
        String versioned = resolveVersionedContextPath(base, apiVersion);
        if (versioned != null) {
            patterns.add(versioned + "/admin/*");
        }
        patterns.add(resolveExternalPrefix(base, apiVersion) + "/admin/*");
        return patterns.toArray(String[]::new);
    }

    static String baseContextPath(String contextPath, String apiVersion) {
        if (apiVersion == null || apiVersion.isBlank()) {
            return contextPath;
        }
        String segment = versionSegment(apiVersion);
        if (contextPath.endsWith(segment)) {
            return contextPath.substring(0, contextPath.length() - segment.length());
        }
        return contextPath;
    }

    private static String versionSegment(String apiVersion) {
        String segment = apiVersion.trim();
        return segment.startsWith("/") ? segment : "/" + segment;
    }

    private static boolean matchesPrefix(String uri, String prefix) {
        return uri.equals(prefix) || uri.startsWith(prefix + "/");
    }

    public static class ApiVersionFilter extends OncePerRequestFilter {

        private final String baseContextPath;
        private final String externalPrefix;
        private final String versionedContextPath;

        public ApiVersionFilter(String contextPath, String apiVersion) {
            this.baseContextPath = baseContextPath(contextPath, apiVersion);
            this.externalPrefix = resolveExternalPrefix(contextPath, apiVersion);
            this.versionedContextPath = resolveVersionedContextPath(contextPath, apiVersion);
        }

        @Override
        protected void doFilterInternal(
                HttpServletRequest request, HttpServletResponse response, FilterChain chain)
                throws ServletException, IOException {
            String uri = request.getRequestURI();
            if (matchesPrefix(uri, externalPrefix)) {
                String rewritten = baseContextPath + uri.substring(externalPrefix.length());
                chain.doFilter(new RewrittenRequest(request, rewritten), response);
            } else if (versionedContextPath != null && matchesPrefix(uri, versionedContextPath)) {
                String rewritten = baseContextPath + uri.substring(versionedContextPath.length());
                chain.doFilter(new RewrittenRequest(request, rewritten), response);
            } else {
                chain.doFilter(request, response);
            }
        }
    }

    private static class RewrittenRequest extends HttpServletRequestWrapper {
        private final String newUri;

        RewrittenRequest(HttpServletRequest request, String newUri) {
            super(request);
            this.newUri = newUri;
        }

        @Override
        public String getRequestURI() {
            return newUri;
        }

        @Override
        public String getServletPath() {
            return newUri;
        }
    }
}
