package com.aiassistant.config;

import static org.junit.jupiter.api.Assertions.*;

import java.util.List;
import org.junit.jupiter.api.Test;

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
        assertEquals("gpt-5.4-mini", p.resolveModel());

        p.setProvider("volcengine");
        assertEquals("doubao-seed-2-0-pro-260215", p.resolveModel());
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
        p.setAllowedModels(List.of("gpt-5.4", "gpt-5.4-mini"));

        assertEquals("gpt-5.4", p.resolveEffectiveModel("gpt-5.4"));
        assertEquals("gpt-5.4-mini", p.resolveEffectiveModel(null));
        assertEquals("gpt-5.4-mini", p.resolveEffectiveModel("hacked-model"));
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
    void exportMaxImageUrlsClamps() {
        AiAssistantProperties p = new AiAssistantProperties();

        p.setExportMaxImageUrls(2048);
        assertEquals(1024, p.getExportMaxImageUrls());

        p.setExportMaxImageUrls(-1);
        assertEquals(0, p.getExportMaxImageUrls());
    }

    @Test
    void resolveAllowedOriginsTrimsAndDeduplicates() {
        AiAssistantProperties p = new AiAssistantProperties();
        p.setAllowedOrigins(
                " https://a.example.com,https://b.example.com , https://a.example.com ,, ");

        assertArrayEquals(
                new String[] {"https://a.example.com", "https://b.example.com"},
                p.resolveAllowedOrigins());
    }

    @Test
    void resolveAllowedOriginsFallsBackToWildcardWhenBlank() {
        AiAssistantProperties p = new AiAssistantProperties();
        p.setAllowedOrigins("   ");

        assertArrayEquals(new String[] {"*"}, p.resolveAllowedOrigins());
    }

    @Test
    void contextPathIsNormalized() {
        AiAssistantProperties p = new AiAssistantProperties();

        p.setContextPath("ai-assistant/");

        assertEquals("/ai-assistant", p.getContextPath());
    }

    @Test
    void blankContextPathIsRejected() {
        AiAssistantProperties p = new AiAssistantProperties();

        IllegalArgumentException ex =
                assertThrows(IllegalArgumentException.class, () -> p.setContextPath("   "));

        assertTrue(ex.getMessage().contains("context-path"));
    }

    @Test
    void rootContextPathIsRejected() {
        AiAssistantProperties p = new AiAssistantProperties();

        IllegalArgumentException ex =
                assertThrows(IllegalArgumentException.class, () -> p.setContextPath("/"));

        assertTrue(ex.getMessage().contains("root path"));
    }

    @Test
    void listModelsForClientFallback() {
        AiAssistantProperties p = new AiAssistantProperties();
        p.setProvider("openai");
        List<String> models = p.listModelsForClient();
        assertEquals(1, models.size());
        assertEquals("gpt-5.4-mini", models.get(0));
    }

    @Test
    void listModelsForClientSanitizesConfiguredModels() {
        AiAssistantProperties p = new AiAssistantProperties();
        p.setProvider("openai");
        p.setAllowedModels(
                java.util.Arrays.asList(" gpt-5.4 ", "", null, "gpt-5.4-mini", "gpt-5.4"));

        List<String> models = p.listModelsForClient();

        assertEquals(List.of("gpt-5.4", "gpt-5.4-mini"), models);
    }

    @Test
    void listModelsForClientFallsBackWhenConfiguredModelsAreBlank() {
        AiAssistantProperties p = new AiAssistantProperties();
        p.setProvider("openai");
        p.setAllowedModels(java.util.Arrays.asList("", "   ", null));

        List<String> models = p.listModelsForClient();

        assertEquals(List.of("gpt-5.4-mini"), models);
    }

    @Test
    void resolveNewProviders() {
        AiAssistantProperties p = new AiAssistantProperties();

        p.setProvider("gemini");
        assertTrue(p.resolveBaseUrl().contains("generativelanguage.googleapis.com"));
        assertEquals("gemini-3.1-pro-preview", p.resolveModel());

        p.setProvider("siliconflow");
        assertTrue(p.resolveBaseUrl().contains("siliconflow.cn"));

        p.setProvider("groq");
        assertTrue(p.resolveBaseUrl().contains("groq.com"));
        assertEquals("llama-3.3-70b-versatile", p.resolveModel());

        p.setProvider("spark");
        assertTrue(p.resolveBaseUrl().contains("xf-yun.com"));

        p.setProvider("ollama");
        assertTrue(p.resolveBaseUrl().contains("localhost:11434"));
        assertEquals("llama3", p.resolveModel());

        p.setProvider("baichuan");
        assertTrue(p.resolveBaseUrl().contains("baichuan-ai.com"));

        p.setProvider("stepfun");
        assertTrue(p.resolveBaseUrl().contains("stepfun.com"));

        p.setProvider("hunyuan");
        assertTrue(p.resolveBaseUrl().contains("tencent.com"));

        p.setProvider("yi");
        assertTrue(p.resolveBaseUrl().contains("lingyiwanwu.com"));
    }

    @Test
    void resolveProviderAliases() {
        AiAssistantProperties p = new AiAssistantProperties();

        p.setProvider("glm");
        assertTrue(p.resolveBaseUrl().contains("z.ai"));
        assertEquals("glm-5.1", p.resolveModel());

        p.setProvider("google");
        assertEquals("gemini-3.1-pro-preview", p.resolveModel());

        p.setProvider("xunfei");
        assertTrue(p.resolveBaseUrl().contains("xf-yun.com"));

        p.setProvider("tencent");
        assertTrue(p.resolveBaseUrl().contains("tencent.com"));

        p.setProvider("lingyiwanwu");
        assertTrue(p.resolveBaseUrl().contains("lingyiwanwu.com"));
    }

    @Test
    void unknownProviderThrows() {
        AiAssistantProperties p = new AiAssistantProperties();
        p.setProvider("unknown");
        assertThrows(IllegalArgumentException.class, p::resolveModel);
        assertThrows(IllegalArgumentException.class, p::resolveBaseUrl);
    }
}
