package com.aiassistant.autoconfigure;

import com.aiassistant.config.AiAssistantProperties;
import com.aiassistant.config.ConnectorProperties;
import com.aiassistant.connector.ConnectorToolRegistrar;
import com.aiassistant.connector.DataConnector;
import com.aiassistant.service.LlmService;
import com.aiassistant.service.UrlFetchService;
import com.aiassistant.service.llm.ChatCompletionClient;
import com.aiassistant.service.llm.ProviderAwareChatCompletionClient;
import com.aiassistant.spi.ChatInterceptor;
import com.aiassistant.spi.ConversationMemoryProvider;
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
 * LLM 装配：ChatCompletionClient 默认实现、ToolRegistry（含 DataConnector 自动注册）、LlmService 的两个变体（含/不含
 * Micrometer）、ModelRouter、AgentExecutor、ResilientLlmClient。
 *
 * <p>Refactor (T2)：从 {@link AiAssistantAutoConfiguration} 拆出。所有 Bean 行为与原版 100% 一致。
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
    public ToolRegistry toolRegistry(
            ObjectProvider<List<ToolDefinition>> toolDefs,
            ObjectProvider<List<DataConnector>> connectorProvider,
            AiAssistantProperties properties) {
        List<ToolDefinition> defs = toolDefs.getIfAvailable();
        ToolRegistry registry = new ToolRegistry(defs != null ? defs : List.of());

        List<DataConnector> connectors = connectorProvider.getIfAvailable();
        if (connectors != null) {
            for (DataConnector connector : connectors) {
                ConnectorToolRegistrar.register(connector, registry);
            }
        }

        List<ConnectorProperties> cfgConnectors = properties.getConnectors();
        if (cfgConnectors != null) {
            java.util.Set<String> registeredIds = new java.util.HashSet<>();
            if (connectors != null) {
                connectors.forEach(c -> registeredIds.add(c.id()));
            }
            for (ConnectorProperties cfg : cfgConnectors) {
                if (registeredIds.contains(cfg.resolveId())) continue;
                DataConnector connector = com.aiassistant.connector.ConnectorFactory.create(cfg);
                if (connector != null) {
                    ConnectorToolRegistrar.register(connector, registry);
                }
            }
        }

        return registry;
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
                com.aiassistant.security.ContentFilter contentFilter,
                com.aiassistant.stats.TokenUsageTracker tokenUsageTracker,
                com.aiassistant.routing.ModelRouter modelRouter,
                ObjectProvider<com.aiassistant.rag.RagService> ragServiceProvider,
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
                    .ragService(ragServiceProvider.getIfAvailable())
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
            com.aiassistant.security.ContentFilter contentFilter,
            com.aiassistant.stats.TokenUsageTracker tokenUsageTracker,
            com.aiassistant.routing.ModelRouter modelRouter,
            ObjectProvider<com.aiassistant.rag.RagService> ragServiceProvider,
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
                .ragService(ragServiceProvider.getIfAvailable())
                .memoryProvider(memoryProviderProvider.getIfAvailable())
                .interceptors(interceptorsProvider.getIfAvailable())
                .auditEventStore(auditEventStoreProvider.getIfAvailable())
                .build();
    }

    @Bean
    @ConditionalOnMissingBean
    public com.aiassistant.routing.ModelRouter modelRouter(AiAssistantProperties properties) {
        return new com.aiassistant.routing.ModelRouter(properties.resolveModel());
    }

    @Bean
    @ConditionalOnMissingBean
    public com.aiassistant.agent.AgentExecutor agentExecutor(ToolRegistry toolRegistry) {
        return new com.aiassistant.agent.AgentExecutor(toolRegistry);
    }

    @Bean
    @ConditionalOnMissingBean
    @ConditionalOnClass(name = "io.github.resilience4j.circuitbreaker.CircuitBreaker")
    public com.aiassistant.resilience.ResilientLlmClient resilientLlmClient() {
        return new com.aiassistant.resilience.ResilientLlmClient();
    }
}
