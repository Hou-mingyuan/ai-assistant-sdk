package com.aiassistant.observabilitysupport;

import static org.assertj.core.api.Assertions.assertThat;

import com.aiassistant.autoconfigure.AiAssistantOpenApiAutoConfiguration;
import io.swagger.v3.oas.models.OpenAPI;
import org.junit.jupiter.api.Test;
import org.springframework.boot.autoconfigure.AutoConfigurations;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;

class OpenApiSupportAutoConfigurationTest {

    private final ApplicationContextRunner contextRunner =
            new ApplicationContextRunner()
                    .withConfiguration(
                            AutoConfigurations.of(AiAssistantOpenApiAutoConfiguration.class));

    @Test
    void registersOpenApiBeanWhenExplicitlyEnabled() {
        contextRunner
                .withPropertyValues(
                        "ai-assistant.openapi.enabled=true",
                        "ai-assistant.context-path=/custom-ai")
                .run(
                        context -> {
                            assertThat(context).hasSingleBean(OpenAPI.class);
                            OpenAPI openApi = context.getBean(OpenAPI.class);
                            assertThat(openApi.getServers())
                                    .anySatisfy(
                                            server ->
                                                    assertThat(server.getUrl())
                                                            .isEqualTo("/custom-ai"));
                        });
    }
}
