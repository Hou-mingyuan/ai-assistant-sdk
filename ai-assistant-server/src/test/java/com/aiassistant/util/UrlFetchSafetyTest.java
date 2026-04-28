package com.aiassistant.util;

import org.junit.jupiter.api.Test;

import java.net.URI;

import static org.junit.jupiter.api.Assertions.*;

class UrlFetchSafetyTest {

    @Test
    void allowsPublicUrl() {
        assertDoesNotThrow(() ->
            UrlFetchSafety.validateHttpUrlForServerSideFetch(URI.create("https://example.com/page"))
        );
    }

    @Test
    void blocksLocalhost() {
        assertThrows(IllegalArgumentException.class, () ->
            UrlFetchSafety.validateHttpUrlForServerSideFetch(URI.create("http://localhost/admin"))
        );
    }

    @Test
    void blocksPrivateIp() {
        assertThrows(IllegalArgumentException.class, () ->
            UrlFetchSafety.validateHttpUrlForServerSideFetch(URI.create("http://192.168.1.1/"))
        );
    }

    @Test
    void blocksLinkLocal() {
        assertThrows(IllegalArgumentException.class, () ->
            UrlFetchSafety.validateHttpUrlForServerSideFetch(URI.create("http://169.254.169.254/metadata"))
        );
    }

    @Test
    void blocksZeroAddress() {
        assertThrows(IllegalArgumentException.class, () ->
            UrlFetchSafety.validateHttpUrlForServerSideFetch(URI.create("http://0.0.0.0/"))
        );
    }

    @Test
    void blocksFtpScheme() {
        assertThrows(IllegalArgumentException.class, () ->
            UrlFetchSafety.validateHttpUrlForServerSideFetch(URI.create("ftp://files.example.com/"))
        );
    }

    @Test
    void blocksNullUri() {
        assertThrows(IllegalArgumentException.class, () ->
            UrlFetchSafety.validateHttpUrlForServerSideFetch(null)
        );
    }

    @Test
    void blocksCgn() {
        assertThrows(IllegalArgumentException.class, () ->
            UrlFetchSafety.validateHttpUrlForServerSideFetch(URI.create("http://100.100.100.100/"))
        );
    }

    @Test
    void blocksMulticastAndReservedIpv4Ranges() {
        assertThrows(IllegalArgumentException.class, () ->
            UrlFetchSafety.validateHttpUrlForServerSideFetch(URI.create("http://224.0.0.1/"))
        );
        assertThrows(IllegalArgumentException.class, () ->
            UrlFetchSafety.validateHttpUrlForServerSideFetch(URI.create("http://255.255.255.255/"))
        );
    }

    @Test
    void blocksDocumentationAndBenchmarkIpv4Ranges() {
        assertThrows(IllegalArgumentException.class, () ->
            UrlFetchSafety.validateHttpUrlForServerSideFetch(URI.create("http://192.0.2.1/"))
        );
        assertThrows(IllegalArgumentException.class, () ->
            UrlFetchSafety.validateHttpUrlForServerSideFetch(URI.create("http://198.18.0.1/"))
        );
        assertThrows(IllegalArgumentException.class, () ->
            UrlFetchSafety.validateHttpUrlForServerSideFetch(URI.create("http://203.0.113.1/"))
        );
    }

    @Test
    void blocksUnsafeIpv6Ranges() {
        assertThrows(IllegalArgumentException.class, () ->
            UrlFetchSafety.validateHttpUrlForServerSideFetch(URI.create("http://[ff02::1]/"))
        );
        assertThrows(IllegalArgumentException.class, () ->
            UrlFetchSafety.validateHttpUrlForServerSideFetch(URI.create("http://[2001:db8::1]/"))
        );
        assertThrows(IllegalArgumentException.class, () ->
            UrlFetchSafety.validateHttpUrlForServerSideFetch(URI.create("http://[::ffff:127.0.0.1]/"))
        );
    }
}
