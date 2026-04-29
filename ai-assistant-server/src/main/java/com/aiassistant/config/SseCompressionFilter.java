package com.aiassistant.config;

import jakarta.servlet.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpServletResponseWrapper;
import java.io.IOException;
import java.io.OutputStream;
import java.io.OutputStreamWriter;
import java.io.PrintWriter;
import java.util.zip.GZIPOutputStream;

/**
 * Applies real GZIP compression to SSE /stream endpoint responses when the client advertises {@code
 * Accept-Encoding: gzip}. Spring's default compression often excludes {@code text/event-stream}.
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

        boolean shouldCompress =
                RequestPathMatcher.matchesContextPath(path, contextPath)
                        && path.endsWith("/stream")
                        && acceptsGzip(request);

        if (!shouldCompress) {
            chain.doFilter(req, res);
            return;
        }

        response.setHeader("Content-Encoding", "gzip");
        response.setHeader("Vary", "Accept-Encoding");
        GzipResponseWrapper wrapper = new GzipResponseWrapper(response);
        try {
            chain.doFilter(req, wrapper);
        } finally {
            wrapper.finish();
        }
    }

    private static boolean acceptsGzip(HttpServletRequest request) {
        String accept = request.getHeader("Accept-Encoding");
        return accept != null && accept.contains("gzip");
    }

    private static class GzipResponseWrapper extends HttpServletResponseWrapper {
        private GZIPOutputStream gzipStream;
        private ServletOutputStream servletOutputStream;
        private PrintWriter writer;

        GzipResponseWrapper(HttpServletResponse response) {
            super(response);
        }

        @Override
        public ServletOutputStream getOutputStream() throws IOException {
            if (writer != null) throw new IllegalStateException("getWriter() already called");
            if (servletOutputStream == null) {
                gzipStream = new GZIPOutputStream(getResponse().getOutputStream(), true);
                servletOutputStream = new DelegatingServletOutputStream(gzipStream);
            }
            return servletOutputStream;
        }

        @Override
        public PrintWriter getWriter() throws IOException {
            if (servletOutputStream != null)
                throw new IllegalStateException("getOutputStream() already called");
            if (writer == null) {
                gzipStream = new GZIPOutputStream(getResponse().getOutputStream(), true);
                String charset = getCharacterEncoding();
                writer =
                        new PrintWriter(
                                new OutputStreamWriter(
                                        gzipStream, charset != null ? charset : "UTF-8"),
                                false);
            }
            return writer;
        }

        void finish() throws IOException {
            if (writer != null) writer.flush();
            if (gzipStream != null) gzipStream.finish();
        }
    }

    private static class DelegatingServletOutputStream extends ServletOutputStream {
        private final OutputStream target;

        DelegatingServletOutputStream(OutputStream target) {
            this.target = target;
        }

        @Override
        public void write(int b) throws IOException {
            target.write(b);
        }

        @Override
        public void write(byte[] b) throws IOException {
            target.write(b);
        }

        @Override
        public void write(byte[] b, int off, int len) throws IOException {
            target.write(b, off, len);
        }

        @Override
        public void flush() throws IOException {
            target.flush();
        }

        @Override
        public void close() throws IOException {
            target.close();
        }

        @Override
        public boolean isReady() {
            return true;
        }

        @Override
        public void setWriteListener(WriteListener listener) {
            /* no-op for blocking I/O */
        }
    }
}
