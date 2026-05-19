package com.aiassistant.config;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoMoreInteractions;

import com.aiassistant.config.ApiVersionConfig.ApiVersionFilter;
import jakarta.servlet.FilterChain;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

class ApiVersionFilterTest {

    @Test
    void externalPrefixUsesBaseContextPathWhenApiVersionMerged() {
        assertEquals(
                "/api/v1/ai-assistant",
                ApiVersionConfig.resolveExternalPrefix("/ai-assistant/v1", "v1"));
    }

    @Test
    void rewritesApiV1PrefixToDefaultContextPath() throws Exception {
        ApiVersionFilter filter = new ApiVersionFilter("/ai-assistant", "");

        HttpServletRequest req = mock(HttpServletRequest.class);
        HttpServletResponse res = mock(HttpServletResponse.class);
        FilterChain chain = mock(FilterChain.class);
        whenUri(req, "/api/v1/ai-assistant/chat");

        filter.doFilter(req, res, chain);

        HttpServletRequest forwarded = captureForwardedRequest(chain, res);
        assertEquals("/ai-assistant/chat", forwarded.getRequestURI());
    }

    @Test
    void rewritesApiV1PrefixToBaseContextPathWhenVersionConfigured() throws Exception {
        ApiVersionFilter filter = new ApiVersionFilter("/ai-assistant/v1", "v1");

        HttpServletRequest req = mock(HttpServletRequest.class);
        HttpServletResponse res = mock(HttpServletResponse.class);
        FilterChain chain = mock(FilterChain.class);
        whenUri(req, "/api/v1/ai-assistant/chat");

        filter.doFilter(req, res, chain);

        HttpServletRequest forwarded = captureForwardedRequest(chain, res);
        assertEquals("/ai-assistant/chat", forwarded.getRequestURI());
    }

    @Test
    void rewritesDirectVersionedContextPathToBaseContextPath() throws Exception {
        ApiVersionFilter filter = new ApiVersionFilter("/ai-assistant", "v1");

        HttpServletRequest req = mock(HttpServletRequest.class);
        HttpServletResponse res = mock(HttpServletResponse.class);
        FilterChain chain = mock(FilterChain.class);
        whenUri(req, "/ai-assistant/v1/chat");

        filter.doFilter(req, res, chain);

        HttpServletRequest forwarded = captureForwardedRequest(chain, res);
        assertEquals("/ai-assistant/chat", forwarded.getRequestURI());
    }

    @Test
    void passthroughForDirectContextPathRequest() throws Exception {
        ApiVersionFilter filter = new ApiVersionFilter("/ai-assistant", "");

        HttpServletRequest req = mock(HttpServletRequest.class);
        HttpServletResponse res = mock(HttpServletResponse.class);
        FilterChain chain = mock(FilterChain.class);
        whenUri(req, "/ai-assistant/chat");

        filter.doFilter(req, res, chain);

        verify(chain).doFilter(req, res);
        verifyNoMoreInteractions(chain);
    }

    private static void whenUri(HttpServletRequest req, String uri) {
        org.mockito.Mockito.when(req.getRequestURI()).thenReturn(uri);
    }

    private static HttpServletRequest captureForwardedRequest(
            FilterChain chain, HttpServletResponse res) throws Exception {
        ArgumentCaptor<HttpServletRequest> captor =
                ArgumentCaptor.forClass(HttpServletRequest.class);
        verify(chain).doFilter(captor.capture(), eq(res));
        return captor.getValue();
    }
}
