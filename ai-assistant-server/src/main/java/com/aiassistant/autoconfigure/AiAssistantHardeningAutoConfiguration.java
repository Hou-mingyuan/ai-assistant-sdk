package com.aiassistant.autoconfigure;

import com.aiassistant.security.AllowlistSsrfPolicy;
import com.aiassistant.security.DefaultSsrfPolicy;
import com.aiassistant.security.SsrfAllowlistProperties;
import com.aiassistant.security.SsrfPolicy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Hardening auto-configuration for opt-in security features that wrap or replace the default
 * implementations from {@link AiAssistantAutoConfiguration}.
 *
 * <p>Currently wires:
 *
 * <ul>
 *   <li>{@link AllowlistSsrfPolicy} when {@code ai-assistant.url-fetch.ssrf-allowlist.enabled=true}
 *       and a non-empty {@code hosts} list is supplied. The default policy ({@link
 *       DefaultSsrfPolicy}) is used as the base.
 * </ul>
 *
 * <p>This class is loaded automatically by Spring Boot via {@code
 * META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports}; if the host
 * application registers its own {@link SsrfPolicy} bean, that one wins ({@link
 * ConditionalOnMissingBean}).
 *
 * <p>Splitting hardening features out of the main 38 KB {@code AiAssistantAutoConfiguration} keeps
 * the diff small for future additions: a new opt-in hardening feature should add a new {@code
 * &#64;Bean} method here, not edit the main config.
 */
@Configuration(proxyBeanMethods = false)
@EnableConfigurationProperties(SsrfAllowlistProperties.class)
public class AiAssistantHardeningAutoConfiguration {

    private static final Logger log =
            LoggerFactory.getLogger(AiAssistantHardeningAutoConfiguration.class);

    /**
     * Replaces the default {@link SsrfPolicy} with an {@link AllowlistSsrfPolicy} wrapping the
     * default one. Active only when both {@code enabled=true} and at least one host is configured.
     *
     * <p>Empty hosts with enabled=true throws on construction inside {@link AllowlistSsrfPolicy},
     * surfacing the misconfiguration immediately at startup.
     */
    @Bean
    @ConditionalOnMissingBean(SsrfPolicy.class)
    @ConditionalOnProperty(
            prefix = "ai-assistant.url-fetch.ssrf-allowlist",
            name = "enabled",
            havingValue = "true")
    SsrfPolicy ssrfPolicyWithAllowlist(SsrfAllowlistProperties props) {
        if (props.getHosts() == null || props.getHosts().isEmpty()) {
            log.warn(
                    "ai-assistant.url-fetch.ssrf-allowlist.enabled=true but no hosts configured; "
                            + "falling back to DefaultSsrfPolicy. Did you forget to set "
                            + "ai-assistant.url-fetch.ssrf-allowlist.hosts[]?");
            return DefaultSsrfPolicy.INSTANCE;
        }
        AllowlistSsrfPolicy policy =
                new AllowlistSsrfPolicy(DefaultSsrfPolicy.INSTANCE, props.getHosts());
        log.info(
                "SSRF hardening enabled: {} host pattern(s) allowed beyond DefaultSsrfPolicy ({})",
                policy.getPatterns().size(),
                policy.getPatterns());
        return policy;
    }
}
