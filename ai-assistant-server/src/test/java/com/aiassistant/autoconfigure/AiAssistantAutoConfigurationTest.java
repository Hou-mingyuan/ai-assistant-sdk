package com.aiassistant.autoconfigure;

import static org.assertj.core.api.Assertions.assertThat;

import com.aiassistant.config.AiAssistantProperties;
import com.aiassistant.config.RateLimitFilter;
import com.aiassistant.controller.AiAssistantController;
import com.aiassistant.controller.AssistantExportController;
import com.aiassistant.controller.CapabilityController;
import com.aiassistant.controller.FileUploadController;
import com.aiassistant.controller.RuntimeConfigController;
import com.aiassistant.controller.SseStreamController;
import com.aiassistant.controller.StatsController;
import com.aiassistant.routing.ModelRouter;
import com.aiassistant.security.ContentFilter;
import com.aiassistant.security.DefaultSsrfPolicy;
import com.aiassistant.security.SsrfPolicy;
import com.aiassistant.service.AssistantExportService;
import com.aiassistant.service.FileParserService;
import com.aiassistant.service.LlmService;
import com.aiassistant.service.SessionStore;
import com.aiassistant.service.UrlFetchService;
import com.aiassistant.service.llm.ChatCompletionClient;
import com.aiassistant.service.llm.OpenAiCompatibleChatClient;
import com.aiassistant.stats.TokenUsageTracker;
import com.aiassistant.stats.UsageStats;
import com.aiassistant.tool.ToolRegistry;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.Test;
import org.springframework.boot.autoconfigure.AutoConfigurations;
import org.springframework.boot.test.context.FilteredClassLoader;
import org.springframework.boot.test.context.runner.WebApplicationContextRunner;
import org.springframework.boot.web.servlet.FilterRegistrationBean;

/**
 * Smoke-tests {@link AiAssistantAutoConfiguration} via {@link WebApplicationContextRunner}.
 *
 * <p>Before this suite landed, the entire {@code com.aiassistant.autoconfigure} package was at 0%
 * coverage — the auto-wiring entry point was completely unverified, which meant a subtle
 * conditional-bean regression could ship without anyone noticing. The cases below cover the three
 * shape-of-wiring axes that matter in practice:
 *
 * <ol>
 *   <li>{@link AiAssistantAutoConfiguration.ApiKeyConfigured} gates the whole module — verify both
 *       activation paths and the negative case.
 *   <li>Default beans (no host overrides) actually materialise the controllers, services and
 *       filters a host application expects on the bus.
 *   <li>{@code @ConditionalOnMissingBean} actually defers to user beans for the substitution
 *       extension points the docs promise (most importantly {@link ChatCompletionClient} and {@link
 *       SsrfPolicy}).
 * </ol>
 */
class AiAssistantAutoConfigurationTest {

    /**
     * Filter Redis and Playwright off the classpath so the nested {@link
     * AiAssistantAutoConfiguration.RedisSessionStoreAutoConfiguration} and {@link
     * AiAssistantAutoConfiguration.HeadlessFetchAutoConfiguration} blocks don't activate — the host
     * POM declares those as optional dependencies which means our test JVM does have them on the
     * classpath, but a host that does not wire a {@code StringRedisTemplate} or enable headless
     * fetching should still get a clean, in-memory wiring (which is what this smoke test asserts).
     */
    private final WebApplicationContextRunner contextRunner =
            new WebApplicationContextRunner()
                    .withConfiguration(AutoConfigurations.of(AiAssistantAutoConfiguration.class))
                    .withClassLoader(
                            new FilteredClassLoader(
                                    "org.springframework.data.redis.core.StringRedisTemplate",
                                    "com.microsoft.playwright.Playwright"))
                    /* Spring Boot's MetricsAutoConfiguration normally contributes a
                     * SimpleMeterRegistry on the bus; the AppContextRunner does not pull it
                     * in automatically, so register a no-op meter registry to satisfy the
                     * AiAssistantMetrics + LlmService bean wiring. */
                    .withBean(MeterRegistry.class, SimpleMeterRegistry::new);

