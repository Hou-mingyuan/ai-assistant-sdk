package com.aiassistant.observability;

import com.aiassistant.config.AiAssistantProperties;
import com.aiassistant.config.ProviderConnectivityChecker;
import org.springframework.boot.actuate.health.Health;
import org.springframework.boot.actuate.health.HealthIndicator;

/**
 * Actuator health indicator for the AI assistant.
 * Reports provider reachability and basic configuration status.
 */
public class AiAssistantHealthIndicator implements HealthIndicator {

    private final AiAssistantProperties properties;
    private final ProviderConnectivityChecker connectivityChecker;

    public AiAssistantHealthIndicator(AiAssistantProperties properties,
                                       ProviderConnectivityChecker connectivityChecker) {
        this.properties = properties;
        this.connectivityChecker = connectivityChecker;
    }

    @Override
    public Health health() {
        Health.Builder builder = Health.up();
        builder.withDetail("provider", properties.getProvider());
        builder.withDetail("model", properties.resolveModel());
        builder.withDetail("apiKeysConfigured", properties.resolveApiKeys().size());

        if (connectivityChecker != null) {
            var result = connectivityChecker.getLastResult();
            if (result != null) {
                builder.withDetail("providerReachable", result.success());
                if (result.latencyMs() > 0) {
                    builder.withDetail("providerLatencyMs", result.latencyMs());
                }
                if (!result.success()) {
                    builder.down().withDetail("reason", result.errorMessage());
                }
            } else {
                builder.withDetail("providerReachable", "pending");
            }
        }

        return builder.build();
    }
}
