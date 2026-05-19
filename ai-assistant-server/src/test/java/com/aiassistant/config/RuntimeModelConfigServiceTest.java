package com.aiassistant.config;

import static org.junit.jupiter.api.Assertions.*;

import java.nio.file.Path;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class RuntimeModelConfigServiceTest {

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
}