    private final WebApplicationContextRunner redisClasspathContextRunner =
            new WebApplicationContextRunner()
                    .withConfiguration(AutoConfigurations.of(AiAssistantAutoConfiguration.class))
                    .withClassLoader(new FilteredClassLoader("com.microsoft.playwright.Playwright"))
                    .withBean(MeterRegistry.class, SimpleMeterRegistry::new);

    @Test
    void autoConfigurationDoesNotActivateWhenNoApiKeyConfigured() {
        contextRunner.run(
                context -> {
                    assertThat(context).doesNotHaveBean(LlmService.class);
                    assertThat(context).doesNotHaveBean(AiAssistantProperties.class);
                });
    }

    @Test
    void autoConfigurationActivatesWithSingleApiKey() {
        contextRunner
                .withPropertyValues(
                        "ai-assistant.api-key=sk-test-single", "ai-assistant.provider=openai")
                .run(
                        context -> {
                            assertThat(context).hasSingleBean(AiAssistantProperties.class);
                            assertThat(context).hasSingleBean(LlmService.class);
                            assertThat(context).hasSingleBean(UrlFetchService.class);
                            assertThat(context).hasSingleBean(ChatCompletionClient.class);
                        });
    }

    @Test
    void autoConfigurationActivatesWithMultiApiKeysList() {
        contextRunner
                .withPropertyValues(
                        "ai-assistant.api-keys[0]=sk-rotation-a",
                        "ai-assistant.api-keys[1]=sk-rotation-b",
                        "ai-assistant.provider=deepseek")
                .run(
                        context -> {
                            assertThat(context).hasSingleBean(LlmService.class);
                            AiAssistantProperties properties =
                                    context.getBean(AiAssistantProperties.class);
                            assertThat(properties.resolveApiKeys())
                                    .containsExactly("sk-rotation-a", "sk-rotation-b");
                        });
    }

    @Test
    void contributesCoreControllerAndFilterBeans() {
        contextRunner
                .withPropertyValues("ai-assistant.api-key=sk-test-controllers")
                .run(
                        context -> {
                            assertThat(context).hasSingleBean(AiAssistantController.class);
                            assertThat(context).hasSingleBean(SseStreamController.class);
                            assertThat(context).hasSingleBean(StatsController.class);
                            assertThat(context).hasSingleBean(RuntimeConfigController.class);
                            assertThat(context).hasSingleBean(CapabilityController.class);
                            assertThat(context).hasSingleBean(FileUploadController.class);
                            assertThat(context).hasSingleBean(AssistantExportController.class);
                            assertThat(context).hasSingleBean(AssistantExportService.class);
                            assertThat(context).hasSingleBean(FileParserService.class);
                            assertThat(context).hasSingleBean(SessionStore.class);
                            assertThat(context).hasSingleBean(UsageStats.class);
                            assertThat(context).hasSingleBean(TokenUsageTracker.class);
                            assertThat(context).hasSingleBean(ModelRouter.class);
                            assertThat(context).hasSingleBean(ToolRegistry.class);
                            assertThat(context).hasSingleBean(ContentFilter.class);
                            assertThat(context).hasSingleBean(SsrfPolicy.class);
                            assertThat(context.getBean(SsrfPolicy.class))
                                    .isInstanceOf(DefaultSsrfPolicy.class);
                        });
    }

    @Test
    void hostMayReplaceChatCompletionClientWithCustomBean() {
        CustomChatClient host = new CustomChatClient();
        contextRunner
                .withPropertyValues("ai-assistant.api-key=sk-test-override")
                .withBean(ChatCompletionClient.class, () -> host)
                .run(
                        context -> {
                            assertThat(context).hasSingleBean(ChatCompletionClient.class);
                            assertThat(context.getBean(ChatCompletionClient.class)).isSameAs(host);
                            assertThat(context.getBean(ChatCompletionClient.class))
                                    .isNotInstanceOf(OpenAiCompatibleChatClient.class);
                        });
    }

