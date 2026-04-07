package com.aiassistant.autoconfigure;

import com.aiassistant.config.AiAssistantAuthFilter;
import com.aiassistant.config.AiAssistantCorsConfig;
import com.aiassistant.config.AiAssistantProperties;
import com.aiassistant.config.AiAssistantRestExceptionHandler;
import com.aiassistant.config.RateLimitFilter;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import com.aiassistant.controller.AiAssistantController;
import com.aiassistant.controller.AssistantExportController;
import com.aiassistant.controller.FileUploadController;
import com.aiassistant.controller.AiAssistantWebSocketHandler;
import com.aiassistant.controller.SessionController;
import com.aiassistant.controller.StatsController;
import com.aiassistant.service.FileParserService;
import com.aiassistant.service.AssistantExportService;
import com.aiassistant.service.SessionStore;
import com.aiassistant.service.LlmService;
import com.aiassistant.service.UrlFetchService;
import com.aiassistant.tool.ToolDefinition;
import com.aiassistant.tool.ToolRegistry;
import java.util.List;
import com.aiassistant.service.llm.ChatCompletionClient;
import com.aiassistant.service.llm.OpenAiCompatibleChatClient;
import com.aiassistant.stats.UsageStats;
import org.springframework.boot.autoconfigure.condition.ConditionalOnClass;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.autoconfigure.condition.ConditionalOnWebApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.reactive.function.client.WebClient;

import io.micrometer.core.instrument.MeterRegistry;

@Configuration
@EnableConfigurationProperties(AiAssistantProperties.class)
@ConditionalOnProperty(prefix = "ai-assistant", name = "api-key")
@ConditionalOnClass(WebClient.class)
public class AiAssistantAutoConfiguration {

    @Bean
    @ConditionalOnWebApplication(type = ConditionalOnWebApplication.Type.SERVLET)
    @ConditionalOnMissingBean
    public AiAssistantRestExceptionHandler aiAssistantRestExceptionHandler() {
        return new AiAssistantRestExceptionHandler();
    }

    @Bean
    @ConditionalOnMissingBean
    public UrlFetchService urlFetchService(AiAssistantProperties properties) {
        return new UrlFetchService(properties);
    }

    @Bean
    @ConditionalOnMissingBean
    public ChatCompletionClient chatCompletionClient(AiAssistantProperties properties) {
        return new OpenAiCompatibleChatClient(properties);
    }

    @Bean
    @ConditionalOnMissingBean
    public ToolRegistry toolRegistry(ObjectProvider<List<ToolDefinition>> toolDefs) {
        List<ToolDefinition> defs = toolDefs.getIfAvailable();
        return new ToolRegistry(defs != null ? defs : List.of());
    }

    @Bean
    @ConditionalOnMissingBean
    public LlmService llmService(AiAssistantProperties properties,
                                 UrlFetchService urlFetchService,
                                 ChatCompletionClient chatCompletionClient,
                                 ObjectProvider<MeterRegistry> meterRegistry,
                                 ToolRegistry toolRegistry) {
        return new LlmService(properties, urlFetchService, chatCompletionClient,
                meterRegistry.getIfAvailable(), toolRegistry);
    }

    @Bean
    @ConditionalOnMissingBean
    public FileParserService fileParserService() {
        return new FileParserService();
    }

    @Bean
    @ConditionalOnMissingBean
    public UsageStats usageStats() {
        return new UsageStats();
    }

    @Bean
    @ConditionalOnMissingBean
    public AiAssistantController aiAssistantController(LlmService llmService, UsageStats usageStats,
                                                       UrlFetchService urlFetchService,
                                                       AiAssistantProperties assistantProperties) {
        return new AiAssistantController(llmService, usageStats, urlFetchService, assistantProperties);
    }

    @Bean
    @ConditionalOnMissingBean
    public StatsController statsController(UsageStats usageStats) {
        return new StatsController(usageStats);
    }

    @Bean
    @ConditionalOnMissingBean
    public FileUploadController fileUploadController(FileParserService fileParserService, LlmService llmService, UsageStats usageStats) {
        return new FileUploadController(fileParserService, llmService, usageStats);
    }

    @Bean
    @ConditionalOnMissingBean
    public AssistantExportService assistantExportService(AiAssistantProperties properties) {
        return new AssistantExportService(properties);
    }

    @Bean
    @ConditionalOnMissingBean
    public AssistantExportController assistantExportController(AssistantExportService exportService) {
        return new AssistantExportController(exportService);
    }

    @Bean
    @ConditionalOnMissingBean
    public SessionStore sessionStore() {
        return new SessionStore();
    }

    @Bean
    @ConditionalOnMissingBean
    public SessionController sessionController(SessionStore sessionStore) {
        return new SessionController(sessionStore);
    }

    @Bean
    @ConditionalOnMissingBean
    @ConditionalOnProperty(prefix = "ai-assistant", name = "websocket-enabled", havingValue = "true")
    public AiAssistantWebSocketHandler aiAssistantWebSocketHandler(LlmService llmService, UsageStats usageStats) {
        return new AiAssistantWebSocketHandler(llmService, usageStats);
    }

    @Bean
    @ConditionalOnMissingBean
    @ConditionalOnWebApplication(type = ConditionalOnWebApplication.Type.SERVLET)
    public AiAssistantCorsConfig aiAssistantCorsConfig(AiAssistantProperties properties) {
        return new AiAssistantCorsConfig(properties);
    }

    @Bean
    @ConditionalOnProperty(prefix = "ai-assistant", name = "rate-limit")
    @ConditionalOnWebApplication(type = ConditionalOnWebApplication.Type.SERVLET)
    public FilterRegistrationBean<RateLimitFilter> aiAssistantRateLimitFilter(AiAssistantProperties properties) {
        FilterRegistrationBean<RateLimitFilter> registration = new FilterRegistrationBean<>();
        registration.setFilter(new RateLimitFilter(properties));
        registration.addUrlPatterns(properties.getContextPath() + "/*");
        registration.setOrder(0);
        return registration;
    }

    @Bean
    @ConditionalOnProperty(prefix = "ai-assistant", name = "access-token")
    @ConditionalOnWebApplication(type = ConditionalOnWebApplication.Type.SERVLET)
    public FilterRegistrationBean<AiAssistantAuthFilter> aiAssistantAuthFilter(AiAssistantProperties properties) {
        FilterRegistrationBean<AiAssistantAuthFilter> registration = new FilterRegistrationBean<>();
        registration.setFilter(new AiAssistantAuthFilter(properties));
        registration.addUrlPatterns(properties.getContextPath() + "/*");
        registration.setOrder(1);
        return registration;
    }
}
