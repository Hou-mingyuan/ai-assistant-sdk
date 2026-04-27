package com.aiassistant.capability;

import com.aiassistant.spi.AssistantCapability;
import com.aiassistant.service.LlmService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class BuiltInCapabilitiesTest {

    private LlmService llmService;

    @BeforeEach
    void setUp() {
        llmService = mock(LlmService.class);
    }

    @Test
    void translate_name() {
        AssistantCapability cap = BuiltInCapabilities.translate(llmService);
        assertEquals("translate", cap.name());
    }

    @Test
    void translate_hasDescription() {
        AssistantCapability cap = BuiltInCapabilities.translate(llmService);
        assertNotNull(cap.description());
        assertFalse(cap.description().isBlank());
    }

    @Test
    void translate_schema_hasRequiredFields() {
        AssistantCapability cap = BuiltInCapabilities.translate(llmService);
        Map<String, Object> schema = cap.inputSchema();
        assertEquals("object", schema.get("type"));
        assertTrue(schema.containsKey("required"));
        assertTrue(schema.containsKey("properties"));
    }

    @Test
    void translate_execute_delegatesToLlmService() throws Exception {
        when(llmService.translate("hello", "zh")).thenReturn("你好");
        AssistantCapability cap = BuiltInCapabilities.translate(llmService);
        String result = cap.execute(Map.of("text", "hello", "targetLang", "zh"));
        assertEquals("你好", result);
        verify(llmService).translate("hello", "zh");
    }

    @Test
    void translate_tags() {
        AssistantCapability cap = BuiltInCapabilities.translate(llmService);
        assertTrue(cap.tags().contains("translation"));
    }

    @Test
    void summarize_name() {
        AssistantCapability cap = BuiltInCapabilities.summarize(llmService);
        assertEquals("summarize", cap.name());
    }

    @Test
    void summarize_execute_delegatesToLlmService() throws Exception {
        when(llmService.summarize("long text")).thenReturn("short");
        AssistantCapability cap = BuiltInCapabilities.summarize(llmService);
        String result = cap.execute(Map.of("text", "long text"));
        assertEquals("short", result);
        verify(llmService).summarize("long text");
    }

    @Test
    void summarize_schema() {
        AssistantCapability cap = BuiltInCapabilities.summarize(llmService);
        Map<String, Object> schema = cap.inputSchema();
        assertEquals("object", schema.get("type"));
    }

    @Test
    void chat_name() {
        AssistantCapability cap = BuiltInCapabilities.chat(llmService);
        assertEquals("chat", cap.name());
    }

    @Test
    void chat_execute_delegatesToLlmService() throws Exception {
        when(llmService.chat("hi")).thenReturn("Hello!");
        AssistantCapability cap = BuiltInCapabilities.chat(llmService);
        String result = cap.execute(Map.of("message", "hi"));
        assertEquals("Hello!", result);
        verify(llmService).chat("hi");
    }

    @Test
    void chat_tags() {
        AssistantCapability cap = BuiltInCapabilities.chat(llmService);
        assertTrue(cap.tags().contains("chat"));
        assertTrue(cap.tags().contains("conversation"));
    }

    @Test
    void allCapabilities_haveUniqueNames() {
        var t = BuiltInCapabilities.translate(llmService);
        var s = BuiltInCapabilities.summarize(llmService);
        var c = BuiltInCapabilities.chat(llmService);
        assertEquals(3, java.util.Set.of(t.name(), s.name(), c.name()).size());
    }
}
