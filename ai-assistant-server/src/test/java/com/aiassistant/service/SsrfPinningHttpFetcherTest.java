package com.aiassistant.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.aiassistant.config.AiAssistantProperties;
import com.aiassistant.security.SsrfPolicy;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import okhttp3.Dns;
import okhttp3.mockwebserver.MockResponse;
import okhttp3.mockwebserver.MockWebServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class SsrfPinningHttpFetcherTest {

    private MockWebServer server;

    /** host 级放行（IP 级走默认 no-op）；MockWebServer 绑 localhost，需放行回环。 */
    private final SsrfPolicy permissive = uri -> {};

    @BeforeEach
    void setUp() throws Exception {
        server = new MockWebServer();
        server.start();
    }

    @AfterEach
    void tearDown() throws Exception {
        server.shutdown();
    }

    private SsrfPinningHttpFetcher fetcher(AiAssistantProperties p, SsrfPolicy policy) {
        return new SsrfPinningHttpFetcher(p, policy, Dns.SYSTEM);
    }

    @Test
    void fetchesBodyBytes() throws Exception {
        server.enqueue(new MockResponse().setBody("hello pinning"));
        byte[] body =
                fetcher(new AiAssistantProperties(), permissive)
                        .fetch(URI.create(server.url("/page").toString()));
        assertEquals("hello pinning", new String(body, StandardCharsets.UTF_8));
    }

    @Test
    void followsRedirectAndRevalidates() throws Exception {
        server.enqueue(new MockResponse().setResponseCode(302).setHeader("Location", "/final"));
        server.enqueue(new MockResponse().setBody("redirected body"));
        byte[] body =
                fetcher(new AiAssistantProperties(), permissive)
                        .fetch(URI.create(server.url("/start").toString()));
        assertEquals("redirected body", new String(body, StandardCharsets.UTF_8));
    }

    @Test
    void capsBodyAtMaxBytes() throws Exception {
        AiAssistantProperties p = new AiAssistantProperties();
        p.setUrlFetchMaxBytes(1024); // 实际下限 1024
        server.enqueue(new MockResponse().setBody("x".repeat(2000)));
        byte[] body = fetcher(p, permissive).fetch(URI.create(server.url("/big").toString()));
        assertEquals(1024, body.length);
    }

    @Test
    void rejectsWhenPolicyBlocksHost() {
        SsrfPolicy blocking =
                uri -> {
                    throw new IllegalArgumentException("host not allowed");
                };
        SsrfPinningHttpFetcher f = fetcher(new AiAssistantProperties(), blocking);
        assertThrows(
                IllegalArgumentException.class,
                () -> f.fetch(URI.create(server.url("/x").toString())));
    }
}
