package com.aiassistant.autoconfigure;

import com.aiassistant.config.AiAssistantAuthFilter;
import com.aiassistant.config.AiAssistantCorsConfig;
import com.aiassistant.config.AiAssistantProperties;
import com.aiassistant.config.AiAssistantRestExceptionHandler;
import com.aiassistant.config.ConnectorProperties;
import com.aiassistant.config.RateLimitFilter;
import com.aiassistant.connector.ConnectorToolRegistrar;
import com.aiassistant.connector.DataConnector;
import com.aiassistant.connector.InformatConnector;
import com.aiassistant.connector.JdbcConnector;
import com.aiassistant.connector.RestApiConnector;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import com.aiassistant.controller.AiAssistantController;
import com.aiassistant.controller.AssistantExportController;
import com.aiassistant.controller.ConnectorHealthController;
import com.aiassistant.controller.FileUploadController;
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
import org.springframework.boot.autoconfigure.condition.AnyNestedCondition;
import org.springframework.boot.autoconfigure.condition.ConditionalOnClass;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.autoconfigure.condition.ConditionalOnWebApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.ApplicationListener;
import org.springframework.context.annotation.Bean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingClass;
import org.springframework.context.annotation.Conditional;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.reactive.function.client.WebClient;

/**
 * Spring Boot 自动配置：当 {@code ai-assistant.api-key} 或 {@code ai-assistant.api-keys} 任一存在
 * 且 classpath 含 WebClient 时激活。
 * 所有 Bean 均标记 {@code @ConditionalOnMissingBean}，宿主可替换任意组件。
 */
@Configuration
@EnableConfigurationProperties(AiAssistantProperties.class)
@Conditional(AiAssistantAutoConfiguration.ApiKeyConfigured.class)
@ConditionalOnClass(WebClient.class)
public class AiAssistantAutoConfiguration {

    static class ApiKeyConfigured extends AnyNestedCondition {
        ApiKeyConfigured() { super(ConfigurationPhase.PARSE_CONFIGURATION); }

        @ConditionalOnProperty(prefix = "ai-assistant", name = "api-key")
        static class HasApiKey {}

        @ConditionalOnProperty(prefix = "ai-assistant", name = "api-keys[0]")
        static class HasApiKeys {}
    }

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

    @Configuration
    @ConditionalOnClass(name = "com.microsoft.playwright.Playwright")
    @ConditionalOnProperty(prefix = "ai-assistant", name = "headless-fetch-enabled", havingValue = "true")
    static class HeadlessFetchAutoConfiguration {
        @Bean
        @ConditionalOnMissingBean(name = "headlessFetchService")
        public com.aiassistant.service.HeadlessFetchService headlessFetchService(
                AiAssistantProperties properties, UrlFetchService urlFetchService) {
            var h = new com.aiassistant.service.HeadlessFetchService(properties);
            urlFetchService.setHeadlessFetchService(h);
            return h;
        }

        @Bean
        public ApplicationListener<ApplicationReadyEvent> headlessFetchWarmup(
                com.aiassistant.service.HeadlessFetchService headlessFetchService) {
            return event -> headlessFetchService.warmupInBackground();
        }
    }

    @Bean
    @ConditionalOnMissingBean
    public ChatCompletionClient chatCompletionClient(AiAssistantProperties properties) {
        return new OpenAiCompatibleChatClient(properties);
    }

