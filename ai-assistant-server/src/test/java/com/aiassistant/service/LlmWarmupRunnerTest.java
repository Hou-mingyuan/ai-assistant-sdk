package com.aiassistant.service;

import static org.mockito.Mockito.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.aiassistant.config.AiAssistantProperties;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

class LlmWarmupRunnerTest {

    @Test
    void disabledWarmupDoesNotCallModel() {
        AiAssistantProperties properties = new AiAssistantProperties();
        properties.setWarmupEnabled(false);
        LlmService llmService = Mockito.mock(LlmService.class);

        new LlmWarmupRunner(properties, llmService).warmupOnce();

        verify(llmService, never()).chat(any(), any(), any(), any());
    }

    @Test
    void warmupSkipsWhenNoProviderKeyIsConfigured() {
        AiAssistantProperties properties = new AiAssistantProperties();
        properties.setWarmupEnabled(true);
        properties.setProvider("minimax");
        properties.setModel("MiniMax-M2.7");
        LlmService llmService = Mockito.mock(LlmService.class);

        new LlmWarmupRunner(properties, llmService).warmupOnce();

        verify(llmService, never()).chat(any(), any(), any(), any());
    }

    @Test
    void warmupCallsDefaultModelAndSwallowsProviderFailure() {
        AiAssistantProperties properties = new AiAssistantProperties();
        properties.setWarmupEnabled(true);
        properties.setProvider("minimax");
        properties.setModel("MiniMax-M2.7");
        properties.setApiKey("sk-test");
        LlmService llmService = Mockito.mock(LlmService.class);
        when(llmService.chat(
                        LlmWarmupRunner.WARMUP_PROMPT,
                        null,
                        null,
                        "MiniMax-M2.7"))
                .thenThrow(new RuntimeException("upstream unavailable"));

        new LlmWarmupRunner(properties, llmService).warmupOnce();

        verify(llmService).chat(LlmWarmupRunner.WARMUP_PROMPT, null, null, "MiniMax-M2.7");
    }
}
