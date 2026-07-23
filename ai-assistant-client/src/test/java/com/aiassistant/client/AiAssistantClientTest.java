package com.aiassistant.client;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

class AiAssistantClientTest {

    private HttpServer server;

    @AfterEach
    void stopServer() {
        if (server != null) {
            server.stop(0);
        }
    }

    @Test
    void chatReadsResultFieldAndSendsTokenHeader() throws Exception {
        startServer(
                exchange -> {
                    assertEquals("/ai-assistant/chat", exchange.getRequestURI().getPath());
                    assertEquals("secret", exchange.getRequestHeaders().getFirst("X-AI-Token"));
                    assertEquals("tenant-a", exchange.getRequestHeaders().getFirst("X-Tenant-Id"));
                    respond(exchange, 200, "{\"success\":true,\"result\":\"hello\"}");
                });

        AiAssistantClient client = client();

        assertEquals("hello", client.chat("hi"));
    }

    @Test
    void chatThrowsApiExceptionForLogicalErrorResponse() throws Exception {
        startServer(
                exchange ->
                        respond(
                                exchange,
                                200,
                                "{\"success\":false,\"errorCode\":\"LLM_UNAVAILABLE\",\"error\":\"downstream unavailable\"}"));

        AiAssistantClient client = client();

        AiAssistantClient.ApiException ex =
                assertThrows(AiAssistantClient.ApiException.class, () -> client.chat("hi"));
        assertEquals(200, ex.statusCode());
        assertEquals("LLM_UNAVAILABLE", ex.errorCode());
        assertTrue(ex.getMessage().contains("downstream unavailable"));
    }

    @Test
    void chatThrowsApiExceptionForHttpErrorResponse() throws Exception {
        startServer(
                exchange -> {
                    exchange.getResponseHeaders().add("X-Request-Id", "req-http-error");
                    respond(exchange, 401, "{\"success\":false,\"error\":\"Unauthorized\"}");
                });

        AiAssistantClient client = client();

        AiAssistantClient.ApiException ex =
                assertThrows(AiAssistantClient.ApiException.class, () -> client.chat("hi"));
        assertEquals(401, ex.statusCode());
        assertEquals("req-http-error", ex.requestId());
        assertTrue(ex.getMessage().contains("Unauthorized"));
    }

    @Test
    void blankTokenDoesNotSendTokenHeader() throws Exception {
        startServer(
                exchange -> {
                    assertNull(exchange.getRequestHeaders().getFirst("X-AI-Token"));
                    respond(exchange, 200, "{\"success\":true,\"result\":\"hello\"}");
                });

        AiAssistantClient client =
                AiAssistantClient.builder()
                        .baseUrl(
                                "http://127.0.0.1:"
                                        + server.getAddress().getPort()
                                        + "/ai-assistant")
                        .token("   ")
                        .timeout(Duration.ofSeconds(5))
                        .build();

        assertEquals("hello", client.chat("hi"));
    }

    @Test
    void builderRejectsBlankBaseUrl() {
        IllegalArgumentException ex =
                assertThrows(
                        IllegalArgumentException.class,
                        () -> AiAssistantClient.builder().baseUrl("   ").build());

        assertTrue(ex.getMessage().contains("baseUrl"));
    }

    @Test
    void builderRejectsUnsupportedBaseUrlScheme() {
        IllegalArgumentException ex =
                assertThrows(
                        IllegalArgumentException.class,
                        () -> AiAssistantClient.builder().baseUrl("file:///tmp/assistant").build());

        assertTrue(ex.getMessage().contains("http or https"));
    }

    @Test
    void builderRejectsMissingBaseUrlHost() {
        IllegalArgumentException ex =
                assertThrows(
                        IllegalArgumentException.class,
                        () -> AiAssistantClient.builder().baseUrl("http:///ai-assistant").build());

        assertTrue(ex.getMessage().contains("host"));
    }

    @Test
    void builderRejectsNullTimeout() {
        IllegalArgumentException ex =
                assertThrows(
                        IllegalArgumentException.class,
                        () -> AiAssistantClient.builder().timeout(null).build());

        assertTrue(ex.getMessage().contains("timeout"));
    }

    @Test
    void builderRejectsNonPositiveTimeout() {
        IllegalArgumentException ex =
                assertThrows(
                        IllegalArgumentException.class,
                        () -> AiAssistantClient.builder().timeout(Duration.ZERO).build());

        assertTrue(ex.getMessage().contains("positive"));
    }

    @Test
    void builderRejectsUnsafeTenantId() {
        IllegalArgumentException ex =
                assertThrows(
                        IllegalArgumentException.class,
                        () -> AiAssistantClient.builder().tenantId("tenant/escape").build());

        assertTrue(ex.getMessage().contains("tenantId"));
    }

