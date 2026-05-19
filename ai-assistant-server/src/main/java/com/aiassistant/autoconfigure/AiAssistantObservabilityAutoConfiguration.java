package com.aiassistant.autoconfigure;

import com.aiassistant.config.AiAssistantProperties;
import com.aiassistant.spi.AssistantCapability;
import com.aiassistant.spi.ConversationMemoryProvider;
import com.aiassistant.stats.TokenUsageTracker;
import com.aiassistant.tool.ToolRegistry;
import java.util.List;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnClass;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.ApplicationListener;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * 可观测性装配：Capability Banner、安全姿态 Advisor、多副本存储 Advisor、Provider 连通性 Checker、 Actuator
 * HealthIndicator、Micrometer Metrics、Event Publisher。
 *
 * <p>Refactor (T2)：从 {@link AiAssistantAutoConfiguration} 拆出。
 */
@Configuration(proxyBeanMethods = false)
public class AiAssistantObservabilityAutoConfiguration {

    @Bean
    @ConditionalOnMissingBean
    public com.aiassistant.config.AiAssistantSecurityPostureAdvisor
            aiAssistantSecurityPostureAdvisor(AiAssistantProperties properties) {
        com.aiassistant.config.AiAssistantSecurityPostureAdvisor advisor =
                new com.aiassistant.config.AiAssistantSecurityPostureAdvisor(properties);
        advisor.logWarnings();
        return advisor;
    }

    @Bean
    @ConditionalOnMissingBean
    public com.aiassistant.config.AiAssistantCapabilityBanner aiAssistantCapabilityBanner(
            AiAssistantProperties properties) {
        return new com.aiassistant.config.AiAssistantCapabilityBanner(properties);
    }

    @Bean
    public ApplicationListener<ApplicationReadyEvent> aiAssistantCapabilityBannerLogger(
            com.aiassistant.config.AiAssistantCapabilityBanner banner) {
        return event -> banner.logBanner();
    }

    @Bean
    @ConditionalOnMissingBean
    public com.aiassistant.config.MultiReplicaStorageAdvisor multiReplicaStorageAdvisor() {
        return new com.aiassistant.config.MultiReplicaStorageAdvisor();
    }

    @Bean
    public ApplicationListener<ApplicationReadyEvent> multiReplicaStorageAdvisorLogger(
            com.aiassistant.config.MultiReplicaStorageAdvisor advisor,
            ObjectProvider<com.aiassistant.rag.VectorStore> vectorStoreProvider,
            ObjectProvider<com.aiassistant.service.SessionStore> sessionStoreProvider,
            ObjectProvider<TokenUsageTracker> tokenUsageTrackerProvider,
            ObjectProvider<ConversationMemoryProvider> conversationMemoryProviderProvider) {
        return event ->
                advisor.logWarnings(
                        vectorStoreProvider.getIfAvailable(),
                        sessionStoreProvider.getIfAvailable(),
                        tokenUsageTrackerProvider.getIfAvailable(),
                        conversationMemoryProviderProvider.getIfAvailable());
    }

    @Bean
    @ConditionalOnMissingBean
    public com.aiassistant.config.ProviderConnectivityChecker providerConnectivityChecker(
            AiAssistantProperties properties) {
        return new com.aiassistant.config.ProviderConnectivityChecker(properties);
    }

    @Bean
    public ApplicationListener<ApplicationReadyEvent> providerConnectivityCheckOnStartup(
            com.aiassistant.config.ProviderConnectivityChecker checker) {
        return event -> {
            Thread t = new Thread(checker::check, "provider-connectivity-check");
            t.setDaemon(true);
            t.start();
        };
    }

    @Bean
    @ConditionalOnMissingBean
    public com.aiassistant.event.AiAssistantEventPublisher aiAssistantEventPublisher(
            org.springframework.context.ApplicationEventPublisher publisher) {
        return new com.aiassistant.event.AiAssistantEventPublisher(publisher);
    }

    @Configuration(proxyBeanMethods = false)
    @ConditionalOnClass(name = "org.springframework.boot.actuate.health.HealthIndicator")
    static class ActuatorHealthAutoConfiguration {
        @Bean
        @ConditionalOnMissingBean(name = "aiAssistantHealthIndicator")
        public com.aiassistant.observability.AiAssistantHealthIndicator aiAssistantHealthIndicator(
                AiAssistantProperties properties,
                com.aiassistant.config.ProviderConnectivityChecker checker) {
            return new com.aiassistant.observability.AiAssistantHealthIndicator(
                    properties, checker);
        }
    }

    @Configuration(proxyBeanMethods = false)
    @ConditionalOnClass(name = "io.micrometer.core.instrument.MeterRegistry")
    static class AiAssistantMetricsAutoConfiguration {
        @Bean
        @ConditionalOnMissingBean(name = "aiAssistantMetrics")
        public com.aiassistant.observability.AiAssistantMetrics aiAssistantMetrics(
                io.micrometer.core.instrument.MeterRegistry registry,
                ObjectProvider<List<AssistantCapability>> capabilitiesProvider,
                ToolRegistry toolRegistry,
                TokenUsageTracker tokenUsageTracker) {
            return new com.aiassistant.observability.AiAssistantMetrics(
                    registry,
                    capabilitiesProvider.getIfAvailable(),
                    toolRegistry,
                    tokenUsageTracker);
        }
    }
}
