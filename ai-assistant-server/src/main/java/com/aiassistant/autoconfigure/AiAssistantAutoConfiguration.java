package com.aiassistant.autoconfigure;

import com.aiassistant.capability.BuiltInCapabilities;
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
import com.aiassistant.spi.AssistantCapability;
import com.aiassistant.spi.ChatInterceptor;
import com.aiassistant.spi.ConversationMemoryProvider;
import com.aiassistant.spi.InMemoryConversationMemoryProvider;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import com.aiassistant.controller.AiAssistantController;
import com.aiassistant.controller.AssistantExportController;
import com.aiassistant.controller.BatchController;
import com.aiassistant.controller.CapabilityController;
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
import java.util.ArrayList;
import java.util.List;
import com.aiassistant.service.llm.ChatCompletionClient;
import com.aiassistant.service.llm.OpenAiCompatibleChatClient;
import com.aiassistant.stats.UsageStats;
import org.springframework.boot.autoconfigure.condition.AnyNestedCondition;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
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

    @Bean
    @ConditionalOnMissingBean
    public com.aiassistant.config.AiAssistantSecurityPostureAdvisor aiAssistantSecurityPostureAdvisor(
            AiAssistantProperties properties) {
        com.aiassistant.config.AiAssistantSecurityPostureAdvisor advisor =
                new com.aiassistant.config.AiAssistantSecurityPostureAdvisor(properties);
        advisor.logWarnings();
        return advisor;
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
                                                 ToolRegistry toolRegistry,
                                                 com.aiassistant.security.ContentFilter contentFilter,
                                                 com.aiassistant.stats.TokenUsageTracker tokenUsageTracker,
                                                 com.aiassistant.routing.ModelRouter modelRouter,
                                                 ObjectProvider<com.aiassistant.rag.RagService> ragServiceProvider,
                                                 ObjectProvider<ConversationMemoryProvider> memoryProviderProvider,
                                                 ObjectProvider<List<ChatInterceptor>> interceptorsProvider) {
            return new LlmService(properties, urlFetchService, chatCompletionClient,
                    meterRegistryProvider.getIfAvailable(), toolRegistry,
                    contentFilter, tokenUsageTracker, modelRouter, ragServiceProvider.getIfAvailable(),
                    memoryProviderProvider.getIfAvailable(), interceptorsProvider.getIfAvailable());
        }
    }

    @Bean
    @ConditionalOnMissingBean(LlmService.class)
    @ConditionalOnMissingClass("io.micrometer.core.instrument.MeterRegistry")
    public LlmService llmServiceWithoutMetrics(AiAssistantProperties properties,
                                               UrlFetchService urlFetchService,
                                               ChatCompletionClient chatCompletionClient,
                                               ToolRegistry toolRegistry,
                                               com.aiassistant.security.ContentFilter contentFilter,
                                               com.aiassistant.stats.TokenUsageTracker tokenUsageTracker,
                                               com.aiassistant.routing.ModelRouter modelRouter,
                                               ObjectProvider<com.aiassistant.rag.RagService> ragServiceProvider,
                                               ObjectProvider<ConversationMemoryProvider> memoryProviderProvider,
                                               ObjectProvider<List<ChatInterceptor>> interceptorsProvider) {
        return new LlmService(properties, urlFetchService, chatCompletionClient,
                null, toolRegistry,
                contentFilter, tokenUsageTracker, modelRouter, ragServiceProvider.getIfAvailable(),
                memoryProviderProvider.getIfAvailable(), interceptorsProvider.getIfAvailable());
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
    public com.aiassistant.controller.PromptTemplateController promptTemplateController(
            com.aiassistant.prompt.PromptTemplateRegistry registry) {
        return new com.aiassistant.controller.PromptTemplateController(registry);
    }

    @Bean
    @ConditionalOnMissingBean
    public com.aiassistant.controller.SseStreamController sseStreamController(
            LlmService llmService, UsageStats usageStats, AiAssistantProperties properties) {
        return new com.aiassistant.controller.SseStreamController(llmService, usageStats, properties);
    }

    @Bean
    @ConditionalOnMissingBean
    public ConnectorHealthController connectorHealthController(
            ObjectProvider<List<DataConnector>> connectorProvider,
            ToolRegistry toolRegistry,
            ObjectProvider<com.aiassistant.config.ProviderConnectivityChecker> checkerProvider,
            AiAssistantProperties properties) {
        return new ConnectorHealthController(connectorProvider.getIfAvailable(), toolRegistry,
                checkerProvider.getIfAvailable(), properties.isConnectorManagementEnabled());
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
    @ConditionalOnMissingBean
    public com.aiassistant.stats.TokenUsageTracker tokenUsageTracker() {
        return new com.aiassistant.stats.TokenUsageTracker();
    }

    @Bean
    @ConditionalOnMissingBean
    public com.aiassistant.prompt.PromptTemplateRegistry promptTemplateRegistry() {
        return new com.aiassistant.prompt.PromptTemplateRegistry();
    }

    @Bean
    @ConditionalOnMissingBean
    public com.aiassistant.security.ContentFilter contentFilter(AiAssistantProperties properties) {
        return new com.aiassistant.security.ContentFilter(properties.isPiiMaskingEnabled(), true);
    }

    @Bean
    @ConditionalOnMissingBean
    public com.aiassistant.routing.ModelRouter modelRouter(AiAssistantProperties properties) {
        return new com.aiassistant.routing.ModelRouter(properties.resolveModel());
    }

    @Bean
    @ConditionalOnMissingBean
    public com.aiassistant.rag.VectorStore vectorStore() {
        return new com.aiassistant.rag.InMemoryVectorStore();
    }

    @Bean
    @ConditionalOnMissingBean
    @ConditionalOnProperty(prefix = "ai-assistant", name = "rag-enabled", havingValue = "true")
    public com.aiassistant.rag.EmbeddingProvider embeddingProvider(AiAssistantProperties properties) {
        return new com.aiassistant.rag.OpenAiEmbeddingProvider(properties);
    }

    @Bean
    @ConditionalOnMissingBean
    @ConditionalOnProperty(prefix = "ai-assistant", name = "rag-enabled", havingValue = "true")
    public com.aiassistant.rag.RagService ragService(
            com.aiassistant.rag.EmbeddingProvider embeddingProvider,
            com.aiassistant.rag.VectorStore vectorStore) {
        return new com.aiassistant.rag.RagService(embeddingProvider, vectorStore);
    }

    @Bean
    @ConditionalOnMissingBean
    public com.aiassistant.agent.AgentExecutor agentExecutor(ToolRegistry toolRegistry) {
        return new com.aiassistant.agent.AgentExecutor(toolRegistry);
    }

    @Bean
    @ConditionalOnMissingBean
    @ConditionalOnProperty(prefix = "ai-assistant", name = "admin-enabled", havingValue = "true")
    public com.aiassistant.controller.AdminDashboardController adminDashboardController(
            UsageStats usageStats,
            com.aiassistant.stats.TokenUsageTracker tokenTracker,
            ToolRegistry toolRegistry,
            com.aiassistant.prompt.PromptTemplateRegistry promptRegistry,
            ObjectProvider<com.aiassistant.rag.RagService> ragServiceProvider,
            com.aiassistant.routing.ModelRouter modelRouter,
            ObjectProvider<com.aiassistant.plugin.PluginRegistry> pluginRegistryProvider) {
        com.aiassistant.rag.RagService ragService = ragServiceProvider.getIfAvailable();
        if (ragService == null) {
            ragService = new com.aiassistant.rag.RagService(
                    new com.aiassistant.rag.EmbeddingProvider() {
                        @Override public float[] embed(String t) { return new float[0]; }
                        @Override public java.util.List<float[]> embedBatch(java.util.List<String> t) { return java.util.List.of(); }
                        @Override public int dimensions() { return 0; }
                    },
                    new com.aiassistant.rag.InMemoryVectorStore());
        }
        return new com.aiassistant.controller.AdminDashboardController(
                usageStats, tokenTracker, toolRegistry, promptRegistry, ragService, modelRouter,
                pluginRegistryProvider.getIfAvailable());
    }

    @Bean
    @ConditionalOnMissingBean
    public com.aiassistant.controller.AsyncTaskController asyncTaskController(LlmService llmService, UsageStats usageStats) {
        return new com.aiassistant.controller.AsyncTaskController(llmService, usageStats);
    }

    @Bean(destroyMethod = "stop")
    @ConditionalOnMissingBean
    public com.aiassistant.connector.ConnectorHealthScheduler connectorHealthScheduler(
            ObjectProvider<List<DataConnector>> connectorProvider) {
        var sched = new com.aiassistant.connector.ConnectorHealthScheduler(
                connectorProvider.getIfAvailable(), 60_000);
        sched.start();
        return sched;
    }

    @Bean
    @ConditionalOnWebApplication(type = ConditionalOnWebApplication.Type.SERVLET)
    public FilterRegistrationBean<com.aiassistant.config.TenantFilter> aiAssistantTenantFilter(AiAssistantProperties properties) {
        FilterRegistrationBean<com.aiassistant.config.TenantFilter> registration = new FilterRegistrationBean<>();
        registration.setFilter(new com.aiassistant.config.TenantFilter(properties.getContextPath()));
        registration.addUrlPatterns(properties.getContextPath() + "/*");
        registration.setOrder(-2);
        return registration;
    }

    @Bean
    @ConditionalOnWebApplication(type = ConditionalOnWebApplication.Type.SERVLET)
    public FilterRegistrationBean<com.aiassistant.config.SseCompressionFilter> aiAssistantSseCompressionFilter(AiAssistantProperties properties) {
        FilterRegistrationBean<com.aiassistant.config.SseCompressionFilter> registration = new FilterRegistrationBean<>();
        registration.setFilter(new com.aiassistant.config.SseCompressionFilter(properties.getContextPath()));
        registration.addUrlPatterns(properties.getContextPath() + "/*");
        registration.setOrder(-3);
        return registration;
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
    @ConditionalOnMissingClass("org.springframework.data.redis.core.StringRedisTemplate")
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

    @Bean
    @ConditionalOnMissingBean
    public com.aiassistant.config.ProviderConnectivityChecker providerConnectivityChecker(AiAssistantProperties properties) {
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

    // ── Security: RBAC ──

    @Bean
    @ConditionalOnMissingBean
    public com.aiassistant.security.RbacProvider rbacProvider() {
        return new com.aiassistant.security.RbacProvider.AllowAll();
    }

    // ── Event Bus ──

    @Bean
    @ConditionalOnMissingBean
    public com.aiassistant.event.AiAssistantEventPublisher aiAssistantEventPublisher(
            org.springframework.context.ApplicationEventPublisher publisher) {
        return new com.aiassistant.event.AiAssistantEventPublisher(publisher);
    }

    // ── Observability: Actuator HealthIndicator + Micrometer gauges ──

    @Configuration
    @ConditionalOnClass(name = "org.springframework.boot.actuate.health.HealthIndicator")
    static class ActuatorHealthAutoConfiguration {
        @Bean
        @ConditionalOnMissingBean(name = "aiAssistantHealthIndicator")
        public com.aiassistant.observability.AiAssistantHealthIndicator aiAssistantHealthIndicator(
                AiAssistantProperties properties,
                com.aiassistant.config.ProviderConnectivityChecker checker) {
            return new com.aiassistant.observability.AiAssistantHealthIndicator(properties, checker);
        }
    }

    @Configuration
    @ConditionalOnClass(name = "io.micrometer.core.instrument.MeterRegistry")
    static class AiAssistantMetricsAutoConfiguration {
        @Bean
        @ConditionalOnMissingBean(name = "aiAssistantMetrics")
        public com.aiassistant.observability.AiAssistantMetrics aiAssistantMetrics(
                io.micrometer.core.instrument.MeterRegistry registry,
                ObjectProvider<List<AssistantCapability>> capabilitiesProvider,
                ToolRegistry toolRegistry,
                com.aiassistant.stats.TokenUsageTracker tokenUsageTracker) {
            return new com.aiassistant.observability.AiAssistantMetrics(
                    registry,
                    capabilitiesProvider.getIfAvailable(),
                    toolRegistry,
                    tokenUsageTracker);
        }
    }

    // ── SPI: Conversation Memory (Redis > JDBC > InMemory) ──

    @Configuration
    @ConditionalOnClass(name = "org.springframework.data.redis.core.StringRedisTemplate")
    static class RedisMemoryAutoConfiguration {
        @Bean
        @ConditionalOnMissingBean(ConversationMemoryProvider.class)
        public ConversationMemoryProvider redisConversationMemoryProvider(
                org.springframework.data.redis.core.StringRedisTemplate redisTemplate) {
            return new com.aiassistant.spi.RedisConversationMemoryProvider(redisTemplate, 20);
        }
    }

    @Configuration
    @ConditionalOnClass(name = "javax.sql.DataSource")
    @ConditionalOnProperty(prefix = "ai-assistant", name = "memory-storage", havingValue = "jdbc")
    static class JdbcMemoryAutoConfiguration {
        @Bean
        @ConditionalOnMissingBean(ConversationMemoryProvider.class)
        public ConversationMemoryProvider jdbcConversationMemoryProvider(
                javax.sql.DataSource dataSource) {
            return new com.aiassistant.spi.JdbcConversationMemoryProvider(dataSource, 20);
        }
    }

    @Bean
    @ConditionalOnMissingBean
    public ConversationMemoryProvider conversationMemoryProvider() {
        return new InMemoryConversationMemoryProvider();
    }

    // ── SPI: Capabilities (translate / summarize / chat exposed as invocable) ──

    @Bean
    @ConditionalOnMissingBean(name = "builtInCapabilities")
    public List<AssistantCapability> builtInCapabilities(LlmService llmService) {
        List<AssistantCapability> caps = new ArrayList<>();
        caps.add(BuiltInCapabilities.translate(llmService));
        caps.add(BuiltInCapabilities.summarize(llmService));
        caps.add(BuiltInCapabilities.chat(llmService));
        return caps;
    }

    @Bean
    @ConditionalOnMissingBean
    public CapabilityController capabilityController(
            ObjectProvider<List<AssistantCapability>> capabilitiesProvider) {
        return new CapabilityController(capabilitiesProvider.getIfAvailable());
    }

    @Bean
    @ConditionalOnMissingBean(name = "capabilityToolAdapter")
    @ConditionalOnProperty(prefix = "ai-assistant", name = "capabilities-as-tools", havingValue = "true", matchIfMissing = true)
    public com.aiassistant.capability.CapabilityToolAdapter capabilityToolAdapter(
            ToolRegistry toolRegistry,
            ObjectProvider<List<AssistantCapability>> capabilitiesProvider) {
        return new com.aiassistant.capability.CapabilityToolAdapter(
                toolRegistry, capabilitiesProvider.getIfAvailable());
    }

    // ── Plugin System ──

    @Bean
    @ConditionalOnMissingBean
    public com.aiassistant.plugin.PluginRegistry pluginRegistry(
            ToolRegistry toolRegistry,
            ObjectProvider<List<AssistantCapability>> capabilitiesProvider) {
        return new com.aiassistant.plugin.PluginRegistry(toolRegistry, capabilitiesProvider.getIfAvailable());
    }

    // ── MCP Server ──

    @Bean
    @ConditionalOnMissingBean
    @ConditionalOnProperty(prefix = "ai-assistant", name = "mcp-server-enabled", havingValue = "true")
    public com.aiassistant.mcp.McpServerController mcpServerController(
            ObjectProvider<List<AssistantCapability>> capabilitiesProvider) {
        return new com.aiassistant.mcp.McpServerController(capabilitiesProvider.getIfAvailable());
    }

    // ── Resilience4j ──

    @Bean
    @ConditionalOnMissingBean
    @ConditionalOnClass(name = "io.github.resilience4j.circuitbreaker.CircuitBreaker")
    public com.aiassistant.resilience.ResilientLlmClient resilientLlmClient() {
        return new com.aiassistant.resilience.ResilientLlmClient();
    }

    // ── Batch API ──

    @Bean
    @ConditionalOnMissingBean
    public BatchController batchController(LlmService llmService, UsageStats usageStats) {
        return new BatchController(llmService, usageStats);
    }

    // ── Webhook Delivery ──

    @Bean(destroyMethod = "shutdown")
    @ConditionalOnMissingBean
    public com.aiassistant.webhook.WebhookDelivery webhookDelivery() {
        return new com.aiassistant.webhook.WebhookDelivery();
    }

    // ── i18n ──

    @Bean
    @ConditionalOnMissingBean
    public com.aiassistant.i18n.Messages aiAssistantMessages(
            org.springframework.context.MessageSource messageSource) {
        return new com.aiassistant.i18n.Messages(messageSource);
    }

    // ── Audit Logger ──

    @Bean
    @ConditionalOnMissingBean
    public com.aiassistant.audit.AuditLogger auditLogger() {
        return new com.aiassistant.audit.AuditLogger();
    }

    // ── Tracing Filter ──

    @Bean
    @ConditionalOnWebApplication(type = ConditionalOnWebApplication.Type.SERVLET)
    public FilterRegistrationBean<com.aiassistant.config.TracingFilter> aiAssistantTracingFilter(
            AiAssistantProperties properties) {
        FilterRegistrationBean<com.aiassistant.config.TracingFilter> registration = new FilterRegistrationBean<>();
        registration.setFilter(new com.aiassistant.config.TracingFilter());
        registration.addUrlPatterns(properties.getContextPath() + "/*");
        registration.setOrder(-4);
        return registration;
    }

    // ── API Versioning ──

    @Bean
    @ConditionalOnWebApplication(type = ConditionalOnWebApplication.Type.SERVLET)
    @ConditionalOnProperty(prefix = "ai-assistant", name = "api-versioning", havingValue = "true", matchIfMissing = true)
    public FilterRegistrationBean<com.aiassistant.config.ApiVersionConfig.ApiVersionFilter> aiAssistantApiVersionFilter(
            AiAssistantProperties properties) {
        FilterRegistrationBean<com.aiassistant.config.ApiVersionConfig.ApiVersionFilter> registration = new FilterRegistrationBean<>();
        registration.setFilter(new com.aiassistant.config.ApiVersionConfig.ApiVersionFilter(properties.getContextPath()));
        registration.addUrlPatterns(com.aiassistant.config.ApiVersionConfig.V1_PREFIX + properties.getContextPath() + "/*");
        registration.setOrder(-5);
        return registration;
    }

    // ── SPI: Redis distributed rate limit (auto-activate when Redis is present) ──

    @Configuration
    @ConditionalOnClass(name = "org.springframework.data.redis.core.StringRedisTemplate")
    static class RedisRateLimitAutoConfiguration {
        @Bean
        @ConditionalOnBean(org.springframework.data.redis.core.StringRedisTemplate.class)
        @ConditionalOnWebApplication(type = ConditionalOnWebApplication.Type.SERVLET)
        @ConditionalOnProperty(prefix = "ai-assistant", name = "rate-limit-distributed", havingValue = "true", matchIfMissing = true)
        public FilterRegistrationBean<com.aiassistant.config.RedisRateLimitFilter> aiAssistantRedisRateLimitFilter(
                AiAssistantProperties properties,
                org.springframework.data.redis.core.StringRedisTemplate redisTemplate) {
            FilterRegistrationBean<com.aiassistant.config.RedisRateLimitFilter> registration = new FilterRegistrationBean<>();
            registration.setFilter(new com.aiassistant.config.RedisRateLimitFilter(properties, redisTemplate));
            registration.addUrlPatterns(properties.getContextPath() + "/*");
            registration.setOrder(0);
            return registration;
        }
    }
}
