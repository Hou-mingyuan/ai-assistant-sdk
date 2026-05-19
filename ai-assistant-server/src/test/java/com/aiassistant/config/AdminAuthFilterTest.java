package com.aiassistant.config;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletOutputStream;
import jakarta.servlet.WriteListener;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.ByteArrayOutputStream;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 覆盖 {@link AdminAuthFilter}：admin path 校验、OPTIONS preflight 放行、空 token 拒绝、 X-Admin-Token 优先 + 回退
 * X-AI-Token、错误 token 拒绝、constant-time 比较（无法直接验证但 通过 MessageDigest.isEqual 路径覆盖）。
 *
 * <p>Provided by T3-Wave3 coverage recovery.
 */
class AdminAuthFilterTest {

    private static final String CTX_PATH = "/ai-assistant";
    private static final String ADMIN_TOKEN = "admin-secret-xyz";

    private static class CapturingOutputStream extends ServletOutputStream {
        final ByteArrayOutputStream buf = new ByteArrayOutputStream();

        @Override
        public boolean isReady() {
            return true;
        }

        @Override
        public void setWriteListener(WriteListener listener) {
            /* noop */
        }

        @Override
        public void write(int b) {
            buf.write(b);
        }

        @Override
        public void write(byte[] b, int off, int len) {
            buf.write(b, off, len);
        }
    }

    @Test
    @DisplayName("非 /admin 路径直接 passthrough")
    void nonAdminPathPassthrough() throws Exception {
        AdminAuthFilter filter = new AdminAuthFilter(CTX_PATH, ADMIN_TOKEN);
        HttpServletRequest req = mock(HttpServletRequest.class);
        HttpServletResponse res = mock(HttpServletResponse.class);
        FilterChain chain = mock(FilterChain.class);
        when(req.getRequestURI()).thenReturn(CTX_PATH + "/chat");

        filter.doFilter(req, res, chain);
        verify(chain).doFilter(req, res);
        verify(res, never()).setStatus(anyInt());
    }

    @Test
    @DisplayName("OPTIONS preflight 放行（CORS 必需）")
    void optionsPreflightAllowed() throws Exception {
        AdminAuthFilter filter = new AdminAuthFilter(CTX_PATH, ADMIN_TOKEN);
        HttpServletRequest req = mock(HttpServletRequest.class);
        HttpServletResponse res = mock(HttpServletResponse.class);
        FilterChain chain = mock(FilterChain.class);
        when(req.getRequestURI()).thenReturn(CTX_PATH + "/admin/overview");
        when(req.getMethod()).thenReturn("OPTIONS");

        filter.doFilter(req, res, chain);
        verify(chain).doFilter(req, res);
        verify(res, never()).setStatus(anyInt());
    }

    @Test
    @DisplayName("空 adminToken 配置时所有 /admin 请求返回 403")
    void blankAdminTokenAlwaysRejected() throws Exception {
        AdminAuthFilter filter = new AdminAuthFilter(CTX_PATH, "");
        HttpServletRequest req = mock(HttpServletRequest.class);
        HttpServletResponse res = mock(HttpServletResponse.class);
        FilterChain chain = mock(FilterChain.class);
        CapturingOutputStream cos = new CapturingOutputStream();
        when(req.getRequestURI()).thenReturn(CTX_PATH + "/admin/overview");
        when(req.getMethod()).thenReturn("GET");
        when(res.getOutputStream()).thenReturn(cos);

        filter.doFilter(req, res, chain);

        verify(chain, never()).doFilter(any(), any());
        verify(res).setStatus(HttpServletResponse.SC_FORBIDDEN);
        JsonNode body = new ObjectMapper().readTree(cos.buf.toByteArray());
        assertFalse(body.path("success").asBoolean(true));
        assertTrue(body.path("error").asText().toLowerCase().contains("not configured"));
    }

    @Test
    @DisplayName("X-Admin-Token 匹配时放行")
    void validXAdminTokenAllows() throws Exception {
        AdminAuthFilter filter = new AdminAuthFilter(CTX_PATH, ADMIN_TOKEN);
        HttpServletRequest req = mock(HttpServletRequest.class);
        HttpServletResponse res = mock(HttpServletResponse.class);
        FilterChain chain = mock(FilterChain.class);
        when(req.getRequestURI()).thenReturn(CTX_PATH + "/admin/overview");
        when(req.getMethod()).thenReturn("GET");
        when(req.getHeader("X-Admin-Token")).thenReturn(ADMIN_TOKEN);

        filter.doFilter(req, res, chain);
        verify(chain).doFilter(req, res);
    }

