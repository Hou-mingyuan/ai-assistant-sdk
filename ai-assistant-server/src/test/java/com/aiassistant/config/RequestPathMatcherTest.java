package com.aiassistant.config;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class RequestPathMatcherTest {

    @Test
    void matchesExactContextPathAndChildPaths() {
        assertTrue(RequestPathMatcher.matchesContextPath("/ai-assistant", "/ai-assistant"));
        assertTrue(RequestPathMatcher.matchesContextPath("/ai-assistant/chat", "/ai-assistant"));
    }

    @Test
    void rejectsPrefixLookalikes() {
        assertFalse(RequestPathMatcher.matchesContextPath("/ai-assistant2/chat", "/ai-assistant"));
        assertFalse(RequestPathMatcher.matchesContextPath("/ai-assistant-extra", "/ai-assistant"));
    }

    @Test
    void normalizesConfiguredContextPath() {
        assertTrue(RequestPathMatcher.matchesContextPath("/ai-assistant/chat", "ai-assistant/"));
    }
}
