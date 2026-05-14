package com.aiassistant.autoconfigure;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.aiassistant.security.AllowlistSsrfPolicy;
import com.aiassistant.security.DefaultSsrfPolicy;
import com.aiassistant.security.SsrfPolicy;
import java.net.URI;
import org.junit.jupiter.api.Test;
import org.springframework.boot.autoconfigure.AutoConfigurations;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;

class AiAssistantHardeningAutoConfigurationTest {

    private final ApplicationContextRunner contextRunner =
            new ApplicationContextRunner()
                    .withConfiguration(
                            AutoConfigurations.of(AiAssistantHardeningAutoConfiguration.class));

    @Test
    void disabledByDefaultLeavesNoSsrfPolicyBean() {
        contextRunner.run(
                ctx ->
                        assertThat(ctx.getBeansOfType(SsrfPolicy.class))
                                .as("default should not register a policy")
                                .isEmpty());
    }

    @Test
    void enabledWithHostsRegistersAllowlistPolicy() {
        contextRunner
                .withPropertyValues(
                        "ai-assistant.url-fetch.ssrf-allowlist.enabled=true",
                        "ai-assistant.url-fetch.ssrf-allowlist.hosts[0]=api.example.com",
                        "ai-assistant.url-fetch.ssrf-allowlist.hosts[1]=*.test.io")
                .run(
                        ctx -> {
                            assertThat(ctx).hasSingleBean(SsrfPolicy.class);
                            SsrfPolicy policy = ctx.getBean(SsrfPolicy.class);
                            assertThat(policy).isInstanceOf(AllowlistSsrfPolicy.class);
                            /* Validate pattern matching without invoking real DNS:
                             * - allowlist entries are matched against URI host before DNS,
                             *   and the base DefaultSsrfPolicy will resolve DNS for hosts on
                             *   the allowlist. In CI environments where DNS is captive or
                             *   the host doesn't exist, the base will reject -- which is fine
                             *   for proving the wrapper still calls the base. */
                            AllowlistSsrfPolicy alp = (AllowlistSsrfPolicy) policy;
                            assertThat(alp.getPatterns())
                                    .containsExactly("api.example.com", "*.test.io");
                            assertThatThrownBy(
                                            () ->
                                                    policy.validate(
                                                            URI.create("https://blocked.com/x")))
                                    .isInstanceOf(IllegalArgumentException.class);
                        });
    }

    @Test
    void enabledWithEmptyHostsFallsBackToDefault() {
        contextRunner
                .withPropertyValues("ai-assistant.url-fetch.ssrf-allowlist.enabled=true")
                .run(
                        ctx -> {
                            assertThat(ctx).hasSingleBean(SsrfPolicy.class);
                            SsrfPolicy policy = ctx.getBean(SsrfPolicy.class);
                            assertThat(policy).isSameAs(DefaultSsrfPolicy.INSTANCE);
                        });
    }

    @Test
    void hostProvidedPolicyOverridesAutoConfiguration() {
        contextRunner
                .withPropertyValues(
                        "ai-assistant.url-fetch.ssrf-allowlist.enabled=true",
                        "ai-assistant.url-fetch.ssrf-allowlist.hosts[0]=example.com")
                .withBean(
                        SsrfPolicy.class,
                        () ->
                                uri -> {
                                    /* permissive host-side override */
                                })
                .run(
                        ctx -> {
                            assertThat(ctx).hasSingleBean(SsrfPolicy.class);
                            SsrfPolicy policy = ctx.getBean(SsrfPolicy.class);
                            assertThat(policy).isNotInstanceOf(AllowlistSsrfPolicy.class);
                            policy.validate(URI.create("https://anywhere.io/path"));
                        });
    }
}
