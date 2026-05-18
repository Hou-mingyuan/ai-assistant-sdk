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
    void completeStreamPreservesReasoningDeltasAsThinkMarkup() {
        server.enqueue(
                new MockResponse()
                        .setHeader("Content-Type", "text/event-stream")
                        .setBody(
                                """
                                data: {"choices":[{"delta":{"reasoning_content":"checking page"}}]}

                                data: {"choices":[{"delta":{"content":"done"}}]}

                                data: [DONE]

                                """));

        List<String> chunks =
                client.completeStream(requestBody(), "test-key").take(1).collectList().block();

        assertEquals(List.of("<think>checking page</think>"), chunks);
    }

    @Test
    void completeRoutesMinimaxImageRequestsToDedicatedVlmEndpoint() throws Exception {
        OpenAiCompatibleChatClient minimaxClient = minimaxClient();
        server.enqueue(jsonResponse("{\"content\":\"screenshot says hello\"}"));

        String result = minimaxClient.complete(imageRequestBody(), "test-key");

        assertEquals("screenshot says hello", result);
        RecordedRequest request = server.takeRequest();
        assertEquals("/v1/coding_plan/vlm", request.getPath());
        var body = mapper.readTree(request.getBody().readUtf8());
        assertEquals("describe screenshot", body.path("prompt").asText());
        assertEquals("data:image/png;base64,shot", body.path("image_url").asText());
        minimaxClient.destroy();
    }

    @Test
    void completeStreamRoutesMinimaxImageRequestsToDedicatedVlmEndpoint() throws Exception {
        OpenAiCompatibleChatClient minimaxClient = minimaxClient();
        server.enqueue(jsonResponse("{\"content\":\"visual stream result\"}"));

        List<String> chunks =
                minimaxClient.completeStream(imageRequestBody(), "test-key").collectList().block();

        assertEquals(List.of("visual stream result"), chunks);
        assertEquals("/v1/coding_plan/vlm", server.takeRequest().getPath());
        minimaxClient.destroy();
    }

    @Test
    void completeRoutesEachMinimaxImageToVlmInsteadOfDroppingExtraImages() throws Exception {
        OpenAiCompatibleChatClient minimaxClient = minimaxClient();
        server.enqueue(jsonResponse("{\"content\":\"first screenshot\"}"));
        server.enqueue(jsonResponse("{\"content\":\"second screenshot\"}"));

        String result = minimaxClient.complete(multiImageRequestBody(), "test-key");

        assertTrue(result.contains("Image 1"));
        assertTrue(result.contains("first screenshot"));
        assertTrue(result.contains("Image 2"));
        assertTrue(result.contains("second screenshot"));
        assertEquals(
                "data:image/png;base64,one",
                mapper.readTree(server.takeRequest().getBody().readUtf8())
                        .path("image_url")
                        .asText());
        assertEquals(
                "data:image/jpeg;base64,two",
                mapper.readTree(server.takeRequest().getBody().readUtf8())
                        .path("image_url")
                        .asText());
        minimaxClient.destroy();
    }

    @Test
    void completeMinimaxVisionThrowsWhenVlmReturnsNoVisibleContent() {
        OpenAiCompatibleChatClient minimaxClient = minimaxClient();
        server.enqueue(jsonResponse("{\"content\":\"\",\"base_resp\":{\"status_code\":0}}"));

        IllegalStateException ex =
                assertThrows(
                        IllegalStateException.class,
                        () -> minimaxClient.complete(imageRequestBody(), "test-key"));

        assertTrue(ex.getMessage().contains("empty content"));
        minimaxClient.destroy();
    }

    @Test
    void completeMinimaxVisionThrowsWhenVlmReturnsBlankBody() {
        OpenAiCompatibleChatClient minimaxClient = minimaxClient();
        server.enqueue(jsonResponse(""));

        IllegalStateException ex =
                assertThrows(
                        IllegalStateException.class,
                        () -> minimaxClient.complete(imageRequestBody(), "test-key"));

        assertTrue(ex.getMessage().contains("empty content"));
        minimaxClient.destroy();
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

    private ObjectNode imageRequestBody() {
        ObjectNode body = mapper.createObjectNode();
        body.put("model", "MiniMax-M2.7");
        body.put("stream", false);
        var content = body.putArray("messages").addObject().put("role", "user").putArray("content");
        content.addObject().put("type", "text").put("text", "describe screenshot");
        content.addObject()
                .put("type", "image_url")
                .putObject("image_url")
                .put("url", "data:image/png;base64,shot");
        return body;
    }

    private ObjectNode multiImageRequestBody() {
        ObjectNode body = mapper.createObjectNode();
        body.put("model", "MiniMax-M2.7");
        body.put("stream", false);
        var content = body.putArray("messages").addObject().put("role", "user").putArray("content");
        content.addObject().put("type", "text").put("text", "compare screenshots");
        content.addObject()
                .put("type", "image_url")
                .putObject("image_url")
                .put("url", "data:image/png;base64,one");
        content.addObject()
                .put("type", "image_url")
                .putObject("image_url")
                .put("url", "data:image/jpeg;base64,two");
        return body;
    }

    private OpenAiCompatibleChatClient minimaxClient() {
        AiAssistantProperties properties = new AiAssistantProperties();
        properties.setProvider("minimax");
        properties.setBaseUrl(server.url("/v1").toString());
        properties.setMinimaxVlmBaseUrl(server.url("/v1").toString());
        properties.setTimeoutSeconds(2);
        properties.setLlmMaxRetries(0);
        properties.setChatMaxTotalChars(16_000);
        return new OpenAiCompatibleChatClient(properties);
    }

    private static MockResponse jsonResponse(String body) {
        return new MockResponse().setHeader("Content-Type", "application/json").setBody(body);
    }

    private static String chatResponse(String content) {
        return "{\"choices\":[{\"message\":{\"content\":\"" + content + "\"}}]}";
    }
}
