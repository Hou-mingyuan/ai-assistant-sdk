package com.aiassistant.config;

import jakarta.servlet.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.io.IOException;

/**
 * Enables GZIP compression for SSE /stream endpoints when the client supports it.
 * Spring's default compression config often excludes text/event-stream;
 * this filter explicitly sets the Content-Encoding header so the container compresses.
 */
public class SseCompressionFilter implements Filter {

    private final String contextPath;

    public SseCompressionFilter(String contextPath) {
        this.contextPath = contextPath;
    }

    @Override
    public void doFilter(ServletRequest req, ServletResponse res, FilterChain chain)
            throws IOException, ServletException {
        HttpServletRequest request = (HttpServletRequest) req;
        HttpServletResponse response = (HttpServletResponse) res;
        String path = request.getRequestURI();

        if (path.startsWith(contextPath) && path.endsWith("/stream")) {
            String accept = request.getHeader("Accept-Encoding");
            if (accept != null && accept.contains("gzip")) {
                response.setHeader("Content-Encoding", "gzip");
            }
        }
        chain.doFilter(req, res);
    }
}
