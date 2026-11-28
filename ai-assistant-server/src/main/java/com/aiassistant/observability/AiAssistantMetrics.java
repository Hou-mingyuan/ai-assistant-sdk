package com.aiassistant.observability;

import com.aiassistant.stats.TokenUsageTracker;
import com.aiassistant.tool.ToolRegistry;
import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.MeterRegistry;

/** Exports live Micrometer gauges for registered tools and cumulative token consumption. */
public class AiAssistantMetrics {

    public AiAssistantMetrics(
            MeterRegistry registry,
            ToolRegistry toolRegistry,
            TokenUsageTracker tokenUsageTracker) {
        if (registry == null) {
            return;
        }
        if (toolRegistry != null) {
            Gauge.builder(
                            "aiassistant.tools.count",
                            toolRegistry,
                            r -> r.isEmpty() ? 0.0 : r.toOpenAiToolsArray().size())
                    .description("Registered LLM tools")
                    .register(registry);
        }
        if (tokenUsageTracker != null) {
            Gauge.builder(
                            "aiassistant.tokens.total",
                            tokenUsageTracker,
                            t -> (double) t.getTotalTokens())
                    .description("Cumulative LLM tokens recorded by TokenUsageTracker")
                    .register(registry);
        }
    }
}
