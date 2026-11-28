package com.aiassistant.autoconfigure;

import com.aiassistant.config.AiAssistantProperties;
import com.aiassistant.routing.ModelRouter;
import com.aiassistant.security.ContentFilter;
import com.aiassistant.security.SsrfPolicy;
import com.aiassistant.service.LlmService;
import com.aiassistant.service.UrlFetchService;
import com.aiassistant.service.llm.ChatCompletionClient;
import com.aiassistant.service.llm.ProviderAwareChatCompletionClient;
import com.aiassistant.spi.ChatInterceptor;
import com.aiassistant.spi.ConversationMemoryProvider;
import com.aiassistant.stats.TokenUsageTracker;
import com.aiassistant.tool.ToolDefinition;
import com.aiassistant.tool.ToolRegistry;
import java.util.List;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnClass;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingClass;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * LLM 装配：ChatCompletionClient 默认实现、UrlFetchService、ToolRegistry、LlmService 的两个变体（含/不含
 * Micrometer）、ModelRouter、ResilientLlmClient。
 */
@Configuration(proxyBeanMethods = false)
public class AiAssistantLlmAutoConfiguration {

    @Bean
    @ConditionalOnMissingBean
    public ChatCompletionClient chatCompletionClient(AiAssistantProperties properties) {
        return new ProviderAwareChatCompletionClient(properties);
    }

    @Bean
    @ConditionalOnMissingBean
    public UrlFetchService urlFetchService(
            AiAssistantProperties properties, SsrfPolicy ssrfPolicy) {
        return new UrlFetchService(properties, null, ssrfPolicy);
    }

    @Bean
    @ConditionalOnMissingBean
    public ToolRegistry toolRegistry(ObjectProvider<List<ToolDefinition>> toolDefs) {
        List<ToolDefinition> defs = toolDefs.getIfAvailable();
        return new ToolRegistry(defs != null ? defs : List.of());
    }

    @Configuration(proxyBeanMethods = false)
    @ConditionalOnClass(name = "io.micrometer.core.instrument.MeterRegistry")
    static class MicrometerLlmServiceConfiguration {
        @Bean
        @ConditionalOnMissingBean(LlmService.class)
        public LlmService llmServiceWithMetrics(
                AiAssistantProperties properties,
                UrlFetchService urlFetchService,
                ChatCompletionClient chatCompletionClient,
                ObjectProvider<io.micrometer.core.instrument.MeterRegistry> meterRegistryProvider,
                ToolRegistry toolRegistry,
                ContentFilter contentFilter,
                TokenUsageTracker tokenUsageTracker,
                ModelRouter modelRouter,
                ObjectProvider<ConversationMemoryProvider> memoryProviderProvider,
                ObjectProvider<List<ChatInterceptor>> interceptorsProvider,
                ObjectProvider<com.aiassistant.audit.AuditEventStore> auditEventStoreProvider) {
            return LlmService.builder()
                    .properties(properties)
                    .urlFetchService(urlFetchService)
                    .chatCompletionClient(chatCompletionClient)
                    .meterRegistry(meterRegistryProvider.getIfAvailable())
                    .toolRegistry(toolRegistry)
                    .contentFilter(contentFilter)
                    .tokenUsageTracker(tokenUsageTracker)
                    .modelRouter(modelRouter)
                    .memoryProvider(memoryProviderProvider.getIfAvailable())
                    .interceptors(interceptorsProvider.getIfAvailable())
                    .auditEventStore(auditEventStoreProvider.getIfAvailable())
                    .build();
        }
    }

    @Bean
    @ConditionalOnMissingBean(LlmService.class)
    @ConditionalOnMissingClass("io.micrometer.core.instrument.MeterRegistry")
    public LlmService llmServiceWithoutMetrics(
            AiAssistantProperties properties,
            UrlFetchService urlFetchService,
            ChatCompletionClient chatCompletionClient,
            ToolRegistry toolRegistry,
            ContentFilter contentFilter,
            TokenUsageTracker tokenUsageTracker,
            ModelRouter modelRouter,
            ObjectProvider<ConversationMemoryProvider> memoryProviderProvider,
            ObjectProvider<List<ChatInterceptor>> interceptorsProvider,
            ObjectProvider<com.aiassistant.audit.AuditEventStore> auditEventStoreProvider) {
        return LlmService.builder()
                .properties(properties)
                .urlFetchService(urlFetchService)
                .chatCompletionClient(chatCompletionClient)
                .meterRegistry(null)
                .toolRegistry(toolRegistry)
                .contentFilter(contentFilter)
                .tokenUsageTracker(tokenUsageTracker)
                .modelRouter(modelRouter)
                .memoryProvider(memoryProviderProvider.getIfAvailable())
                .interceptors(interceptorsProvider.getIfAvailable())
                .auditEventStore(auditEventStoreProvider.getIfAvailable())
                .build();
    }

    @Bean
    @ConditionalOnMissingBean
    public ModelRouter modelRouter(AiAssistantProperties properties) {
        return new ModelRouter(properties.resolveModel());
    }

    @Bean
    @ConditionalOnMissingBean
    @ConditionalOnClass(name = "io.github.resilience4j.circuitbreaker.CircuitBreaker")
    public com.aiassistant.resilience.ResilientLlmClient resilientLlmClient() {
        return new com.aiassistant.resilience.ResilientLlmClient();
    }
}