    @Test
    void chatStreamRejectsNullConsumerBeforeSendingRequest() {
        AiAssistantClient client =
                AiAssistantClient.builder()
                        .baseUrl("http://127.0.0.1:1/ai-assistant")
                        .timeout(Duration.ofSeconds(5))
                        .build();

        IllegalArgumentException ex =
                assertThrows(IllegalArgumentException.class, () -> client.chatStream("hi", null));

        assertTrue(ex.getMessage().contains("onChunk"));
    }

    @Test
    void chatStreamPreservesSseLeadingSpaceAfterSingleSpecSeparator() throws Exception {
        startServer(
                "/ai-assistant/stream",
                exchange -> {
                    assertEquals("/ai-assistant/stream", exchange.getRequestURI().getPath());
                    assertEquals(
                            "text/event-stream", exchange.getRequestHeaders().getFirst("Accept"));
                    respond(
                            exchange,
                            200,
                            "data: Hello\n\ndata:  world\n\ndata: [DONE]\n\n",
                            "text/event-stream;charset=UTF-8");
                });

        AiAssistantClient client = client();
        List<String> chunks = new ArrayList<>();

        client.chatStream("hi", chunks::add);

        assertEquals(List.of("Hello", " world"), chunks);
        assertEquals("Hello world", String.join("", chunks));
    }

    @Test
    void chatStreamSendsTokenAndRuntimeModelPayload() throws Exception {
        startServer(
                "/ai-assistant/stream",
                exchange -> {
                    assertEquals("secret", exchange.getRequestHeaders().getFirst("X-AI-Token"));
                    assertEquals("tenant-a", exchange.getRequestHeaders().getFirst("X-Tenant-Id"));
                    String body =
                            new String(
                                    exchange.getRequestBody().readAllBytes(),
                                    StandardCharsets.UTF_8);
                    assertTrue(body.contains("\"action\":\"chat\""));
                    assertTrue(body.contains("\"text\":\"hi\""));
                    assertTrue(body.contains("\"systemPrompt\":\"system\""));
                    assertTrue(body.contains("\"model\":\"MiniMax-M2.7\""));
                    respond(
                            exchange,
                            200,
                            "data: ok\n\ndata: [DONE]\n\n",
                            "text/event-stream;charset=UTF-8");
                });

        AiAssistantClient client = client();
        List<String> chunks = new ArrayList<>();

        client.chatStream("hi", "system", "MiniMax-M2.7", chunks::add);

        assertEquals(List.of("ok"), chunks);
    }

    @Test
    void chatStreamJoinsMultilineSseDataAndExposesStructuredStreamErrors() throws Exception {
        startServer(
                "/ai-assistant/stream",
                exchange -> {
                    exchange.getResponseHeaders().add("X-Request-Id", "req-stream-error");
                    respond(
                            exchange,
                            200,
                            "data: first line\ndata: second line\n\n"
                                    + "data: [RATE_LIMITED] provider busy\n\n",
                            "text/event-stream;charset=UTF-8");
                });

        AiAssistantClient client = client();
        List<String> chunks = new ArrayList<>();

        AiAssistantClient.ApiException ex =
                assertThrows(
                        AiAssistantClient.ApiException.class,
                        () -> client.chatStream("hi", chunks::add));

        assertEquals(List.of("first line\nsecond line"), chunks);
        assertEquals("RATE_LIMITED", ex.errorCode());
        assertEquals("req-stream-error", ex.requestId());
        assertEquals("provider busy", ex.getMessage());
    }

    private AiAssistantClient client() {
        return AiAssistantClient.builder()
                .baseUrl("http://127.0.0.1:" + server.getAddress().getPort() + "/ai-assistant")
                .token("secret")
                .tenantId("tenant-a")
                .timeout(Duration.ofSeconds(5))
                .build();
    }

    private void startServer(Handler handler) throws IOException {
        startServer("/ai-assistant/chat", handler);
    }

    private void startServer(String path, Handler handler) throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext(
                path,
                exchange -> {
                    try {
                        handler.handle(exchange);
                    } finally {
                        exchange.close();
                    }
                });
        server.start();
    }

    private static void respond(HttpExchange exchange, int status, String body) throws IOException {
        respond(exchange, status, body, "application/json;charset=UTF-8");
    }

    private static void respond(HttpExchange exchange, int status, String body, String contentType)
            throws IOException {
        byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().add("Content-Type", contentType);
        exchange.sendResponseHeaders(status, bytes.length);
        exchange.getResponseBody().write(bytes);
    }

    @FunctionalInterface
    private interface Handler {
        void handle(HttpExchange exchange) throws IOException;
    }
}
