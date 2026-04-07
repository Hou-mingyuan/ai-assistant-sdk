package com.aiassistant.config;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class AiAssistantPropertiesTest {

    @Test
    void resolveBaseUrlDefaultProviders() {
        AiAssistantProperties p = new AiAssistantProperties();
        p.setProvider("openai");
        assertTrue(p.resolveBaseUrl().contains("openai.com"));

        p.setProvider("deepseek");
        assertTrue(p.resolveBaseUrl().contains("deepseek.com"));

        p.setProvider("volcengine");
        assertTrue(p.resolveBaseUrl().contains("volces.com"));
    }

    @Test
    void resolveBaseUrlCustomOverride() {
        AiAssistantProperties p = new AiAssistantProperties();
        p.setBaseUrl("https://custom.api.com/v1");
        assertEquals("https://custom.api.com/v1", p.resolveBaseUrl());
    }

    @Test
    void resolveModelDefaultPerProvider() {
        AiAssistantProperties p = new AiAssistantProperties();
        p.setProvider("openai");
        assertEquals("gpt-4o-mini", p.resolveModel());

        p.setProvider("volcengine");
        assertEquals("doubao-1.5-pro-32k", p.resolveModel());
    }

    @Test
    void resolveModelCustomOverride() {
        AiAssistantProperties p = new AiAssistantProperties();
        p.setModel("my-custom-model");
        assertEquals("my-custom-model", p.resolveModel());
    }

    @Test
    void resolveEffectiveModelWhitelist() {
        AiAssistantProperties p = new AiAssistantProperties();
        p.setProvider("openai");
        p.setAllowedModels(List.of("gpt-4o", "gpt-4o-mini"));

        assertEquals("gpt-4o", p.resolveEffectiveModel("gpt-4o"));
        assertEquals("gpt-4o-mini", p.resolveEffectiveModel(null));
        assertEquals("gpt-4o-mini", p.resolveEffectiveModel("hacked-model"));
    }

    @Test
    void resolveApiKeysMergesKeyAndKeys() {
        AiAssistantProperties p = new AiAssistantProperties();
        p.setApiKey("key1");
        p.setApiKeys(List.of("key2", "key1", "key3"));
        List<String> keys = p.resolveApiKeys();
        assertEquals(3, keys.size());
        assertEquals("key1", keys.get(0));
    }

    @Test
    void llmMaxRetriesClamps() {
        AiAssistantProperties p = new AiAssistantProperties();
        p.setLlmMaxRetries(100);
        assertEquals(5, p.getLlmMaxRetries());
        p.setLlmMaxRetries(-1);
        assertEquals(0, p.getLlmMaxRetries());
    }

    @Test
    void listModelsForClientFallback() {
        AiAssistantProperties p = new AiAssistantProperties();
        p.setProvider("openai");
        List<String> models = p.listModelsForClient();
        assertEquals(1, models.size());
        assertEquals("gpt-4o-mini", models.get(0));
    }

    @Test
    void unknownProviderThrows() {
        AiAssistantProperties p = new AiAssistantProperties();
        p.setProvider("unknown");
        assertThrows(IllegalArgumentException.class, p::resolveModel);
        assertThrows(IllegalArgumentException.class, p::resolveBaseUrl);
    }
}
