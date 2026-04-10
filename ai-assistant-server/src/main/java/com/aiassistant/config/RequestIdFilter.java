package com.aiassistant.config;

import jakarta.servlet.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.MDC;

import java.io.IOException;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * 为每个请求生成唯一 requestId，写入 SLF4J MDC 和响应头 {@code X-Request-Id}。
 * logback pattern 中使用 {@code %X{requestId}} 即可在日志中输出。
 */
public class RequestIdFilter implements Filter {

    private static final String MDC_KEY = "requestId";
    private static final String HEADER = "X-Request-Id";
    private static final Pattern SAFE_ID = Pattern.compile("[a-zA-Z0-9_\\-]+");

    private final String contextPath;

    public RequestIdFilter(String contextPath) {
        this.contextPath = contextPath;
    }

    @Override
    public void doFilter(ServletRequest req, ServletResponse res, FilterChain chain)
            throws IOException, ServletException {
        HttpServletRequest request = (HttpServletRequest) req;
        String path = request.getRequestURI();
        if (!path.startsWith(contextPath)) {
            chain.doFilter(req, res);
            return;
        }
        String incoming = request.getHeader(HEADER);
        String requestId;
        if (incoming != null && !incoming.isBlank()
                && incoming.length() <= 64 && SAFE_ID.matcher(incoming.trim()).matches()) {
            requestId = incoming.trim();
        } else {
            requestId = UUID.randomUUID().toString().replace("-", "").substring(0, 16);
        }
        MDC.put(MDC_KEY, requestId);
        try {
            ((HttpServletResponse) res).setHeader(HEADER, requestId);
            chain.doFilter(req, res);
        } finally {
            MDC.remove(MDC_KEY);
        }
    }
}
