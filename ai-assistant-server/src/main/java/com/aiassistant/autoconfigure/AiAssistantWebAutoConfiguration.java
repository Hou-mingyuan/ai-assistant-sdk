package com.aiassistant.autoconfigure;

import com.aiassistant.capability.BuiltInCapabilities;
import com.aiassistant.config.AiAssistantProperties;
import com.aiassistant.connector.DataConnector;
import com.aiassistant.controller.AiAssistantController;
import com.aiassistant.controller.AssistantExportController;
import com.aiassistant.controller.BatchController;
import com.aiassistant.controller.CapabilityController;
import com.aiassistant.controller.ConnectorHealthController;
import com.aiassistant.controller.FileUploadController;
import com.aiassistant.controller.RuntimeConfigController;
import com.aiassistant.controller.SessionController;
import com.aiassistant.controller.StatsController;
import com.aiassistant.model.ModelCapabilityRegistry;
import com.aiassistant.service.AssistantExportService;
import com.aiassistant.service.FileParserService;
import com.aiassistant.service.LlmService;
import com.aiassistant.service.SessionStore;
import com.aiassistant.service.UrlFetchService;
import com.aiassistant.spi.AssistantCapability;
import com.aiassistant.stats.UsageStats;
import com.aiassistant.tool.ToolRegistry;
import java.util.ArrayList;
import java.util.List;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnClass;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.autoconfigure.condition.ConditionalOnWebApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Web 层装配：所有 REST/WebSocket Controller、UsageStats、FileParserService、ModelCapabilityRegistry、
 * AssistantExportService、Capability/Plugin/MCP/Batch/Async/Admin 等控制器。
 *
 * <p>Refactor (T2)：从 {@link AiAssistantAutoConfiguration} 拆出。Bean 顺序与 condition 保持原样。
 */
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
            com.aiassistant.config.AiAssistantSecurityPostureAdvisor securityPostureAdvisor) {
        return new RuntimeConfigController(properties, securityPostureAdvisor);
    }

    @Bean
    @ConditionalOnMissingBean
    public com.aiassistant.config.RuntimeModelConfigService runtimeModelConfigService(
            AiAssistantProperties properties) {
        return new com.aiassistant.config.RuntimeModelConfigService(properties);
    }

    @Bean
    @ConditionalOnMissingBean
    public com.aiassistant.controller.RuntimeModelConfigController runtimeModelConfigController(
            com.aiassistant.config.RuntimeModelConfigService runtimeModelConfigService) {
        return new com.aiassistant.controller.RuntimeModelConfigController(runtimeModelConfigService);
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
        return new com.aiassistant.controller.SseStreamController(
                llmService, usageStats, properties);
    }

    @Bean
    @ConditionalOnMissingBean
    public ConnectorHealthController connectorHealthController(
            ObjectProvider<List<DataConnector>> connectorProvider,
            ToolRegistry toolRegistry,
            ObjectProvider<com.aiassistant.config.ProviderConnectivityChecker> checkerProvider,
            AiAssistantProperties properties) {
        return new ConnectorHealthController(
                connectorProvider.getIfAvailable(),
                toolRegistry,
                checkerProvider.getIfAvailable(),
                properties.isConnectorManagementEnabled());
    }

    @Bean
    @ConditionalOnMissingBean
    public FileUploadController fileUploadController(
            FileParserService fileParserService, LlmService llmService, UsageStats usageStats) {
        return new FileUploadController(fileParserService, llmService, usageStats);
    }

    @Bean
    @ConditionalOnMissingBean
    public AssistantExportService assistantExportService(AiAssistantProperties properties) {
        return new AssistantExportService(properties);
    }

    @Bean
    @ConditionalOnMissingBean
    public AssistantExportController assistantExportController(
            AssistantExportService exportService) {
        return new AssistantExportController(exportService);
    }

    @Bean
    @ConditionalOnMissingBean
    public SessionController sessionController(SessionStore sessionStore) {
        return new SessionController(sessionStore);
    }

    @Bean
    @ConditionalOnMissingBean
    public com.aiassistant.controller.AsyncTaskController asyncTaskController(
            LlmService llmService, UsageStats usageStats) {
        return new com.aiassistant.controller.AsyncTaskController(llmService, usageStats);
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
        return new com.aiassistant.controller.AdminDashboardController(
                usageStats,
                tokenTracker,
                toolRegistry,
                promptRegistry,
                ragServiceProvider.getIfAvailable(),
                modelRouter,
                pluginRegistryProvider.getIfAvailable());
    }

    @Bean
    @ConditionalOnMissingBean
    public BatchController batchController(LlmService llmService, UsageStats usageStats) {
        return new BatchController(llmService, usageStats);
    }

    @Configuration(proxyBeanMethods = false)
    @ConditionalOnClass(name = "org.springframework.web.socket.handler.TextWebSocketHandler")
    @ConditionalOnProperty(
            prefix = "ai-assistant",
            name = "websocket-enabled",
            havingValue = "true")
    static class WebSocketAutoConfiguration {
        @Bean
        @ConditionalOnMissingBean(name = "aiAssistantWebSocketHandler")
        public com.aiassistant.controller.AiAssistantWebSocketHandler aiAssistantWebSocketHandler(
                LlmService llmService, UsageStats usageStats, AiAssistantProperties properties) {
            return new com.aiassistant.controller.AiAssistantWebSocketHandler(
                    llmService, usageStats, properties);
        }
    }

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
    @ConditionalOnProperty(
            prefix = "ai-assistant",
            name = "capabilities-as-tools",
            havingValue = "true",
            matchIfMissing = true)
    public com.aiassistant.capability.CapabilityToolAdapter capabilityToolAdapter(
            ToolRegistry toolRegistry,
            ObjectProvider<List<AssistantCapability>> capabilitiesProvider) {
        return new com.aiassistant.capability.CapabilityToolAdapter(
                toolRegistry, capabilitiesProvider.getIfAvailable());
    }

    @Bean
    @ConditionalOnMissingBean
    public com.aiassistant.plugin.PluginRegistry pluginRegistry(
            ToolRegistry toolRegistry,
            ObjectProvider<List<AssistantCapability>> capabilitiesProvider) {
        return new com.aiassistant.plugin.PluginRegistry(
                toolRegistry, capabilitiesProvider.getIfAvailable());
    }

    @Bean
    @ConditionalOnMissingBean
    @ConditionalOnProperty(
            prefix = "ai-assistant",
            name = "mcp-server-enabled",
            havingValue = "true")
    public com.aiassistant.mcp.McpServerController mcpServerController(
            ObjectProvider<List<AssistantCapability>> capabilitiesProvider) {
        return new com.aiassistant.mcp.McpServerController(capabilitiesProvider.getIfAvailable());
    }

    @Bean
    @ConditionalOnMissingBean
    public com.aiassistant.prompt.PromptTemplateRegistry promptTemplateRegistry() {
        return new com.aiassistant.prompt.PromptTemplateRegistry();
    }

    @Bean
    @ConditionalOnMissingBean
    @ConditionalOnWebApplication(type = ConditionalOnWebApplication.Type.SERVLET)
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
