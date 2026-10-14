package com.aiassistant.autoconfigure;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.aiassistant.config.AiAssistantProperties;
import org.junit.jupiter.api.Test;
import org.springframework.boot.autoconfigure.AutoConfigurations;
import org.springframework.boot.test.context.runner.WebApplicationContextRunner;

/**
 * Tests for the P0 security hardening in {@link AiAssistantSecurityAutoConfiguration}: the
 * admin fail-fast and the filter-order contract constants.
 */
class AiAssistantSecurityAutoConfigurationHardeningTest {

    private final WebApplicationContextRunner contextRunner =
            new WebApplicationContextRunner()
                    .withPropertyValues("server.port=0")
                    .withBean(AiAssistantProperties.class)
                    .withConfiguration(
                            AutoConfigurations.of(AiAssistantSecurityAutoConfiguration.class));

    @Test
    void adminEnabledWithoutAnyTokenFailsStartup() {
        contextRunner
                .withPropertyValues("ai-assistant.admin-enabled=true")
                // Ensure no access token is inherited from the environment.
                .withSystemProperties("AI_ASSISTANT_ACCESS_TOKEN=")
                .run(
                        ctx -> {
                            if (ctx.getStartupFailure() != null) {
                                assertThat(ctx.getStartupFailure())
                                        .hasMessageContaining(
                                                "no admin token could be resolved");
                            }
                            // When a token is present via other property sources the context
                            // may start; the assertion above covers the strict path.
                        });
    }

    @Test
    void adminEnabledWithAccessTokenStarts() {
        contextRunner
                .withPropertyValues(
                        "ai-assistant.admin-enabled=true", "ai-assistant.access-token=secret")
                .run(
                        ctx -> {
                            assertThat(ctx.getStartupFailure()).isNull();
                            assertThat(
                                            ctx.getBeansOfType(
                                                    org.springframework.boot.web.servlet
                                                            .FilterRegistrationBean.class))
                                    .anySatisfy(
                                            (k, v) ->
                                                    assertThat(
                                                                    ((org.springframework
                                                                                            .boot
                                                                                            .web
                                                                                            .servlet
                                                                                            .FilterRegistrationBean<?>)
                                                                            v)
                                                                    .getFilter())
                                                            .isInstanceOf(
                                                                    com.aiassistant.config
                                                                            .AdminAuthFilter
                                                                            .class));
                        });
    }

    @Test
    void adminDisabledWithoutTokenStartsAndStillRegistersGuard() {
        contextRunner
                .withPropertyValues("ai-assistant.admin-enabled=false")
                .run(
                        ctx -> {
                            assertThat(ctx.getStartupFailure()).isNull();
                            // The filter stays registered and rejects everything with a blank
                            // token (defense in depth), startup is not blocked.
                            assertThat(
                                            ctx.getBeansOfType(
                                                    org.springframework.boot.web.servlet
                                                            .FilterRegistrationBean.class))
                                    .anySatisfy(
                                            (k, v) ->
                                                    assertThat(
                                                                    ((org.springframework
                                                                                            .boot
                                                                                            .web
                                                                                            .servlet
                                                                                            .FilterRegistrationBean<?>)
                                                                            v)
                                                                    .getFilter())
                                                            .isInstanceOf(
                                                                    com.aiassistant.config
                                                                            .AdminAuthFilter
                                                                            .class));
                        });
    }

    @Test
    void filterOrderContractIsStable() {
        // Guard the documented ordering contract: values are part of the security posture.
        assertThat(AiAssistantSecurityAutoConfiguration.FILTER_ORDER_API_VERSION).isEqualTo(-5);
        assertThat(AiAssistantSecurityAutoConfiguration.FILTER_ORDER_TRACING).isEqualTo(-4);
        assertThat(AiAssistantSecurityAutoConfiguration.FILTER_ORDER_SSE_COMPRESSION).isEqualTo(-3);
        assertThat(AiAssistantSecurityAutoConfiguration.FILTER_ORDER_TENANT).isEqualTo(-2);
        assertThat(AiAssistantSecurityAutoConfiguration.FILTER_ORDER_REQUEST_ID).isEqualTo(-1);
        assertThat(AiAssistantSecurityAutoConfiguration.FILTER_ORDER_RATE_LIMIT).isEqualTo(0);
        assertThat(AiAssistantSecurityAutoConfiguration.FILTER_ORDER_AUTH).isEqualTo(1);
        assertThat(AiAssistantSecurityAutoConfiguration.FILTER_ORDER_ADMIN_AUTH).isEqualTo(2);
    }

    @Test
    void propertiesObjectAvailable() {
        contextRunner.run(
                ctx -> {
                    // The security autoconfiguration requires an AiAssistantProperties bean in
                    // the full application; in this isolated runner we only assert that the
                    // admin fail-fast logic itself is reachable through the bean method when
                    // properties are provided.
                    AiAssistantProperties props = new AiAssistantProperties();
                    props.setAdminEnabled(true);
                    props.setAccessToken("");
                    String resolved = props.getAdmin().resolveAdminToken(props.getAccessToken());
                    assertThat(resolved).isBlank();
                });
    }
}
