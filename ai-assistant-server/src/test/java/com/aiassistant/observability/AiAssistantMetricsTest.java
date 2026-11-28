package com.aiassistant.observability;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.aiassistant.stats.TokenUsageTracker;
import com.aiassistant.tool.ToolRegistry;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.Test;

class AiAssistantMetricsTest {

    @Test
    void registersLiveToolAndTokenGauges() {
        var registry = new SimpleMeterRegistry();
        var toolRegistry = mock(ToolRegistry.class);
        var tools = new ObjectMapper().createArrayNode();
        tools.addObject();
        tools.addObject();
        var tokenUsageTracker = mock(TokenUsageTracker.class);

        when(toolRegistry.isEmpty()).thenReturn(false);
        when(toolRegistry.toOpenAiToolsArray()).thenReturn(tools);
        when(tokenUsageTracker.getTotalTokens()).thenReturn(42L);

        new AiAssistantMetrics(registry, toolRegistry, tokenUsageTracker);

        assertThat(registry.get("aiassistant.tools.count").gauge().value()).isEqualTo(2.0);
        assertThat(registry.get("aiassistant.tokens.total").gauge().value()).isEqualTo(42.0);
    }

    @Test
    void skipsGaugesForUnavailableOptionalCollaborators() {
        var registry = new SimpleMeterRegistry();

        new AiAssistantMetrics(registry, null, null);

        assertThat(registry.getMeters()).isEmpty();
    }
}
