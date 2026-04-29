package com.aiassistant.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletRequestWrapper;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Rewrites /api/v1/ai-assistant/* to /ai-assistant/* for backward-compatible API versioning.
 * Clients can use either /ai-assistant/chat or /api/v1/ai-assistant/chat. The Accept-Version header
 * is also supported (e.g., Accept-Version: v1).
 */
public class ApiVersionConfig {

    public static final String V1_PREFIX = "/api/v1";

    private ApiVersionConfig() {}

    public static class ApiVersionFilter extends OncePerRequestFilter {

        private final String contextPath;

        public ApiVersionFilter(String contextPath) {
            this.contextPath = contextPath;
        }

        @Override
        protected void doFilterInternal(
                HttpServletRequest request, HttpServletResponse response, FilterChain chain)
                throws ServletException, IOException {
            String uri = request.getRequestURI();
            String versionedPrefix = V1_PREFIX + contextPath;
            if (uri.startsWith(versionedPrefix)) {
                String rewritten = contextPath + uri.substring(versionedPrefix.length());
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
