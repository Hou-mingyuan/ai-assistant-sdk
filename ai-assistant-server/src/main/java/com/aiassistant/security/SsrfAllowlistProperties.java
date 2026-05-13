package com.aiassistant.security;

import jakarta.validation.constraints.NotNull;
import java.util.ArrayList;
import java.util.List;
import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/**
 * Configuration surface for the {@link AllowlistSsrfPolicy} hardening feature.
 *
 * <p>Loaded under the {@code ai-assistant.url-fetch.ssrf-allowlist} prefix:
 *
 * <pre>
 * ai-assistant:
 *   url-fetch:
 *     ssrf-allowlist:
 *       enabled: true              # default false -- opt-in
 *       hosts:
 *         - api.openai.com
 *         - api.deepseek.com
 *         - "*.example.com"
 *         - .test.io
 * </pre>
 *
 * <p>When {@link #isEnabled()} is true and {@link #getHosts()} is non-empty, the auto-configuration
 * registers an {@link AllowlistSsrfPolicy} bean that wraps the default {@link DefaultSsrfPolicy}.
 * Both must hold; an enabled-but-empty configuration is rejected at startup to surface obvious
 * misconfiguration.
 *
 * <p>This class is intentionally kept separate from {@code AiAssistantProperties} so it can be
 * introduced or removed without touching the larger properties class.
 */
@Getter
@Setter
@Validated
@ConfigurationProperties(prefix = "ai-assistant.url-fetch.ssrf-allowlist")
public class SsrfAllowlistProperties {

    /** Master switch. Defaults to false (legacy behaviour: only {@link DefaultSsrfPolicy}). */
    private boolean enabled = false;

    /** Allowed host patterns; see {@link AllowlistSsrfPolicy} for syntax (exact / *.domain / .domain). */
    @NotNull private List<String> hosts = new ArrayList<>();
}
