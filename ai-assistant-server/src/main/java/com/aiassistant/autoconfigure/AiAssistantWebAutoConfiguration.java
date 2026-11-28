package com.aiassistant.autoconfigure;

import com.aiassistant.config.AiAssistantProperties;
import com.aiassistant.controller.AiAssistantController;
import com.aiassistant.controller.FileUploadController;
import com.aiassistant.controller.RuntimeConfigController;
import com.aiassistant.controller.SessionController;
import com.aiassistant.controller.SseStreamController;
import com.aiassistant.controller.StatsController;
import com.aiassistant.model.ModelCapabilityRegistry;
import com.aiassistant.service.FileParserService;
import com.aiassistant.service.LlmService;
import com.aiassistant.service.LlmWarmupRunner;
import com.aiassistant.service.SessionStore;
import com.aiassistant.service.UrlFetchService;
import com.aiassistant.stats.TokenUsageTracker;
import com.aiassistant.stats.UsageStats;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnWebApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/** Web 层装配：精简后的核心对话、SSE 流式、文件上传问答、会话与健康/统计端点、CORS 及全局异常处理。 */
@Configuration(proxyBeanMethods = false)
public class AiAssistantWebAutoConfiguration {

    @Bean
    @ConditionalOnMissingBean
    public FileParserService fileParserService(AiAssistantProperties properties) {
        return new FileParserService(properties);
    }

    @Bean
    @ConditionalOnMissingBean
    public UsageStats usageStats() {
        return new UsageStats();
    }

    @Bean
    @ConditionalOnMissingBean
    public ModelCapabilityRegistry modelCapabilityRegistry() {
        return new ModelCapabilityRegistry();
    }

    @Bean
    @ConditionalOnMissingBean
    public AiAssistantController aiAssistantController(
            LlmService llmService,
            UsageStats usageStats,
            UrlFetchService urlFetchService,
            AiAssistantProperties assistantProperties,
            ModelCapabilityRegistry modelCapabilityRegistry) {
        return new AiAssistantController(
                llmService,
                usageStats,
                urlFetchService,
                assistantProperties,
                modelCapabilityRegistry);
    }

    @Bean
    @ConditionalOnMissingBean
    public StatsController statsController(UsageStats usageStats) {
        return new StatsController(usageStats);
    }

    @Bean
    @ConditionalOnMissingBean
    public RuntimeConfigController runtimeConfigController(
            AiAssistantProperties properties,
            com.aiassistant.config.AiAssistantSecurityPostureAdvisor securityPostureAdvisor,
            SessionStore sessionStore,
            TokenUsageTracker tokenUsageTracker,
            com.aiassistant.spi.ConversationMemoryProvider conversationMemoryProvider) {
        return new RuntimeConfigController(
                properties,
                securityPostureAdvisor,
                sessionStore,
                tokenUsageTracker,
                conversationMemoryProvider);
    }

    @Bean
    @ConditionalOnMissingBean
    public LlmWarmupRunner llmWarmupRunner(
            AiAssistantProperties properties, LlmService llmService) {
        return new LlmWarmupRunner(properties, llmService);
    }

    @Bean
    @ConditionalOnMissingBean
    public SseStreamController sseStreamController(
            LlmService llmService, UsageStats usageStats, AiAssistantProperties properties) {
        return new SseStreamController(llmService, usageStats, properties);
    }

    @Bean
    @ConditionalOnMissingBean
    public FileUploadController fileUploadController(
            FileParserService fileParserService, LlmService llmService, UsageStats usageStats) {
        return new FileUploadController(fileParserService, llmService, usageStats);
    }

    @Bean
    @ConditionalOnMissingBean
    public SessionController sessionController(
            SessionStore sessionStore, AiAssistantProperties properties) {
        return new SessionController(sessionStore, properties);
    }

    @Bean
    @ConditionalOnMissingBean
    public com.aiassistant.config.AiAssistantRestExceptionHandler
            aiAssistantRestExceptionHandler() {
        return new com.aiassistant.config.AiAssistantRestExceptionHandler();
    }

    @Bean
    @ConditionalOnMissingBean
    @ConditionalOnWebApplication(type = ConditionalOnWebApplication.Type.SERVLET)
    public com.aiassistant.config.AiAssistantCorsConfig aiAssistantCorsConfig(
            AiAssistantProperties properties) {
        return new com.aiassistant.config.AiAssistantCorsConfig(properties);
    }

    @Bean
    @ConditionalOnMissingBean
    public com.aiassistant.i18n.Messages aiAssistantMessages(
            org.springframework.context.MessageSource messageSource) {
        return new com.aiassistant.i18n.Messages(messageSource);
    }
}
