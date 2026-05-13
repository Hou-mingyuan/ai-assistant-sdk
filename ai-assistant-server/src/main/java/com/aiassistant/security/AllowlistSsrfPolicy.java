package com.aiassistant.security;

import java.net.IDN;
import java.net.URI;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collection;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.regex.Pattern;

/**
 * {@link SsrfPolicy} implementation that delegates first to a base policy ({@link DefaultSsrfPolicy}
 * by default) and then enforces an additional host allowlist. URIs whose host does not match any
 * entry in the allowlist are rejected.
 *
 * <p>Each allowlist entry is matched case-insensitively against the IDN-normalised host:
 *
 * <ul>
 *   <li><b>Exact host</b>: {@code api.example.com} matches only {@code api.example.com}.
 *   <li><b>Subdomain wildcard</b>: {@code *.example.com} matches {@code api.example.com}, {@code
 *       foo.bar.example.com}, but <b>not</b> {@code example.com} itself.
 *   <li><b>Apex + subdomains</b>: {@code .example.com} matches {@code example.com} and every
 *       subdomain.
 * </ul>
 *
 * <p>Hosts that look like raw IPs are also matched literally (no glob), which intentionally makes
 * IP-based allowlisting opt-in only — combine with {@link DefaultSsrfPolicy} to block RFC1918 / link
 * local even when wildcard would otherwise permit them.
 *
 * <p>Empty allowlist behaviour: throws on construction. Callers must always supply at least one
 * pattern; pass {@link DefaultSsrfPolicy} alone if no allowlist is wanted.
 *
 * <p>Thread-safe; immutable after construction.
 *
 * <pre>{@code
 * SsrfPolicy policy = new AllowlistSsrfPolicy(
 *     DefaultSsrfPolicy.INSTANCE,
 *     List.of("api.openai.com", "*.example.com", "ollama.local"));
 * policy.validate(URI.create("https://api.openai.com/v1/chat/completions")); // ok
 * policy.validate(URI.create("https://evil.com")); // throws IllegalArgumentException
 * }</pre>
 *
 * <p>Wire it into Spring as the {@code SsrfPolicy} bean to replace the default:
 *
 * <pre>{@code
 * @Bean
 * @ConditionalOnProperty(prefix = "ai-assistant.url-fetch.ssrf", name = "allowed-hosts")
 * SsrfPolicy ssrfPolicy(AiAssistantProperties props) {
 *   return new AllowlistSsrfPolicy(
 *       DefaultSsrfPolicy.INSTANCE,
 *       props.getUrlFetch().getSsrf().getAllowedHosts());
 * }
 * }</pre>
 */
public final class AllowlistSsrfPolicy implements SsrfPolicy {

    private final SsrfPolicy base;
    private final List<HostMatcher> matchers;

    public AllowlistSsrfPolicy(SsrfPolicy base, Collection<String> allowedHosts) {
        this.base = Objects.requireNonNull(base, "base policy is required");
        Objects.requireNonNull(allowedHosts, "allowedHosts is required");
        List<HostMatcher> compiled = new ArrayList<>(allowedHosts.size());
        for (String raw : allowedHosts) {
            if (raw == null) continue;
            String s = raw.trim();
            if (s.isEmpty()) continue;
            compiled.add(HostMatcher.compile(s));
        }
        if (compiled.isEmpty()) {
            throw new IllegalArgumentException(
                    "AllowlistSsrfPolicy requires at least one non-blank allowed-host entry");
        }
        this.matchers = List.copyOf(compiled);
    }

    public AllowlistSsrfPolicy(SsrfPolicy base, String... allowedHosts) {
        this(base, Arrays.asList(allowedHosts));
    }

    @Override
    public void validate(URI uri) {
        base.validate(uri);
        if (uri == null) {
            throw new IllegalArgumentException("uri is null");
        }
        String rawHost = uri.getHost();
        if (rawHost == null || rawHost.isBlank()) {
            throw new IllegalArgumentException("host required");
        }
        String host = normalize(rawHost);
        for (HostMatcher m : matchers) {
            if (m.matches(host)) {
                return;
            }
        }
        throw new IllegalArgumentException("host not in allowlist: " + rawHost);
    }

    /** Expose the compiled patterns for diagnostics / logging. */
    public List<String> getPatterns() {
        List<String> out = new ArrayList<>(matchers.size());
        for (HostMatcher m : matchers) out.add(m.original);
        return List.copyOf(out);
    }

    private static String normalize(String host) {
        String trimmed = host.trim();
        if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
            trimmed = trimmed.substring(1, trimmed.length() - 1);
        }
        try {
            return IDN.toASCII(trimmed, IDN.ALLOW_UNASSIGNED).toLowerCase(Locale.ROOT);
        } catch (IllegalArgumentException e) {
            return trimmed.toLowerCase(Locale.ROOT);
        }
    }

    /** Compiled allowlist pattern; supports exact match, wildcard (*.domain), and apex (.domain). */
    private static final class HostMatcher {
        final String original;
        final Pattern pattern;
        final boolean ipLiteral;

        private HostMatcher(String original, Pattern pattern, boolean ipLiteral) {
            this.original = original;
            this.pattern = pattern;
            this.ipLiteral = ipLiteral;
        }

        static HostMatcher compile(String raw) {
            String entry = raw.trim().toLowerCase(Locale.ROOT);
            boolean isIp = looksLikeIpLiteral(entry);
            if (entry.startsWith("*.")) {
                String suffix = entry.substring(2);
                if (suffix.isBlank() || suffix.contains("*")) {
                    throw new IllegalArgumentException("invalid wildcard allowlist entry: " + raw);
                }
                String regex = "^([^.]+\\.)+" + Pattern.quote(suffix) + "$";
                return new HostMatcher(raw, Pattern.compile(regex), false);
            }
            if (entry.startsWith(".")) {
                String suffix = entry.substring(1);
                if (suffix.isBlank() || suffix.contains("*")) {
                    throw new IllegalArgumentException("invalid apex allowlist entry: " + raw);
                }
                String regex = "^(?:[^.]+\\.)*" + Pattern.quote(suffix) + "$";
                return new HostMatcher(raw, Pattern.compile(regex), false);
            }
            if (entry.contains("*")) {
                throw new IllegalArgumentException(
                        "only leading '*.' wildcards are supported: " + raw);
            }
            return new HostMatcher(raw, Pattern.compile("^" + Pattern.quote(entry) + "$"), isIp);
        }

        boolean matches(String host) {
            return pattern.matcher(host).matches();
        }

        private static boolean looksLikeIpLiteral(String entry) {
            return entry.matches("^[0-9.]+$") || entry.contains(":");
        }
    }
}
