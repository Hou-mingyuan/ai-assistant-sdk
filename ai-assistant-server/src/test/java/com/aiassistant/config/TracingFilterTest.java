package com.aiassistant.config;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.slf4j.MDC;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

class TracingFilterTest {

    private static final String VALID_TRACE_ID = "4bf92f3577b34da6a3ce929d0e0e4736";
    private static final String VALID_TRACEPARENT = "00-" + VALID_TRACE_ID + "-00f067aa0ba902b7-01";

    private final TracingFilter filter = new TracingFilter();

    @Test
    void acceptsValidTraceAndContextHeaders() throws Exception {
        MockHttpServletRequest request = request();
        request.addHeader("traceparent", VALID_TRACEPARENT);
        request.addHeader("X-Tenant-Id", " tenant.prod-01 ");
        request.addHeader("X-User-Id", "user_123");
        MockHttpServletResponse response = new MockHttpServletResponse();
        FilterChain chain =
                (req, res) -> {
                    assertEquals(VALID_TRACE_ID, MDC.get("traceId"));
                    assertTrue(MDC.get("spanId").matches("[a-f0-9]{16}"));
                    assertEquals("tenant.prod-01", MDC.get("tenantId"));
                    assertEquals("user_123", MDC.get("userId"));
                };

        filter.doFilter(request, response, chain);

        assertEquals(VALID_TRACE_ID, response.getHeader("X-Trace-Id"));
        assertMdcCleared();
    }

    @Test
    void usesSafeRequestIdWhenTraceparentIsInvalid() throws Exception {
        MockHttpServletRequest request = request();
        request.addHeader("traceparent", "not-a-traceparent");
        request.addHeader("X-Request-Id", " request_123 ");
        MockHttpServletResponse response = new MockHttpServletResponse();
        FilterChain chain = (req, res) -> assertEquals("request_123", MDC.get("traceId"));

        filter.doFilter(request, response, chain);

        assertEquals("request_123", response.getHeader("X-Trace-Id"));
        assertMdcCleared();
    }

    @Test
    void rejectsUnsafeCallerControlledLogFields() throws Exception {
        MockHttpServletRequest request = request();
        request.addHeader("traceparent", "00-4bf92f3577b34da6a3ce929d0e0e473Z-00f067aa0ba902b7-01");
        request.addHeader("X-Request-Id", "request\nspoofed");
        request.addHeader("X-Tenant-Id", "tenant\nspoofed");
        request.addHeader("X-User-Id", "user<script>");
        MockHttpServletResponse response = new MockHttpServletResponse();
        FilterChain chain =
                (req, res) -> {
                    assertTrue(MDC.get("traceId").matches("[a-f0-9]{32}"));
                    assertNull(MDC.get("tenantId"));
                    assertNull(MDC.get("userId"));
                };

        filter.doFilter(request, response, chain);

        assertTrue(response.getHeader("X-Trace-Id").matches("[a-f0-9]{32}"));
        assertMdcCleared();
    }

    @ParameterizedTest
    @ValueSource(
            strings = {
                "00-00000000000000000000000000000000-00f067aa0ba902b7-01",
                "00-4bf92f3577b34da6a3ce929d0e0e4736-0000000000000000-01",
                "ff-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
                "00-4BF92F3577B34DA6A3CE929D0E0E4736-00f067aa0ba902b7-01"
            })
    void rejectsInvalidW3cTraceparent(String traceparent) throws Exception {
        MockHttpServletRequest request = request();
        request.addHeader("traceparent", traceparent);
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, (req, res) -> {});

        String generated = response.getHeader("X-Trace-Id");
        assertTrue(generated.matches("[a-f0-9]{32}"));
        assertTrue(!traceparent.contains(generated));
        assertMdcCleared();
    }

    @Test
    void clearsMdcWhenDownstreamFails() {
        MockHttpServletRequest request = request();
        request.addHeader("traceparent", VALID_TRACEPARENT);
        request.addHeader("X-Tenant-Id", "tenant-1");
        MockHttpServletResponse response = new MockHttpServletResponse();
        FilterChain chain =
                (req, res) -> {
                    throw new ServletException("boom");
                };

        assertThrows(ServletException.class, () -> filter.doFilter(request, response, chain));

        assertMdcCleared();
    }

    private MockHttpServletRequest request() {
        return new MockHttpServletRequest("POST", "/ai-assistant/chat");
    }

    private void assertMdcCleared() {
        assertNull(MDC.get("traceId"));
        assertNull(MDC.get("spanId"));
        assertNull(MDC.get("tenantId"));
        assertNull(MDC.get("userId"));
    }
}
