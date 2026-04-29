package com.aiassistant.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletOutputStream;
import jakarta.servlet.WriteListener;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.Test;

import java.io.ByteArrayOutputStream;
import java.io.IOException;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class SseCompressionFilterTest {

    @Test
    void nonStreamEndpoint_passesThrough() throws Exception {
        var filter = new SseCompressionFilter("/ai-assistant");
        HttpServletRequest req = mock(HttpServletRequest.class);
        HttpServletResponse res = mock(HttpServletResponse.class);
        FilterChain chain = mock(FilterChain.class);

        when(req.getRequestURI()).thenReturn("/ai-assistant/chat");
        when(req.getHeader("Accept-Encoding")).thenReturn("gzip");

        filter.doFilter(req, res, chain);

        verify(chain).doFilter(req, res);
        verify(res, never()).setHeader(eq("Content-Encoding"), anyString());
    }

    @Test
    void streamEndpoint_withoutGzipAccept_passesThrough() throws Exception {
        var filter = new SseCompressionFilter("/ai-assistant");
        HttpServletRequest req = mock(HttpServletRequest.class);
        HttpServletResponse res = mock(HttpServletResponse.class);
        FilterChain chain = mock(FilterChain.class);

        when(req.getRequestURI()).thenReturn("/ai-assistant/stream");
        when(req.getHeader("Accept-Encoding")).thenReturn("identity");

        filter.doFilter(req, res, chain);

        verify(chain).doFilter(req, res);
        verify(res, never()).setHeader(eq("Content-Encoding"), anyString());
    }

    @Test
    void streamEndpoint_withGzip_setsHeaders() throws Exception {
        var filter = new SseCompressionFilter("/ai-assistant");
        HttpServletRequest req = mock(HttpServletRequest.class);
        HttpServletResponse res = mock(HttpServletResponse.class);
        FilterChain chain = mock(FilterChain.class);

        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        ServletOutputStream sos = new ServletOutputStream() {
            @Override public void write(int b) throws IOException { baos.write(b); }
            @Override public boolean isReady() { return true; }
            @Override public void setWriteListener(WriteListener l) {}
        };

        when(req.getRequestURI()).thenReturn("/ai-assistant/stream");
        when(req.getHeader("Accept-Encoding")).thenReturn("gzip, deflate");
        when(res.getOutputStream()).thenReturn(sos);
        when(res.getCharacterEncoding()).thenReturn("UTF-8");

        filter.doFilter(req, res, chain);

        verify(res).setHeader("Content-Encoding", "gzip");
        verify(res).setHeader("Vary", "Accept-Encoding");
    }

    @Test
    void differentContextPath_ignoresRequest() throws Exception {
        var filter = new SseCompressionFilter("/my-api");
        HttpServletRequest req = mock(HttpServletRequest.class);
        HttpServletResponse res = mock(HttpServletResponse.class);
        FilterChain chain = mock(FilterChain.class);

        when(req.getRequestURI()).thenReturn("/other/stream");
        when(req.getHeader("Accept-Encoding")).thenReturn("gzip");

        filter.doFilter(req, res, chain);

        verify(chain).doFilter(req, res);
        verify(res, never()).setHeader(eq("Content-Encoding"), anyString());
    }

    @Test
    void prefixLookalikePath_ignoresRequest() throws Exception {
        var filter = new SseCompressionFilter("/ai-assistant");
        HttpServletRequest req = mock(HttpServletRequest.class);
        HttpServletResponse res = mock(HttpServletResponse.class);
        FilterChain chain = mock(FilterChain.class);

        when(req.getRequestURI()).thenReturn("/ai-assistant2/stream");
        when(req.getHeader("Accept-Encoding")).thenReturn("gzip");

        filter.doFilter(req, res, chain);

        verify(chain).doFilter(req, res);
        verify(res, never()).setHeader(eq("Content-Encoding"), anyString());
    }
}
