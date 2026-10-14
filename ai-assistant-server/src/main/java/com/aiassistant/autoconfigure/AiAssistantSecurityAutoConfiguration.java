package com.aiassistant.autoconfigure;

import com.aiassistant.config.AiAssistantAuthFilter;
import com.aiassistant.config.AiAssistantProperties;
import com.aiassistant.config.RateLimitFilter;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnClass;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.autoconfigure.condition.ConditionalOnWebApplication;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * 安全装配：所有 servlet Filter（Tenant / SseCompression / RequestId / Tracing / ApiVersion / RateLimit /
 * Auth / AdminAuth）+ ContentFilter（PII + 注入检测）+ RbacProvider + SsrfPolicy + AuditLogger。
 *
 * <p>Refactor (T2)：从 {@link AiAssistantAutoConfiguration} 拆出。Filter 注册顺序（setOrder）保持原值不变，
 * 否则会影响请求处理流水线。
 */
@Configuration(proxyBeanMethods = false)
public class AiAssistantSecurityAutoConfiguration {

    /**
     * Servlet Filter order contract for the assistant URL patterns (lower runs earlier):
     *
     * <p>Tracing(-4) → SseCompression(-3) → Tenant(-2) → RequestId(-1) → RateLimit(0) →
     * Auth(1) → AdminAuth(2).
     *
     * <p>Auth must run BEFORE Tenant so hmac-mode requests carry the verified tenant attribute
     * when {@link com.aiassistant.config.TenantFilter} resolves identity. AdminAuth must run
     * AFTER Auth (which passes /admin through) and is the sole guard of /admin — its registration
     * is mandatory whenever admin endpoints are exposed.
     */
    public static final int FILTER_ORDER_TRACING = -4;
    public static final int FILTER_ORDER_SSE_COMPRESSION = -3;
    public static final int FILTER_ORDER_TENANT = -2;
    public static final int FILTER_ORDER_REQUEST_ID = -1;
    public static final int FILTER_ORDER_RATE_LIMIT = 0;
    public static final int FILTER_ORDER_AUTH = 1;
    public static final int FILTER_ORDER_ADMIN_AUTH = 2;
    public static final int FILTER_ORDER_API_VERSION = -5;

    @Bean
    @ConditionalOnMissingBean
    public com.aiassistant.security.SsrfPolicy ssrfPolicy() {
        return new com.aiassistant.security.DefaultSsrfPolicy();
    }

    @Bean
    @ConditionalOnMissingBean
    public com.aiassistant.security.ContentFilter contentFilter(AiAssistantProperties properties) {
        return new com.aiassistant.security.ContentFilter(properties.isPiiMaskingEnabled(), true);
    }

    @Bean
    @ConditionalOnMissingBean
    public com.aiassistant.security.RbacProvider rbacProvider() {
        return new com.aiassistant.security.RbacProvider.AllowAll();
    }

    @Bean
    @ConditionalOnMissingBean
    public com.aiassistant.audit.AuditLogger auditLogger() {
        return new com.aiassistant.audit.AuditLogger();
    }

    @Bean
    @ConditionalOnMissingBean
    public com.aiassistant.audit.AuditEventStore auditEventStore() {
        return new com.aiassistant.audit.LoggingAuditEventStore();
    }

    @Bean
    @ConditionalOnWebApplication(type = ConditionalOnWebApplication.Type.SERVLET)
    public FilterRegistrationBean<com.aiassistant.config.TenantFilter> aiAssistantTenantFilter(
            AiAssistantProperties properties) {
        FilterRegistrationBean<com.aiassistant.config.TenantFilter> registration =
                new FilterRegistrationBean<>();
        registration.setFilter(
                new com.aiassistant.config.TenantFilter(
                        properties.getContextPath(),
                        "hmac".equalsIgnoreCase(properties.getAuthMode())));
        addAssistantUrlPatterns(registration, properties);
        registration.setOrder(FILTER_ORDER_TENANT);
        return registration;
    }

