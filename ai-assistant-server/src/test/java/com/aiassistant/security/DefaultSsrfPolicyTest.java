package com.aiassistant.security;

import static org.junit.jupiter.api.Assertions.*;

import java.net.URI;
import org.junit.jupiter.api.Test;

/**
 * Verifies the new {@link SsrfPolicy} abstraction. Strategy parity with the legacy facade is
 * already covered by {@code UrlFetchSafetyTest}; this suite focuses on the new entry points.
 */
class DefaultSsrfPolicyTest {

    @Test
    void instanceIsSingleton() {
        assertSame(DefaultSsrfPolicy.INSTANCE, DefaultSsrfPolicy.INSTANCE);
    }

    @Test
    void instanceMethodAcceptsPublicUrl() {
        SsrfPolicy policy = DefaultSsrfPolicy.INSTANCE;
        assertDoesNotThrow(() -> policy.validate(URI.create("https://8.8.8.8/page")));
    }

    @Test
    void instanceMethodBlocksLocalhost() {
        SsrfPolicy policy = new DefaultSsrfPolicy();
        IllegalArgumentException ex =
                assertThrows(
                        IllegalArgumentException.class,
                        () -> policy.validate(URI.create("http://localhost/admin")));
        assertTrue(ex.getMessage().contains("not allowed"));
    }

    @Test
    void instanceMethodBlocksMetadataIp() {
        SsrfPolicy policy = new DefaultSsrfPolicy();
        assertThrows(
                IllegalArgumentException.class,
                () -> policy.validate(URI.create("http://169.254.169.254/")));
    }

    @Test
    void instanceMethodRejectsNullUri() {
        SsrfPolicy policy = new DefaultSsrfPolicy();
        assertThrows(IllegalArgumentException.class, () -> policy.validate(null));
    }

    @Test
    void instanceMethodRejectsNonHttpScheme() {
        SsrfPolicy policy = new DefaultSsrfPolicy();
        assertThrows(
                IllegalArgumentException.class,
                () -> policy.validate(URI.create("ftp://example.com/")));
    }

    @Test
    void hostsCanProvideStricterPolicies() {
        // Hosts may register their own SsrfPolicy bean to enforce stricter rules
        // (e.g. domain allowlists). Verify the interface is composable.
        SsrfPolicy strict =
                uri -> {
                    DefaultSsrfPolicy.INSTANCE.validate(uri);
                    if (!uri.getHost().endsWith(".example.com")) {
                        throw new IllegalArgumentException("host outside allowlist");
                    }
                };

        assertThrows(
                IllegalArgumentException.class,
                () -> strict.validate(URI.create("https://google.com/")));
    }
}
