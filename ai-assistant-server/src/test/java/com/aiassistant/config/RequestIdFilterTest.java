package com.aiassistant.config;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import jakarta.servlet.FilterChain;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.slf4j.MDC;

/**
 * 覆盖 {@link RequestIdFilter}：UUID 生成、X-Request-Id 透传 + 不安全字符 fallback、MDC 写入与 清理、非 context-path
 * 请求直接 passthrough。
 *
 * <p>Provided by T3-Wave3 coverage recovery.
 */
class RequestIdFilterTest {

    private static final String MDC_KEY = "requestId";
    private static final String HEADER = "X-Request-Id";
    private static final String CTX_PATH = "/ai-assistant";

    private final RequestIdFilter filter = new RequestIdFilter(CTX_PATH);

    @Test
    @DisplayName("命中 context-path 时生成 16 位 hex requestId 并写响应头")
    void generatesUuidRequestIdForContextPathRequest() throws Exception {
        HttpServletRequest req = mock(HttpServletRequest.class);
        HttpServletResponse res = mock(HttpServletResponse.class);
        FilterChain chain = mock(FilterChain.class);
        when(req.getRequestURI()).thenReturn(CTX_PATH + "/chat");
        when(req.getHeader(HEADER)).thenReturn(null);

        filter.doFilter(req, res, chain);

        verify(chain).doFilter(req, res);
        verify(res).setHeader(eq(HEADER), argThat(id -> id != null && id.matches("[a-f0-9]{16}")));
        assertNull(MDC.get(MDC_KEY), "MDC should be cleared after the chain");
    }

    @Test
    @DisplayName("非 context-path 请求 passthrough，不设响应头、不动 MDC")
    void passthroughForNonContextPath() throws Exception {
        HttpServletRequest req = mock(HttpServletRequest.class);
        HttpServletResponse res = mock(HttpServletResponse.class);
        FilterChain chain = mock(FilterChain.class);
        when(req.getRequestURI()).thenReturn("/api/v1/business");

        filter.doFilter(req, res, chain);

        verify(chain).doFilter(req, res);
        verify(res, never()).setHeader(eq(HEADER), anyString());
    }

    @Test
    @DisplayName("收到合法 X-Request-Id 透传保留")
    void honoursIncomingSafeRequestId() throws Exception {
        HttpServletRequest req = mock(HttpServletRequest.class);
        HttpServletResponse res = mock(HttpServletResponse.class);
        FilterChain chain = mock(FilterChain.class);
        when(req.getRequestURI()).thenReturn(CTX_PATH + "/chat");
        when(req.getHeader(HEADER)).thenReturn("trace-abc_123");

        filter.doFilter(req, res, chain);

        verify(res).setHeader(HEADER, "trace-abc_123");
    }

    @Test
    @DisplayName("不安全字符的 X-Request-Id 被忽略，回退到新生成 UUID")
    void rejectsUnsafeIncomingRequestId() throws Exception {
        HttpServletRequest req = mock(HttpServletRequest.class);
        HttpServletResponse res = mock(HttpServletResponse.class);
        FilterChain chain = mock(FilterChain.class);
        when(req.getRequestURI()).thenReturn(CTX_PATH + "/chat");
        when(req.getHeader(HEADER)).thenReturn("<script>alert(1)</script>");

        filter.doFilter(req, res, chain);

        verify(res).setHeader(eq(HEADER), argThat(id -> id != null && id.matches("[a-f0-9]{16}")));
    }

    @Test
    @DisplayName("过长（> 64 字符）X-Request-Id 被忽略")
    void rejectsExcessivelyLongIncomingRequestId() throws Exception {
        HttpServletRequest req = mock(HttpServletRequest.class);
        HttpServletResponse res = mock(HttpServletResponse.class);
        FilterChain chain = mock(FilterChain.class);
        when(req.getRequestURI()).thenReturn(CTX_PATH + "/chat");
        when(req.getHeader(HEADER)).thenReturn("a".repeat(65));

        filter.doFilter(req, res, chain);

        verify(res).setHeader(eq(HEADER), argThat(id -> id != null && id.matches("[a-f0-9]{16}")));
    }

    @Test
    @DisplayName("空白 / 空 X-Request-Id 不生效，回退到 UUID")
    void blankIncomingRequestIdFallsBackToUuid() throws Exception {
        HttpServletRequest req = mock(HttpServletRequest.class);
        HttpServletResponse res = mock(HttpServletResponse.class);
        FilterChain chain = mock(FilterChain.class);
        when(req.getRequestURI()).thenReturn(CTX_PATH + "/chat");
        when(req.getHeader(HEADER)).thenReturn("   ");

        filter.doFilter(req, res, chain);

        verify(res).setHeader(eq(HEADER), argThat(id -> id != null && id.matches("[a-f0-9]{16}")));
    }

    @Test
    @DisplayName("filter chain 抛异常时仍清理 MDC")
    void mdcClearedEvenIfChainThrows() {
        HttpServletRequest req = mock(HttpServletRequest.class);
        HttpServletResponse res = mock(HttpServletResponse.class);
        FilterChain chain = mock(FilterChain.class);
        when(req.getRequestURI()).thenReturn(CTX_PATH + "/chat");
        when(req.getHeader(HEADER)).thenReturn(null);
        try {
            doThrow(new RuntimeException("boom")).when(chain).doFilter(req, res);
            assertThrows(RuntimeException.class, () -> filter.doFilter(req, res, chain));
        } catch (Exception e) {
            fail("setup should not throw");
        }
        assertNull(MDC.get(MDC_KEY), "MDC should be cleared in finally");
    }
}
