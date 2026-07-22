package com.aiassistant.autoconfigure;

import com.aiassistant.config.AiAssistantProperties;
import org.springframework.boot.autoconfigure.condition.AnyNestedCondition;
import org.springframework.boot.autoconfigure.condition.ConditionalOnClass;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Conditional;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;
import org.springframework.web.reactive.function.client.WebClient;

/**
 * Spring Boot 自动配置入口：当 {@code ai-assistant.api-key}、{@code ai-assistant.api-keys} 任一存在， 或显式选择
 * {@code provider=demo}，且 classpath 含 WebClient 时激活。
 *
 * <p>Refactor (T2)：原本 909 行单文件已按职能拆为 7 份兄弟 Configuration，通过 {@link Import} 聚合：
 *
 * <ul>
 *   <li>{@link AiAssistantLlmAutoConfiguration} ——
 *       ChatCompletionClient、LlmService、ToolRegistry、ModelRouter、Agent、Resilience4j
 *   <li>{@link AiAssistantWebAutoConfiguration} —— 全部
 *       Controller、CORS、ExceptionHandler、Capabilities、Plugin、MCP、WebSocket、i18n
 *   <li>{@link AiAssistantSecurityAutoConfiguration} —— 全部
 *       Filter（Auth/Tenant/Sse/RequestId/Tracing/ApiVersion/RateLimit/Redis），ContentFilter、Rbac、Audit
 *   <li>{@link AiAssistantRagAutoConfiguration} —— VectorStore、EmbeddingProvider、RagService（按
 *       ai-assistant.rag-enabled 启用）
 *   <li>{@link AiAssistantStorageAutoConfiguration} ——
 *       SessionStore（Redis/内存）、ConversationMemoryProvider（Redis &gt; JDBC &gt;
 *       内存）、TokenUsageTracker、Webhook
 *   <li>{@link AiAssistantObservabilityAutoConfiguration} ——
 *       Banner、SecurityPostureAdvisor、ConnectivityChecker、Health、Metrics、EventPublisher
 *   <li>{@link AiAssistantConnectorAutoConfiguration} —— DataConnector、JDBC、URL
 *       fetch、Headless（Playwright）、HealthScheduler
 * </ul>
 *
 * <p>本类只保留触发条件、Properties 启用、6 个 sibling 的 import 与一个内部嵌套条件类， 行为与原 909 行单文件 100%
 * 等价（同样的 @ConditionalOn*、同样的 Bean 顺序、同样的 Bean 名称）。
 *
 * <p>宿主方应用方式不变：在 {@code spring.factories} / {@code AutoConfiguration.imports} 里仍然只引用本类， 6 个 sibling
 * Configuration 会自动跟随激活。
 */
@Configuration(proxyBeanMethods = false)
@EnableConfigurationProperties(AiAssistantProperties.class)
@Conditional(AiAssistantAutoConfiguration.ApiKeyConfigured.class)
@ConditionalOnClass(WebClient.class)
@Import({
    AiAssistantLlmAutoConfiguration.class,
    AiAssistantWebAutoConfiguration.class,
    AiAssistantSecurityAutoConfiguration.class,
    AiAssistantRagAutoConfiguration.class,
    AiAssistantStorageAutoConfiguration.class,
    AiAssistantObservabilityAutoConfiguration.class,
    AiAssistantConnectorAutoConfiguration.class,
})
public class AiAssistantAutoConfiguration {

    /** 触发条件：配置真实凭据，或显式选择无外部调用的 demo provider。 */
    static class ApiKeyConfigured extends AnyNestedCondition {
        ApiKeyConfigured() {
            super(ConfigurationPhase.PARSE_CONFIGURATION);
        }

        @ConditionalOnProperty(prefix = "ai-assistant", name = "api-key")
        static class HasApiKey {}

        @ConditionalOnProperty(prefix = "ai-assistant", name = "api-keys[0]")
        static class HasApiKeys {}

        @ConditionalOnProperty(prefix = "ai-assistant", name = "provider", havingValue = "demo")
        static class HasDemoProvider {}
    }
}
