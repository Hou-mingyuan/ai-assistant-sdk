package com.aiassistant.controller;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.aiassistant.config.AiAssistantProperties;
import com.aiassistant.config.RuntimeModelConfigService;
import java.util.List;
import org.junit.jupiter.api.Test;

class RuntimeModelConfigControllerTest {

    @Test
    void getRuntimeModelConfigReturnsSanitizedSnapshot() {
        AiAssistantProperties properties = new AiAssistantProperties();
        properties.setProvider("minimax");
        properties.setApiKey("sk-secret");
        RuntimeModelConfigController controller = controller(properties);

        var response = controller.getRuntimeModelConfig();

        assertEquals(true, response.get("success"));
        assertEquals("minimax", response.get("provider"));
        assertEquals(true, response.get("apiKeyConfigured"));
        assertFalse(response.containsKey("apiKey"));
        assertFalse(response.toString().contains("sk-secret"));
    }

    @Test
    void updateRuntimeModelConfigMutatesPropertiesAndKeepsApiKeyWriteOnly() {
        AiAssistantProperties properties = new AiAssistantProperties();
        RuntimeModelConfigController controller = controller(properties);
        RuntimeModelConfigService.UpdateRequest request =
                new RuntimeModelConfigService.UpdateRequest();
        request.setProvider("minimax");
        request.setBaseUrl("https://api.minimaxi.com/v1");
        request.setApiKey("runtime-secret");
        request.setModel("MiniMax-M2.7");
        request.setAllowedModelsText("MiniMax-M2.7, MiniMax-M2.5");
        request.setWarmupEnabled(true);
        request.setFastRouteMaxChars(72);
        request.setSlowTtftThresholdMs(2400);
        request.setSlowTotalThresholdMs(6500);
        request.setSlowRequestWarningStreak(4);

        var response = controller.updateRuntimeModelConfig(request);

        assertEquals(true, response.get("success"));
        assertEquals("minimax", response.get("provider"));
        assertEquals("MiniMax-M2.7", response.get("model"));
        assertEquals(List.of("MiniMax-M2.7", "MiniMax-M2.5"), response.get("allowedModels"));
        assertEquals(true, response.get("warmupEnabled"));
        assertEquals(true, response.get("apiKeyConfigured"));
        assertFalse(response.containsKey("apiKey"));
        assertTrue(properties.resolveApiKeys().contains("runtime-secret"));
        assertTrue(properties.isWarmupEnabled());
        assertEquals(72, response.get("fastRouteMaxChars"));
        assertEquals(2400, response.get("slowTtftThresholdMs"));
        assertEquals(6500, response.get("slowTotalThresholdMs"));
        assertEquals(4, response.get("slowRequestWarningStreak"));
        assertEquals(72, properties.getLatency().getFastRouteMaxChars());
    }

    private RuntimeModelConfigController controller(AiAssistantProperties properties) {
        return new RuntimeModelConfigController(new RuntimeModelConfigService(properties));
    }
}
