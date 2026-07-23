package com.aiassistant.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.slf4j.MDC;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Populates MDC with traceId, spanId, tenantId, userId for structured logging. Picks up existing
 * trace headers (W3C traceparent, X-Request-Id) or generates new ones.
 */
public class TracingFilter extends OncePerRequestFilter {

    private static final String ZERO_TRACE_ID = "00000000000000000000000000000000";
    private static final String ZERO_PARENT_ID = "0000000000000000";
    private static final Pattern TRACEPARENT_V00 =
            Pattern.compile("^00-([0-9a-f]{32})-([0-9a-f]{16})-[0-9a-f]{2}$");
    private static final Pattern SAFE_REQUEST_ID = Pattern.compile("[a-zA-Z0-9_\\-]{1,64}");
    private static final Pattern SAFE_CONTEXT_ID = Pattern.compile("[a-zA-Z0-9_.:\\-]{1,64}");

    @Override
    protected void doFilterInternal(
            HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        try {
            String traceId = extractTraceId(request);
            String spanId = generateSpanId();

            MDC.put("traceId", traceId);
            MDC.put("spanId", spanId);

            String tenantId = normalizeHeader(request.getHeader("X-Tenant-Id"), SAFE_CONTEXT_ID);
            if (tenantId != null) {
                MDC.put("tenantId", tenantId);
            }

            String userId = normalizeHeader(request.getHeader("X-User-Id"), SAFE_CONTEXT_ID);
            if (userId != null) {
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
        if (traceparent != null) {
            Matcher matcher = TRACEPARENT_V00.matcher(traceparent);
            if (matcher.matches()
                    && !ZERO_TRACE_ID.equals(matcher.group(1))
                    && !ZERO_PARENT_ID.equals(matcher.group(2))) {
                return matcher.group(1);
            }
        }
        String requestId = normalizeHeader(request.getHeader("X-Request-Id"), SAFE_REQUEST_ID);
        if (requestId != null) {
            return requestId;
        }
        return UUID.randomUUID().toString().replace("-", "");
    }

    private String normalizeHeader(String value, Pattern allowed) {
        if (value == null || value.isBlank() || value.length() > 64) {
            return null;
        }
        String normalized = value.trim();
        return allowed.matcher(normalized).matches() ? normalized : null;
    }

    private String generateSpanId() {
        return UUID.randomUUID().toString().replace("-", "").substring(0, 16);
    }
}
