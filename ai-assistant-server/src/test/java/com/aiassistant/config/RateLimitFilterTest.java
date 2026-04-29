package com.aiassistant.config;

import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

class RateLimitFilterTest {

    private AiAssistantProperties props;

    @BeforeEach
    void setUp() {
        props = new AiAssistantProperties();
        props.setContextPath("/ai-assistant");
        props.setRateLimit(3);
    }

    @Test
    void allowsRequestsUnderLimit() throws Exception {
        RateLimitFilter filter = new RateLimitFilter(props);
        for (int i = 0; i < 3; i++) {
            MockHttpServletRequest req = new MockHttpServletRequest("POST", "/ai-assistant/chat");
            req.setRemoteAddr("1.2.3.4");
            MockHttpServletResponse res = new MockHttpServletResponse();
            filter.doFilter(req, res, new MockFilterChain());
            assertEquals(200, res.getStatus());
        }
    }

    @Test
    void blocksExcessRequests() throws Exception {
        RateLimitFilter filter = new RateLimitFilter(props);
        for (int i = 0; i < 3; i++) {
            MockHttpServletRequest req = new MockHttpServletRequest("POST", "/ai-assistant/chat");
            req.setRemoteAddr("5.5.5.5");
            filter.doFilter(req, new MockHttpServletResponse(), new MockFilterChain());
        }
        MockHttpServletRequest req = new MockHttpServletRequest("POST", "/ai-assistant/chat");
        req.setRemoteAddr("5.5.5.5");
        MockHttpServletResponse res = new MockHttpServletResponse();
        filter.doFilter(req, res, new MockFilterChain());
        assertEquals(429, res.getStatus());
    }

    @Test
    void passesOptionsThrough() throws Exception {
        RateLimitFilter filter = new RateLimitFilter(props);
        MockHttpServletRequest req = new MockHttpServletRequest("OPTIONS", "/ai-assistant/chat");
        MockHttpServletResponse res = new MockHttpServletResponse();
        filter.doFilter(req, res, new MockFilterChain());
        assertEquals(200, res.getStatus());
    }

    @Test
    void passesHealthThrough() throws Exception {
        RateLimitFilter filter = new RateLimitFilter(props);
        MockHttpServletRequest req = new MockHttpServletRequest("GET", "/ai-assistant/health");
        MockHttpServletResponse res = new MockHttpServletResponse();
        filter.doFilter(req, res, new MockFilterChain());
        assertEquals(200, res.getStatus());
    }

    @Test
    void ignoresPrefixLookalikePaths() throws Exception {
        RateLimitFilter filter = new RateLimitFilter(props);
        for (int i = 0; i < 5; i++) {
            MockHttpServletRequest req = new MockHttpServletRequest("POST", "/ai-assistant2/chat");
            req.setRemoteAddr("9.9.9.9");
            MockHttpServletResponse res = new MockHttpServletResponse();

            filter.doFilter(req, res, new MockFilterChain());

            assertEquals(200, res.getStatus());
        }
    }
}