    @Test
    @DisplayName("X-Admin-Token 缺失但 X-AI-Token 匹配 admin-token 时放行（fallback）")
    void xaiTokenFallbackAllowed() throws Exception {
        AdminAuthFilter filter = new AdminAuthFilter(CTX_PATH, ADMIN_TOKEN);
        HttpServletRequest req = mock(HttpServletRequest.class);
        HttpServletResponse res = mock(HttpServletResponse.class);
        FilterChain chain = mock(FilterChain.class);
        when(req.getRequestURI()).thenReturn(CTX_PATH + "/admin/overview");
        when(req.getMethod()).thenReturn("POST");
        when(req.getHeader("X-Admin-Token")).thenReturn(null);
        when(req.getHeader("X-AI-Token")).thenReturn(ADMIN_TOKEN);

        filter.doFilter(req, res, chain);
        verify(chain).doFilter(req, res);
    }

    @Test
    @DisplayName("两个 token 都缺失返回 403")
    void noTokenRejected() throws Exception {
        AdminAuthFilter filter = new AdminAuthFilter(CTX_PATH, ADMIN_TOKEN);
        HttpServletRequest req = mock(HttpServletRequest.class);
        HttpServletResponse res = mock(HttpServletResponse.class);
        FilterChain chain = mock(FilterChain.class);
        CapturingOutputStream cos = new CapturingOutputStream();
        when(req.getRequestURI()).thenReturn(CTX_PATH + "/admin/overview");
        when(req.getMethod()).thenReturn("GET");
        when(req.getHeader(anyString())).thenReturn(null);
        when(res.getOutputStream()).thenReturn(cos);

        filter.doFilter(req, res, chain);

        verify(chain, never()).doFilter(any(), any());
        verify(res).setStatus(HttpServletResponse.SC_FORBIDDEN);
    }

    @Test
    @DisplayName("token 错误时返回 403")
    void wrongTokenRejected() throws Exception {
        AdminAuthFilter filter = new AdminAuthFilter(CTX_PATH, ADMIN_TOKEN);
        HttpServletRequest req = mock(HttpServletRequest.class);
        HttpServletResponse res = mock(HttpServletResponse.class);
        FilterChain chain = mock(FilterChain.class);
        CapturingOutputStream cos = new CapturingOutputStream();
        when(req.getRequestURI()).thenReturn(CTX_PATH + "/admin/overview");
        when(req.getMethod()).thenReturn("GET");
        when(req.getHeader("X-Admin-Token")).thenReturn("wrong");
        when(res.getOutputStream()).thenReturn(cos);

        filter.doFilter(req, res, chain);
        verify(chain, never()).doFilter(any(), any());
        verify(res).setStatus(HttpServletResponse.SC_FORBIDDEN);
    }

    @Test
    @DisplayName("token 长度不同导致 MessageDigest.isEqual 短路返回 false")
    void differentLengthTokenRejected() throws Exception {
        AdminAuthFilter filter = new AdminAuthFilter(CTX_PATH, ADMIN_TOKEN);
        HttpServletRequest req = mock(HttpServletRequest.class);
        HttpServletResponse res = mock(HttpServletResponse.class);
        FilterChain chain = mock(FilterChain.class);
        CapturingOutputStream cos = new CapturingOutputStream();
        when(req.getRequestURI()).thenReturn(CTX_PATH + "/admin/overview");
        when(req.getMethod()).thenReturn("GET");
        when(req.getHeader("X-Admin-Token")).thenReturn("short");
        when(res.getOutputStream()).thenReturn(cos);

        filter.doFilter(req, res, chain);
        verify(chain, never()).doFilter(any(), any());
        verify(res).setStatus(HttpServletResponse.SC_FORBIDDEN);
    }

    @Test
    @DisplayName("空 token 字符串视为缺失")
    void blankTokenStringRejected() throws Exception {
        AdminAuthFilter filter = new AdminAuthFilter(CTX_PATH, ADMIN_TOKEN);
        HttpServletRequest req = mock(HttpServletRequest.class);
        HttpServletResponse res = mock(HttpServletResponse.class);
        FilterChain chain = mock(FilterChain.class);
        CapturingOutputStream cos = new CapturingOutputStream();
        when(req.getRequestURI()).thenReturn(CTX_PATH + "/admin/overview");
        when(req.getMethod()).thenReturn("GET");
        when(req.getHeader("X-Admin-Token")).thenReturn("   ");
        when(req.getHeader("X-AI-Token")).thenReturn("");
        when(res.getOutputStream()).thenReturn(cos);

        filter.doFilter(req, res, chain);
        verify(chain, never()).doFilter(any(), any());
        verify(res).setStatus(HttpServletResponse.SC_FORBIDDEN);
    }
}
