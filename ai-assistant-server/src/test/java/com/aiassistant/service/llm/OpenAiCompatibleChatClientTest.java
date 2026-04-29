package com.aiassistant.service.llm;

import static org.junit.jupiter.api.Assertions.*;

import com.aiassistant.config.AiAssistantProperties;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.io.IOException;
import java.util.List;
import okhttp3.mockwebserver.MockResponse;
import okhttp3.mockwebserver.MockWebServer;
import okhttp3.mockwebserver.RecordedRequest;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class OpenAiCompatibleChatClientTest {

    private final ObjectMapper mapper = new ObjectMapper();
    private MockWebServer server;
    private OpenAiCompatibleChatClient client;

    @BeforeEach
    void setUp() throws IOException {
        server = new MockWebServer();
        server.start();

        AiAssistantProperties properties = new AiAssistantProperties();
        properties.setBaseUrl(server.url("/v1").toString());
        properties.setTimeoutSeconds(2);
        properties.setLlmMaxRetries(0);
        properties.setChatMaxTotalChars(16_000);

        client = new OpenAiCompatibleChatClient(properties);
    }

    @AfterEach
    void tearDown() throws IOException {
        if (client != null) {
            client.destroy();
        }
        if (server != null) {
            server.shutdown();
        }
    }

    @Test
    void completeParsesAssistantContentAndSendsOpenAiCompatibleRequest() throws Exception {
        server.enqueue(jsonResponse(chatResponse("Hello from model")));

        String result = client.complete(requestBody(), "test-key");

        assertEquals("Hello from model", result);
        RecordedRequest request = server.takeRequest();
        assertEquals("/v1/chat/completions", request.getPath());
        assertEquals("Bearer test-key", request.getHeader("Authorization"));
        assertTrue(request.getHeader("Content-Type").contains("application/json"));
        assertEquals(
                "demo-model", mapper.readTree(request.getBody().readUtf8()).path("model").asText());
    }

    @Test
    void completeRawReturnsRawBodyWithoutParsing() {
        String raw = chatResponse("raw content");
        server.enqueue(jsonResponse(raw));

        assertEquals(raw, client.completeRaw(requestBody(), "test-key"));
    }

    @Test
    void completeThrowsReadableMessageForErrorEnvelope() {
        server.enqueue(jsonResponse("{\"error\":{\"message\":\"model is unavailable\"}}"));

        IllegalStateException ex =
                assertThrows(
                        IllegalStateException.class,
                        () -> client.complete(requestBody(), "test-key"));

        assertEquals("model is unavailable", ex.getMessage());
    }

    @Test
    void completeThrowsForHttpErrors() {
        server.enqueue(
                new MockResponse()
                        .setResponseCode(503)
                        .setHeader("Content-Type", "application/json")
                        .setBody("{\"error\":\"busy\"}"));

        IllegalStateException ex =
                assertThrows(
                        IllegalStateException.class,
                        () -> client.complete(requestBody(), "test-key"));

        assertTrue(ex.getMessage().contains("HTTP 503"));
    }

    @Test
    void completeStreamParsesSseDeltasAndIgnoresDoneFrames() {
        server.enqueue(
                new MockResponse()
                        .setHeader("Content-Type", "text/event-stream")
                        .setBody(
                                """
                                data: {"choices":[{"delta":{"content":"hel"}}]}

                                data: {"choices":[{"delta":{"content":"lo"}}]}

                                data: [DONE]

                                """));

        List<String> chunks =
                client.completeStream(requestBody(), "test-key").collectList().block();

        assertEquals(List.of("hel", "lo"), chunks);
    }

    @Test
    void completeReturnsEmptyStringForBlankBody() {
        server.enqueue(jsonResponse(""));

        assertEquals("", client.complete(requestBody(), "test-key"));
    }

    private ObjectNode requestBody() {
        ObjectNode body = mapper.createObjectNode();
        body.put("model", "demo-model");
        body.put("stream", false);
        body.putArray("messages").addObject().put("role", "user").put("content", "hi");
        return body;
    }

    private static MockResponse jsonResponse(String body) {
        return new MockResponse().setHeader("Content-Type", "application/json").setBody(body);
    }

    private static String chatResponse(String content) {
        return "{\"choices\":[{\"message\":{\"content\":\"" + content + "\"}}]}";
    }
}
