package com.aiassistant.autoconfigure;

import static org.assertj.core.api.Assertions.assertThat;

import com.aiassistant.config.AiAssistantProperties;
import org.junit.jupiter.api.Test;
import org.springframework.boot.autoconfigure.AutoConfigurations;
import org.springframework.boot.test.context.runner.WebApplicationContextRunner;

/** Tests for the security filter-order contract in {@link AiAssistantSecurityAutoConfiguration}. */
class AiAssistantSecurityAutoConfigurationHardeningTest {

    private final WebApplicationContextRunner contextRunner =
            new WebApplicationContextRunner()
                    .withPropertyValues("server.port=0")
                    .withBean(AiAssistantProperties.class)
                    .withConfiguration(
                            AutoConfigurations.of(AiAssistantSecurityAutoConfiguration.class));

    @Test
    void filterOrderContractIsStable() {
        assertThat(AiAssistantSecurityAutoConfiguration.FILTER_ORDER_API_VERSION).isEqualTo(-5);
        assertThat(AiAssistantSecurityAutoConfiguration.FILTER_ORDER_TRACING).isEqualTo(-4);
        assertThat(AiAssistantSecurityAutoConfiguration.FILTER_ORDER_SSE_COMPRESSION).isEqualTo(-3);
        assertThat(AiAssistantSecurityAutoConfiguration.FILTER_ORDER_TENANT).isEqualTo(-2);
        assertThat(AiAssistantSecurityAutoConfiguration.FILTER_ORDER_REQUEST_ID).isEqualTo(-1);
        assertThat(AiAssistantSecurityAutoConfiguration.FILTER_ORDER_RATE_LIMIT).isEqualTo(0);
        assertThat(AiAssistantSecurityAutoConfiguration.FILTER_ORDER_AUTH).isEqualTo(1);
    }

    @Test
    void propertiesObjectAvailable() {
        contextRunner.run(
                ctx -> {
                    assertThat(ctx.getStartupFailure()).isNull();
                    assertThat(ctx.getBean(AiAssistantProperties.class)).isNotNull();
                });
    }
}
