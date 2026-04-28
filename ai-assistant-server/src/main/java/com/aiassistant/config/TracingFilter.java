package com.aiassistant.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.UUID;
import org.slf4j.MDC;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Populates MDC with traceId, spanId, tenantId, userId for structured logging.
 * Picks up existing trace headers (W3C traceparent, X-Request-Id) or generates new ones.
 */
public class TracingFilter extends OncePerRequestFilter {

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {
        try {
            String traceId = extractTraceId(request);
            String spanId = generateSpanId();

            MDC.put("traceId", traceId);
            MDC.put("spanId", spanId);

            String tenantId = request.getHeader("X-Tenant-Id");
            if (tenantId != null && !tenantId.isBlank()) {
                MDC.put("tenantId", tenantId);
            }

            String userId = request.getHeader("X-User-Id");
            if (userId != null && !userId.isBlank()) {
                MDC.put("userId", userId);
            }

            response.setHeader("X-Trace-Id", traceId);
            chain.doFilter(request, response);
        } finally {
            MDC.clear();
        }
    }

    private String extractTraceId(HttpServletRequest request) {
        String traceparent = request.getHeader("traceparent");
        if (traceparent != null && traceparent.length() >= 55) {
            return traceparent.substring(3, 35);
        }
        String requestId = request.getHeader("X-Request-Id");
        if (requestId != null && !requestId.isBlank()) {
            return requestId;
        }
        return UUID.randomUUID().toString().replace("-", "");
    }

    private String generateSpanId() {
        return UUID.randomUUID().toString().replace("-", "").substring(0, 16);
    }
}
