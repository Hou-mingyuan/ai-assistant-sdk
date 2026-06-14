package com.aiassistant.service;

import static org.junit.jupiter.api.Assertions.*;

import java.net.URI;
import org.junit.jupiter.api.Test;

/**
 * Unit tests for {@link HttpContentFetcher#pinHttpUriToIp(URI, String)} — the pure DNS-rebinding
 * (R5) URI rewriter. The networking path itself is exercised by the URL-fetch integration tests;
 * here we pin down the rewrite rules that must never regress: http-only, IPv6 bracketing, and
 * preservation of port/path/query.
 *
 * @author houmy01
 */
class HttpContentFetcherTest {

    @Test
    void rewritesHttpHostToIpv4PreservingPathAndQuery() {
        URI pinned =
                HttpContentFetcher.pinHttpUriToIp(
                        URI.create("http://example.com/path/page?x=1&y=2"), "93.184.216.34");
        assertEquals("http://93.184.216.34/path/page?x=1&y=2", pinned.toString());
    }

    @Test
    void preservesExplicitPort() {
        URI pinned =
                HttpContentFetcher.pinHttpUriToIp(
                        URI.create("http://example.com:8080/a"), "10.0.0.5");
        assertEquals("http://10.0.0.5:8080/a", pinned.toString());
    }

    @Test
    void defaultsEmptyPathToRoot() {
        URI pinned = HttpContentFetcher.pinHttpUriToIp(URI.create("http://example.com"), "1.2.3.4");
        assertEquals("http://1.2.3.4/", pinned.toString());
    }

    @Test
    void bracketsIpv6Literal() {
        URI pinned =
                HttpContentFetcher.pinHttpUriToIp(
                        URI.create("http://example.com/x"), "2606:2800::1");
        assertEquals("http://[2606:2800::1]/x", pinned.toString());
    }

    @Test
    void neverPinsHttpsToProtectTls() {
        URI original = URI.create("https://example.com/secure");
        assertSame(original, HttpContentFetcher.pinHttpUriToIp(original, "93.184.216.34"));
    }

    @Test
    void returnsOriginalWhenIpBlankOrUriNull() {
        URI original = URI.create("http://example.com/x");
        assertSame(original, HttpContentFetcher.pinHttpUriToIp(original, "   "));
        assertNull(HttpContentFetcher.pinHttpUriToIp(null, "1.2.3.4"));
    }
}
