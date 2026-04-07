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
}
