package com.aiassistant.config;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.List;
import org.junit.jupiter.api.Test;

class ProviderModelDiscoveryTest {

    private final ProviderModelDiscovery discovery = new ProviderModelDiscovery();

    @Test
    void parsesOpenAiCompatibleDataArray() throws Exception {
        List<String> models =
                discovery.parseModels(
                        "openai",
                        """
                        {"data":[{"id":"gpt-5.4"},{"id":"gpt-5.4"},{"id":"gpt-5.4-mini"}]}
                        """);

        assertEquals(List.of("gpt-5.4", "gpt-5.4-mini"), models);
    }

    @Test
    void parsesProviderSpecificModelsArray() throws Exception {
        List<String> models =
                discovery.parseModels(
                        "minimax",
                        """
                        {"models":[{"model":"MiniMax-M2.5"},{"name":"MiniMax-M2.7"}]}
                        """);

        assertEquals(List.of("MiniMax-M2.5", "MiniMax-M2.7"), models);
    }
}
