package com.aiassistant.autoconfigure;

import com.aiassistant.config.AiAssistantProperties;
import com.aiassistant.service.SessionStore;
import com.aiassistant.spi.ConversationMemoryProvider;
import com.aiassistant.spi.InMemoryConversationMemoryProvider;
import com.aiassistant.stats.TokenUsageTracker;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnClass;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * 存储装配：SessionStore（Redis 优先 → 内存兜底）、ConversationMemoryProvider（Redis &gt; JDBC &gt; InMemory）、
 * TokenUsageTracker（Redis 优先 → 内存兜底）、Webhook delivery。
 *
 * <p>Refactor (T2)：从 {@link AiAssistantAutoConfiguration} 拆出。
 */
@Configuration(proxyBeanMethods = false)
public class AiAssistantStorageAutoConfiguration {

    @Configuration(proxyBeanMethods = false)
    @ConditionalOnClass(name = "org.springframework.data.redis.core.StringRedisTemplate")
    @ConditionalOnBean(org.springframework.data.redis.core.StringRedisTemplate.class)
    static class RedisSessionStoreAutoConfiguration {
        @Bean
        public SessionStore redisSessionStore(
                org.springframework.data.redis.core.StringRedisTemplate redisTemplate) {
            return new com.aiassistant.service.RedisSessionStore(redisTemplate);
        }
    }

    @Bean
    @ConditionalOnMissingBean(SessionStore.class)
    public SessionStore sessionStore(AiAssistantProperties properties) {
        var cfg = properties.getSessionStore();
        return new com.aiassistant.service.InMemorySessionStore(
                cfg.getMaxSessionsPerUser(), cfg.getMaxUsers(), cfg.getMaxMessagesPerSession());
    }

    @Configuration(proxyBeanMethods = false)
    @ConditionalOnClass(name = "org.springframework.data.redis.core.StringRedisTemplate")
    @ConditionalOnBean(org.springframework.data.redis.core.StringRedisTemplate.class)
    static class RedisTokenUsageAutoConfiguration {
        @Bean
        @ConditionalOnMissingBean(TokenUsageTracker.class)
        public TokenUsageTracker redisTokenUsageTracker(
                org.springframework.data.redis.core.StringRedisTemplate redisTemplate) {
            return new com.aiassistant.stats.RedisTokenUsageTracker(redisTemplate);
        }
    }

    @Bean
    @ConditionalOnMissingBean
    public TokenUsageTracker tokenUsageTracker() {
        return new com.aiassistant.stats.InMemoryTokenUsageTracker();
    }

    @Configuration(proxyBeanMethods = false)
    @ConditionalOnClass(name = "org.springframework.data.redis.core.StringRedisTemplate")
    @ConditionalOnBean(org.springframework.data.redis.core.StringRedisTemplate.class)
    static class RedisMemoryAutoConfiguration {
        @Bean
        @ConditionalOnMissingBean(ConversationMemoryProvider.class)
        public ConversationMemoryProvider redisConversationMemoryProvider(
                org.springframework.data.redis.core.StringRedisTemplate redisTemplate) {
            return new com.aiassistant.spi.RedisConversationMemoryProvider(redisTemplate, 20);
        }
    }

    @Configuration(proxyBeanMethods = false)
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

    @Bean(destroyMethod = "shutdown")
    @ConditionalOnMissingBean
    public com.aiassistant.webhook.WebhookDelivery webhookDelivery(
            AiAssistantProperties properties) {
        return new com.aiassistant.webhook.WebhookDelivery(properties);
    }
}