    @Bean
    @ConditionalOnWebApplication(type = ConditionalOnWebApplication.Type.SERVLET)
    public FilterRegistrationBean<com.aiassistant.config.SseCompressionFilter>
            aiAssistantSseCompressionFilter(AiAssistantProperties properties) {
        FilterRegistrationBean<com.aiassistant.config.SseCompressionFilter> registration =
                new FilterRegistrationBean<>();
        registration.setFilter(
                new com.aiassistant.config.SseCompressionFilter(properties.getContextPath()));
        addAssistantUrlPatterns(registration, properties);
        registration.setOrder(FILTER_ORDER_SSE_COMPRESSION);
        return registration;
    }

    @Bean
    @ConditionalOnWebApplication(type = ConditionalOnWebApplication.Type.SERVLET)
    public FilterRegistrationBean<com.aiassistant.config.RequestIdFilter>
            aiAssistantRequestIdFilter(AiAssistantProperties properties) {
        FilterRegistrationBean<com.aiassistant.config.RequestIdFilter> registration =
                new FilterRegistrationBean<>();
        registration.setFilter(
                new com.aiassistant.config.RequestIdFilter(properties.getContextPath()));
        addAssistantUrlPatterns(registration, properties);
        registration.setOrder(FILTER_ORDER_REQUEST_ID);
        return registration;
    }

    @Bean
    @ConditionalOnWebApplication(type = ConditionalOnWebApplication.Type.SERVLET)
    @ConditionalOnMissingBean(type = "org.springframework.data.redis.core.StringRedisTemplate")
    public FilterRegistrationBean<RateLimitFilter> aiAssistantRateLimitFilter(
            AiAssistantProperties properties) {
        FilterRegistrationBean<RateLimitFilter> registration = new FilterRegistrationBean<>();
        registration.setFilter(new RateLimitFilter(properties));
        addAssistantUrlPatterns(registration, properties);
        registration.setOrder(FILTER_ORDER_RATE_LIMIT);
        return registration;
    }

    @Bean
    @ConditionalOnClass(name = "org.springframework.data.redis.core.StringRedisTemplate")
    @ConditionalOnBean(org.springframework.data.redis.core.StringRedisTemplate.class)
    @ConditionalOnProperty(
            prefix = "ai-assistant",
            name = "rate-limit-distributed",
            havingValue = "false")
    @ConditionalOnWebApplication(type = ConditionalOnWebApplication.Type.SERVLET)
    public FilterRegistrationBean<RateLimitFilter> aiAssistantLocalRateLimitFilterWhenRedisDisabled(
            AiAssistantProperties properties) {
        FilterRegistrationBean<RateLimitFilter> registration = new FilterRegistrationBean<>();
        registration.setFilter(new RateLimitFilter(properties));
        addAssistantUrlPatterns(registration, properties);
        registration.setOrder(FILTER_ORDER_RATE_LIMIT);
        return registration;
    }

    @Bean
    @ConditionalOnProperty(prefix = "ai-assistant", name = "access-token")
    @ConditionalOnWebApplication(type = ConditionalOnWebApplication.Type.SERVLET)
    public FilterRegistrationBean<AiAssistantAuthFilter> aiAssistantAuthFilter(
            AiAssistantProperties properties) {
        FilterRegistrationBean<AiAssistantAuthFilter> registration = new FilterRegistrationBean<>();
        registration.setFilter(new AiAssistantAuthFilter(properties));
        addAssistantUrlPatterns(registration, properties);
        registration.setOrder(FILTER_ORDER_AUTH);
        return registration;
    }

    @Bean
    @ConditionalOnWebApplication(type = ConditionalOnWebApplication.Type.SERVLET)
    public FilterRegistrationBean<com.aiassistant.config.AdminAuthFilter>
            aiAssistantAdminAuthFilter(AiAssistantProperties properties) {
        String adminToken = properties.getAdmin().resolveAdminToken(properties.getAccessToken());
        // P0 hardening: fail fast when admin endpoints are enabled but resolve to no token —
        // previously an empty adminToken made AdminAuthFilter reject every /admin request, but
        // if the filter itself were absent (custom override removing this bean) the /admin
        // surface — including tenant-token issuance — would be silently unguarded. Encode the
        // Auth(1) → AdminAuth(2) ordering as named constants so the dependency is explicit.
        if (properties.isAdminEnabled() && (adminToken == null || adminToken.isBlank())) {
            throw new IllegalStateException(
                    "ai-assistant.admin-enabled=true but no admin token could be resolved "
                            + "(ai-assistant.admin.token / ai-assistant.access-token). Refusing to start: "
                            + "admin endpoints (incl. tenant-token issuance) must not run unguarded.");
        }
        FilterRegistrationBean<com.aiassistant.config.AdminAuthFilter> registration =
                new FilterRegistrationBean<>();
        registration.setFilter(
                new com.aiassistant.config.AdminAuthFilter(
                        properties.getContextPath(), adminToken));
        addAdminUrlPatterns(registration, properties);
        registration.setOrder(FILTER_ORDER_ADMIN_AUTH);
        return registration;
    }

