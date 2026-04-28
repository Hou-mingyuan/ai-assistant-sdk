package com.aiassistant.client;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
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
        startServer(exchange -> {
            assertEquals("/ai-assistant/chat", exchange.getRequestURI().getPath());
            assertEquals("secret", exchange.getRequestHeaders().getFirst("X-AI-Token"));
            respond(exchange, 200, "{\"success\":true,\"result\":\"hello\"}");
        });

        AiAssistantClient client = client();

        assertEquals("hello", client.chat("hi"));
    }

    @Test
    void chatThrowsApiExceptionForLogicalErrorResponse() throws Exception {
        startServer(exchange -> respond(exchange, 200,
                "{\"success\":false,\"errorCode\":\"LLM_UNAVAILABLE\",\"error\":\"downstream unavailable\"}"));

        AiAssistantClient client = client();

        AiAssistantClient.ApiException ex = assertThrows(
                AiAssistantClient.ApiException.class,
                () -> client.chat("hi"));
        assertEquals(200, ex.statusCode());
        assertEquals("LLM_UNAVAILABLE", ex.errorCode());
        assertTrue(ex.getMessage().contains("downstream unavailable"));
    }

    @Test
    void chatThrowsApiExceptionForHttpErrorResponse() throws Exception {
        startServer(exchange -> respond(exchange, 401,
                "{\"success\":false,\"error\":\"Unauthorized\"}"));

        AiAssistantClient client = client();

        AiAssistantClient.ApiException ex = assertThrows(
                AiAssistantClient.ApiException.class,
                () -> client.chat("hi"));
        assertEquals(401, ex.statusCode());
        assertTrue(ex.getMessage().contains("Unauthorized"));
    }

    private AiAssistantClient client() {
        return AiAssistantClient.builder()
                .baseUrl("http://127.0.0.1:" + server.getAddress().getPort() + "/ai-assistant")
                .token("secret")
                .timeout(Duration.ofSeconds(5))
                .build();
    }

    private void startServer(Handler handler) throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/ai-assistant/chat", exchange -> {
            try {
                handler.handle(exchange);
            } finally {
                exchange.close();
            }
        });
        server.start();
    }

    private static void respond(HttpExchange exchange, int status, String body) throws IOException {
        byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().add("Content-Type", "application/json;charset=UTF-8");
        exchange.sendResponseHeaders(status, bytes.length);
        exchange.getResponseBody().write(bytes);
    }

    @FunctionalInterface
    private interface Handler {
        void handle(HttpExchange exchange) throws IOException;
    }
}
