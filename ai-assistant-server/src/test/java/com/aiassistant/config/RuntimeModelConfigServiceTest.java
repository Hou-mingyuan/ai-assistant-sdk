package com.aiassistant.config;

import static org.junit.jupiter.api.Assertions.*;

import java.nio.file.Path;
import java.util.List;
import okhttp3.mockwebserver.MockResponse;
import okhttp3.mockwebserver.MockWebServer;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class RuntimeModelConfigServiceTest {

    @Test
    void defaultConstructorDoesNotLoadUserHomeStateWhenAdminApiIsDisabled(@TempDir Path tempDir)
            throws Exception {
        Path persisted = tempDir.resolve("runtime-model.properties");
        java.nio.file.Files.writeString(persisted, "provider=minimax\nmodel=MiniMax-M2.7\n");
        String previous = System.getProperty("ai.assistant.runtime.config.path");
        System.setProperty("ai.assistant.runtime.config.path", persisted.toString());
        try {
            AiAssistantProperties properties = new AiAssistantProperties();
            properties.setProvider("demo");

            new RuntimeModelConfigService(properties);

            assertEquals("demo", properties.getProvider());
            assertEquals("demo-local", properties.resolveModel());
        } finally {
            if (previous == null) {
                System.clearProperty("ai.assistant.runtime.config.path");
            } else {
                System.setProperty("ai.assistant.runtime.config.path", previous);
            }
        }
    }

    @Test
    void updateMutatesPropertiesWithoutExposingApiKey() {
        AiAssistantProperties properties = new AiAssistantProperties();
        properties.setApiKey("old-key");
        RuntimeModelConfigService service = new RuntimeModelConfigService(properties);

        RuntimeModelConfigService.UpdateRequest request =
                new RuntimeModelConfigService.UpdateRequest();
        request.setProvider("minimax");
        request.setBaseUrl("https://api.minimaxi.com/v1");
        request.setApiKey("new-key");
        request.setModel("MiniMax-M2.7");
        request.setAllowedModelsText("MiniMax-M2.7, MiniMax-M2");

        var response = service.update(request).toResponse();

        assertEquals("minimax", properties.getProvider());
        assertEquals("https://api.minimaxi.com/v1", properties.resolveBaseUrl());
        assertEquals(List.of("new-key"), properties.resolveApiKeys());
        assertEquals("MiniMax-M2.7", properties.resolveModel());
        assertEquals(List.of("MiniMax-M2.7", "MiniMax-M2"), properties.listModelsForClient());
        assertEquals(true, response.get("apiKeyConfigured"));
        assertFalse(response.containsKey("apiKey"));
    }

    @Test
    void updateMutatesWebSearchConfigurationWithoutExposingApiKey() {
        AiAssistantProperties properties = new AiAssistantProperties();
        RuntimeModelConfigService service = new RuntimeModelConfigService(properties);
        RuntimeModelConfigService.UpdateRequest request =
                new RuntimeModelConfigService.UpdateRequest();
        request.setWebSearchProvider("tavily");
        request.setWebSearchApiKey("tvly-runtime");
        request.setWebSearchMaxResults(8);

        var response = service.update(request).toResponse();

        assertEquals("tavily", properties.getUrlFetch().getWebSearchProvider());
        assertEquals("tvly-runtime", properties.getUrlFetch().getWebSearchApiKey());
        assertEquals(8, properties.getUrlFetch().getWebSearchMaxResults());
        assertEquals("tavily", response.get("webSearchProvider"));
        assertEquals(8, response.get("webSearchMaxResults"));
        assertEquals(true, response.get("webSearchApiKeyConfigured"));
        assertFalse(response.containsKey("webSearchApiKey"));
        assertFalse(response.toString().contains("tvly-runtime"));
    }

    @Test
    void persistsNonSecretConfigButDoesNotPersistApiKey(@TempDir Path tempDir) {
        Path file = tempDir.resolve("runtime-model.properties");
        AiAssistantProperties first = new AiAssistantProperties();
        first.setApiKey("env-key");
        RuntimeModelConfigService service = new RuntimeModelConfigService(first, file);

        RuntimeModelConfigService.UpdateRequest request =
                new RuntimeModelConfigService.UpdateRequest();
        request.setProvider("minimax");
        request.setBaseUrl("https://api.minimaxi.com/v1");
        request.setApiKey("runtime-secret");
        request.setModel("MiniMax-M2.7");
        request.setAllowedModelsText("MiniMax-M2.7,MiniMax-M2");
        service.update(request);

        AiAssistantProperties second = new AiAssistantProperties();
        second.setApiKey("env-key");
        new RuntimeModelConfigService(second, file);

        assertEquals("minimax", second.getProvider());
        assertEquals("https://api.minimaxi.com/v1", second.resolveBaseUrl());
        assertEquals("MiniMax-M2.7", second.resolveModel());
        assertEquals(List.of("MiniMax-M2.7", "MiniMax-M2"), second.listModelsForClient());
        assertEquals(List.of("env-key"), second.resolveApiKeys());
    }

    @Test
    void persistsApiKeyEncryptedWhenRuntimeSecretIsConfigured(@TempDir Path tempDir)
            throws Exception {
        Path file = tempDir.resolve("runtime-model.properties");
        AiAssistantProperties first = new AiAssistantProperties();
        first.getAdmin().setRuntimeConfigSecretKey("local-test-secret");
        RuntimeModelConfigService service = new RuntimeModelConfigService(first, file);

        RuntimeModelConfigService.UpdateRequest request =
                new RuntimeModelConfigService.UpdateRequest();
        request.setProvider("minimax");
        request.setApiKey("runtime-secret");
        service.update(request);

        String persisted = java.nio.file.Files.readString(file);
        assertFalse(persisted.contains("runtime-secret"));
        assertTrue(persisted.contains("apiKeyEncrypted="));

        AiAssistantProperties second = new AiAssistantProperties();
        second.getAdmin().setRuntimeConfigSecretKey("local-test-secret");
        new RuntimeModelConfigService(second, file);

        assertEquals(List.of("runtime-secret"), second.resolveApiKeys());
    }

    @Test
    void discoverProviderModelsReadsOpenAiCompatibleModels(@TempDir Path tempDir) throws Exception {
        try (MockWebServer server = new MockWebServer()) {
            server.enqueue(
                    new MockResponse()
                            .setHeader("Content-Type", "application/json")
                            .setBody(
                                    """
                                    {"data":[{"id":"MiniMax-M2.5"},{"id":"MiniMax-M2.7"}]}
                                    """));
            server.start();
            AiAssistantProperties properties = new AiAssistantProperties();
            properties.setApiKey("runtime-key");
            properties.setBaseUrl(server.url("/v1").toString());
            RuntimeModelConfigService service =
                    new RuntimeModelConfigService(
                            properties, tempDir.resolve("runtime.properties"));

            var response = service.discoverProviderModels();

            assertEquals(true, response.get("success"));
            assertEquals(List.of("MiniMax-M2.5", "MiniMax-M2.7"), response.get("models"));
            assertEquals("Bearer runtime-key", server.takeRequest().getHeader("Authorization"));
        }
    }
}