    @Bean
    @ConditionalOnMissingBean
    public ToolRegistry toolRegistry(ObjectProvider<List<ToolDefinition>> toolDefs,
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
                DataConnector connector = createConnectorFromConfig(cfg);
                if (connector != null) {
                    ConnectorToolRegistrar.register(connector, registry);
                }
            }
        }

        return registry;
    }

    private DataConnector createConnectorFromConfig(ConnectorProperties cfg) {
        return com.aiassistant.connector.ConnectorFactory.create(cfg);
    }

    @Configuration
    @ConditionalOnClass(name = "javax.sql.DataSource")
    static class JdbcConnectorAutoConfiguration {
        @Bean
        @ConditionalOnMissingBean(name = "jdbcDataConnector")
        public DataConnector jdbcDataConnector(
                ObjectProvider<javax.sql.DataSource> dataSourceProvider,
                AiAssistantProperties properties) {
            List<ConnectorProperties> cfgs = properties.getConnectors();
            if (cfgs == null) return null;
            ConnectorProperties jdbcCfg = cfgs.stream()
                    .filter(c -> "jdbc".equalsIgnoreCase(c.getType()))
                    .findFirst().orElse(null);
            if (jdbcCfg == null) return null;
            javax.sql.DataSource ds = dataSourceProvider.getIfAvailable();
            if (ds == null) return null;
            return new JdbcConnector(
                    jdbcCfg.resolveId(), jdbcCfg.resolveDisplayName(),
                    ds, jdbcCfg.resolveAllowedTables(), jdbcCfg.getSchema());
        }
    }

    @Configuration
    @ConditionalOnClass(name = "io.micrometer.core.instrument.MeterRegistry")
    static class MicrometerLlmServiceConfiguration {
        @Bean
        @ConditionalOnMissingBean(LlmService.class)
        public LlmService llmServiceWithMetrics(AiAssistantProperties properties,
                                                 UrlFetchService urlFetchService,
                                                 ChatCompletionClient chatCompletionClient,
                                                 ObjectProvider<io.micrometer.core.instrument.MeterRegistry> meterRegistryProvider,
                                                 ToolRegistry toolRegistry) {
            return new LlmService(properties, urlFetchService, chatCompletionClient,
                    meterRegistryProvider.getIfAvailable(), toolRegistry);
        }
    }

    @Bean
    @ConditionalOnMissingBean(LlmService.class)
    @ConditionalOnMissingClass("io.micrometer.core.instrument.MeterRegistry")
    public LlmService llmServiceWithoutMetrics(AiAssistantProperties properties,
                                               UrlFetchService urlFetchService,
                                               ChatCompletionClient chatCompletionClient,
                                               ToolRegistry toolRegistry) {
        return new LlmService(properties, urlFetchService, chatCompletionClient,
                null, toolRegistry);
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
    public ConnectorHealthController connectorHealthController(
            ObjectProvider<List<DataConnector>> connectorProvider,
            ToolRegistry toolRegistry) {
        return new ConnectorHealthController(connectorProvider.getIfAvailable(), toolRegistry);
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

    @Configuration
    @ConditionalOnClass(name = "org.springframework.data.redis.core.StringRedisTemplate")
    static class RedisSessionStoreAutoConfiguration {
        @Bean
        @ConditionalOnMissingBean(SessionStore.class)
        public SessionStore redisSessionStore(
                org.springframework.data.redis.core.StringRedisTemplate redisTemplate) {
            return new com.aiassistant.service.RedisSessionStore(redisTemplate);
        }
    }

    @Bean
    @ConditionalOnMissingBean
    public SessionStore sessionStore() {
        return new com.aiassistant.service.InMemorySessionStore();
    }

    @Bean
    @ConditionalOnMissingBean
    public SessionController sessionController(SessionStore sessionStore) {
        return new SessionController(sessionStore);
    }

    @Configuration
    @ConditionalOnClass(name = "org.springframework.web.socket.handler.TextWebSocketHandler")
    @ConditionalOnProperty(prefix = "ai-assistant", name = "websocket-enabled", havingValue = "true")
    static class WebSocketAutoConfiguration {
        @Bean
        @ConditionalOnMissingBean(name = "aiAssistantWebSocketHandler")
        public com.aiassistant.controller.AiAssistantWebSocketHandler aiAssistantWebSocketHandler(
                LlmService llmService, UsageStats usageStats, AiAssistantProperties properties) {
            return new com.aiassistant.controller.AiAssistantWebSocketHandler(llmService, usageStats, properties);
        }
    }

    @Bean
    @ConditionalOnMissingBean
    @ConditionalOnWebApplication(type = ConditionalOnWebApplication.Type.SERVLET)
    public AiAssistantCorsConfig aiAssistantCorsConfig(AiAssistantProperties properties) {
        return new AiAssistantCorsConfig(properties);
    }

    @Bean
    @ConditionalOnWebApplication(type = ConditionalOnWebApplication.Type.SERVLET)
    public FilterRegistrationBean<com.aiassistant.config.RequestIdFilter> aiAssistantRequestIdFilter(AiAssistantProperties properties) {
        FilterRegistrationBean<com.aiassistant.config.RequestIdFilter> registration = new FilterRegistrationBean<>();
        registration.setFilter(new com.aiassistant.config.RequestIdFilter(properties.getContextPath()));
        registration.addUrlPatterns(properties.getContextPath() + "/*");
        registration.setOrder(-1);
        return registration;
    }

    @Bean
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
