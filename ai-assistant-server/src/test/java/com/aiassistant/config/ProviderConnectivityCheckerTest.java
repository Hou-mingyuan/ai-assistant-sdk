package com.aiassistant.config;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import okhttp3.mockwebserver.MockResponse;
import okhttp3.mockwebserver.MockWebServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class ProviderConnectivityCheckerTest {

    private static final String API_KEY = "sk-secret-value";

    private MockWebServer server;

    @BeforeEach
    void setUp() throws IOException {
        server = new MockWebServer();
        server.start();
    }

    @AfterEach
    void tearDown() throws IOException {
        server.shutdown();
    }

    @Test
    void redactsProviderErrorBodiesBeforeReturningOrLoggingThem() {
        server.enqueue(
                new MockResponse()
                        .setResponseCode(500)
                        .setBody(
                                "authorization=Bearer "
                                        + API_KEY
                                        + "\napi_key=upstream-secret\r\nretry later"));
        ProviderConnectivityChecker checker = checker();

        checker.check();

        String error = checker.getLastResult().errorMessage();
        assertTrue(error.contains("HTTP 500"));
        assertTrue(error.contains("[redacted]"));
        assertFalse(error.contains("[redacted]]"));
        assertFalse(error.contains(API_KEY));
        assertFalse(error.contains("upstream-secret"));
        assertFalse(error.contains("\n"));
        assertFalse(error.contains("\r"));
        assertFalse(error.contains(server.getHostName()));
    }

    @Test
    void authenticationFailureOnlyReturnsMaskedKey() {
        server.enqueue(new MockResponse().setResponseCode(401));
        ProviderConnectivityChecker checker = checker();

        checker.check();

        String error = checker.getLastResult().errorMessage();
        assertTrue(error.contains(ProviderConnectivityChecker.maskApiKey(API_KEY)));
        assertFalse(error.contains(API_KEY));
    }

    private ProviderConnectivityChecker checker() {
        AiAssistantProperties properties = new AiAssistantProperties();
        properties.setProvider("openai");
        properties.setBaseUrl(server.url("/v1").toString());
        properties.setApiKey(API_KEY);
        return new ProviderConnectivityChecker(properties);
    }
}
