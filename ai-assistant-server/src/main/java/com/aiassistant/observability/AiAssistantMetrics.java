package com.aiassistant.observability;

import com.aiassistant.spi.AssistantCapability;
import com.aiassistant.stats.TokenUsageTracker;
import com.aiassistant.tool.ToolRegistry;
import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.MeterRegistry;
import java.util.List;

/**
 * Registers custom Micrometer gauges for the AI assistant. Provides real-time metrics for
 * observability dashboards (Prometheus, Grafana, etc.).
 */
public class AiAssistantMetrics {

    public AiAssistantMetrics(
            MeterRegistry registry,
            List<AssistantCapability> capabilities,
            ToolRegistry toolRegistry,
            TokenUsageTracker tokenUsageTracker) {

        if (capabilities != null) {
            Gauge.builder("aiassistant.capabilities.count", capabilities, List::size)
                    .description("Number of registered assistant capabilities")
                    .register(registry);
        }

        if (toolRegistry != null) {
            Gauge.builder(
                            "aiassistant.tools.count",
                            toolRegistry,
                            tr -> tr.isEmpty() ? 0 : tr.toOpenAiToolsArray().size())
                    .description("Number of registered tools")
                    .register(registry);
        }

        if (tokenUsageTracker != null) {
            Gauge.builder(
                            "aiassistant.tokens.total",
                            tokenUsageTracker,
                            TokenUsageTracker::getTotalTokens)
                    .description("Total tokens consumed across all tenants")
                    .register(registry);
        }
    }
}