    @Bean
    @ConditionalOnWebApplication(type = ConditionalOnWebApplication.Type.SERVLET)
    public FilterRegistrationBean<com.aiassistant.config.TracingFilter> aiAssistantTracingFilter(
            AiAssistantProperties properties) {
        FilterRegistrationBean<com.aiassistant.config.TracingFilter> registration =
                new FilterRegistrationBean<>();
        registration.setFilter(new com.aiassistant.config.TracingFilter());
        addAssistantUrlPatterns(registration, properties);
        registration.setOrder(FILTER_ORDER_TRACING);
        return registration;
    }

    @Bean
    @ConditionalOnWebApplication(type = ConditionalOnWebApplication.Type.SERVLET)
    @ConditionalOnProperty(
            prefix = "ai-assistant",
            name = "api-versioning",
            havingValue = "true",
            matchIfMissing = true)
    public FilterRegistrationBean<com.aiassistant.config.ApiVersionConfig.ApiVersionFilter>
            aiAssistantApiVersionFilter(AiAssistantProperties properties) {
        FilterRegistrationBean<com.aiassistant.config.ApiVersionConfig.ApiVersionFilter>
                registration = new FilterRegistrationBean<>();
        registration.setFilter(
                new com.aiassistant.config.ApiVersionConfig.ApiVersionFilter(
                        properties.getContextPath(), properties.getApiVersion()));
        addAssistantUrlPatterns(registration, properties);
        registration.setOrder(FILTER_ORDER_API_VERSION);
        return registration;
    }

    /**
     * Redis 分布式限流 filter（Redis 在 classpath 且 StringRedisTemplate Bean 存在时自动激活）。 与本地 {@link
     * #aiAssistantRateLimitFilter} 互斥（后者 ConditionalOnMissingClass Redis）。
     */
    @Configuration(proxyBeanMethods = false)
    @ConditionalOnClass(name = "org.springframework.data.redis.core.StringRedisTemplate")
    static class RedisRateLimitAutoConfiguration {
        @Bean
        @ConditionalOnBean(org.springframework.data.redis.core.StringRedisTemplate.class)
        @ConditionalOnWebApplication(type = ConditionalOnWebApplication.Type.SERVLET)
        @ConditionalOnProperty(
                prefix = "ai-assistant",
                name = "rate-limit-distributed",
                havingValue = "true",
                matchIfMissing = true)
        public FilterRegistrationBean<com.aiassistant.config.RedisRateLimitFilter>
                aiAssistantRedisRateLimitFilter(
                        AiAssistantProperties properties,
                        org.springframework.data.redis.core.StringRedisTemplate redisTemplate) {
            FilterRegistrationBean<com.aiassistant.config.RedisRateLimitFilter> registration =
                    new FilterRegistrationBean<>();
            registration.setFilter(
                    new com.aiassistant.config.RedisRateLimitFilter(properties, redisTemplate));
            addAssistantUrlPatterns(registration, properties);
            registration.setOrder(FILTER_ORDER_RATE_LIMIT);
            return registration;
        }
    }

    private static void addAssistantUrlPatterns(
            FilterRegistrationBean<?> registration, AiAssistantProperties properties) {
        registration.addUrlPatterns(
                com.aiassistant.config.ApiVersionConfig.resolveAssistantUrlPatterns(
                        properties.getContextPath(), properties.getApiVersion()));
    }

    private static void addAdminUrlPatterns(
            FilterRegistrationBean<?> registration, AiAssistantProperties properties) {
        registration.addUrlPatterns(
                com.aiassistant.config.ApiVersionConfig.resolveAdminUrlPatterns(
                        properties.getContextPath(), properties.getApiVersion()));
    }
}