    @Test
    void hostMayReplaceSsrfPolicyWithCustomBean() {
        SsrfPolicy custom =
                uri -> {
                    /* permissive smoke-test policy */
                };
        contextRunner
                .withPropertyValues("ai-assistant.api-key=sk-test-ssrf-override")
                .withBean(SsrfPolicy.class, () -> custom)
                .run(
                        context -> {
                            assertThat(context).hasSingleBean(SsrfPolicy.class);
                            assertThat(context.getBean(SsrfPolicy.class)).isSameAs(custom);
                        });
    }

    @Test
    void contextPathPropertyFlowsIntoControllers() {
        contextRunner
                .withPropertyValues(
                        "ai-assistant.api-key=sk-test-ctx", "ai-assistant.context-path=/custom-ai")
                .run(
                        context -> {
                            AiAssistantProperties properties =
                                    context.getBean(AiAssistantProperties.class);
                            assertThat(properties.getContextPath()).isEqualTo("/custom-ai");
                        });
    }

    @Test
    void apiVersionDoesNotMutateBaseContextPathAndFiltersCoverAliases() {
        contextRunner
                .withPropertyValues(
                        "ai-assistant.api-key=sk-test-version",
                        "ai-assistant.access-token=secret",
                        "ai-assistant.api-version=v1")
                .run(
                        context -> {
                            AiAssistantProperties properties =
                                    context.getBean(AiAssistantProperties.class);
                            assertThat(properties.getContextPath()).isEqualTo("/ai-assistant");

                            @SuppressWarnings("unchecked")
                            FilterRegistrationBean<?> authFilter =
                                    (FilterRegistrationBean<?>)
                                            context.getBean("aiAssistantAuthFilter");
                            assertThat(authFilter.getUrlPatterns())
                                    .containsExactlyInAnyOrder(
                                            "/ai-assistant/*",
                                            "/ai-assistant/v1/*",
                                            "/api/v1/ai-assistant/*");
                        });
    }

    @Test
    void localRateLimitStillRegistersWhenRedisClassExistsButNoRedisBeanExists() {
        redisClasspathContextRunner
                .withPropertyValues(
                        "ai-assistant.api-key=sk-test-rate-limit", "ai-assistant.rate-limit=60")
                .run(
                        context -> {
                            assertThat(context)
                                    .hasBean("aiAssistantRateLimitFilter")
                                    .doesNotHaveBean("aiAssistantRedisRateLimitFilter");
                            @SuppressWarnings("unchecked")
                            FilterRegistrationBean<RateLimitFilter> rateLimitFilter =
                                    (FilterRegistrationBean<RateLimitFilter>)
                                            context.getBean("aiAssistantRateLimitFilter");
                            assertThat(rateLimitFilter.getFilter())
                                    .isInstanceOf(RateLimitFilter.class);
                        });
    }

    /**
     * Bare host-supplied {@link ChatCompletionClient} replacement; the actual contract is
     * irrelevant for the wiring assertion and the methods stay unimplemented on purpose so we
     * notice if {@code ChatCompletionClient}'s shape ever changes (compile-fail beats silent
     * coverage).
     */
    static final class CustomChatClient implements ChatCompletionClient {
        @Override
        public String complete(
                com.fasterxml.jackson.databind.node.ObjectNode requestBody, String apiKey) {
            throw new UnsupportedOperationException("smoke-test stub");
        }

        @Override
        public reactor.core.publisher.Flux<String> completeStream(
                com.fasterxml.jackson.databind.node.ObjectNode requestBody, String apiKey) {
            throw new UnsupportedOperationException("smoke-test stub");
        }
    }
}
