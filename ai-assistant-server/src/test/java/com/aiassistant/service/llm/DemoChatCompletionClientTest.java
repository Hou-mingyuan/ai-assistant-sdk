package com.aiassistant.service.llm;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.List;
import org.junit.jupiter.api.Test;

class DemoChatCompletionClientTest {

    private final ObjectMapper mapper = new ObjectMapper();
    private final DemoChatCompletionClient client = new DemoChatCompletionClient();

    @Test
    void blockingResponseIsExplicitlyMarkedAndEchoesTheReceivedMessage() {
        String result = client.complete(request("hello demo"), null);

        assertTrue(result.startsWith(DemoChatCompletionClient.RESPONSE_MARKER));
        assertTrue(result.contains("hello demo"));
        assertTrue(result.contains("not real AI"));
    }

    @Test
    void streamingResponseUsesMultipleChunksAndMatchesBlockingResponse() {
        ObjectNode request = request("stream me");

        List<String> chunks = client.completeStream(request, null).collectList().block();

        assertTrue(chunks.size() >= 3);
        assertEquals(client.complete(request, null), String.join("", chunks));
    }

    @Test
    void extractsTextFromOpenAiMultimodalContent() {
        ObjectNode body = mapper.createObjectNode();
        var content = body.putArray("messages").addObject().put("role", "user").putArray("content");
        content.addObject().put("type", "text").put("text", "describe this image");
        content.addObject()
                .put("type", "image_url")
                .putObject("image_url")
                .put("url", "data:image/png;base64,ignored");

        assertTrue(client.complete(body, null).contains("describe this image"));
    }

    private ObjectNode request(String text) {
        ObjectNode body = mapper.createObjectNode();
        body.put("model", "demo-local");
        body.putArray("messages").addObject().put("role", "user").put("content", text);
        return body;
    }
}
