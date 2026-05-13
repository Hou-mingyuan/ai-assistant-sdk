package com.aiassistant.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.net.URI;
import java.util.List;
import org.junit.jupiter.api.Test;

class AllowlistSsrfPolicyTest {

    private static final SsrfPolicy NOOP =
            uri -> {
                /* allow everything during allowlist tests */
            };

    @Test
    void exactHostMatchPasses() {
        SsrfPolicy p = new AllowlistSsrfPolicy(NOOP, "api.openai.com");
        p.validate(URI.create("https://api.openai.com/v1/chat/completions"));
    }

    @Test
    void exactHostMismatchIsRejected() {
        SsrfPolicy p = new AllowlistSsrfPolicy(NOOP, "api.openai.com");
        assertThatThrownBy(() -> p.validate(URI.create("https://evil.com/path")))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("not in allowlist");
    }

    @Test
    void wildcardSubdomainMatches() {
        SsrfPolicy p = new AllowlistSsrfPolicy(NOOP, "*.example.com");
        p.validate(URI.create("https://api.example.com/x"));
        p.validate(URI.create("https://foo.bar.example.com/y"));
    }

    @Test
    void wildcardSubdomainDoesNotMatchApex() {
        SsrfPolicy p = new AllowlistSsrfPolicy(NOOP, "*.example.com");
        assertThatThrownBy(() -> p.validate(URI.create("https://example.com/x")))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void apexEntryMatchesApexAndSubdomains() {
        SsrfPolicy p = new AllowlistSsrfPolicy(NOOP, ".example.com");
        p.validate(URI.create("https://example.com/x"));
        p.validate(URI.create("https://api.example.com/y"));
        p.validate(URI.create("https://foo.bar.example.com/z"));
    }

    @Test
    void hostMatchIsCaseInsensitive() {
        SsrfPolicy p = new AllowlistSsrfPolicy(NOOP, "API.Example.COM");
        p.validate(URI.create("https://api.example.com/x"));
    }

    @Test
    void delegatesToBasePolicyFirst() {
        SsrfPolicy base =
                uri -> {
                    throw new IllegalArgumentException("base rejected: " + uri);
                };
        SsrfPolicy p = new AllowlistSsrfPolicy(base, "api.example.com");
        assertThatThrownBy(() -> p.validate(URI.create("https://api.example.com/x")))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("base rejected");
    }

    @Test
    void combinedWithDefaultBlocksPrivateAddresses() {
        SsrfPolicy p = new AllowlistSsrfPolicy(DefaultSsrfPolicy.INSTANCE, "*.example.com");
        assertThatThrownBy(() -> p.validate(URI.create("http://192.168.1.1/")))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> p.validate(URI.create("http://localhost/")))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void rejectsBlankAndNullEntries() {
        assertThatThrownBy(() -> new AllowlistSsrfPolicy(NOOP, List.of()))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("at least one");
        assertThatThrownBy(() -> new AllowlistSsrfPolicy(NOOP, List.of("   ", "")))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void rejectsInvalidWildcardEntries() {
        assertThatThrownBy(() -> new AllowlistSsrfPolicy(NOOP, "foo*.example.com"))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new AllowlistSsrfPolicy(NOOP, "*."))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void exposesPatternsForDiagnostics() {
        AllowlistSsrfPolicy p =
                new AllowlistSsrfPolicy(NOOP, "api.openai.com", "*.example.com", ".test.io");
        assertThat(p.getPatterns()).containsExactly("api.openai.com", "*.example.com", ".test.io");
    }
}
