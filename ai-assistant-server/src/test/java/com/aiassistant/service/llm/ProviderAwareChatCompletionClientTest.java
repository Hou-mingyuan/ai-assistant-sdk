package com.aiassistant.service.llm;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.aiassistant.config.AiAssistantProperties;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.io.IOException;
import okhttp3.mockwebserver.MockResponse;
import okhttp3.mockwebserver.MockWebServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

class ProviderAwareChatCompletionClientTest {

    private ProviderAwareChatCompletionClient client;
    private MockWebServer server;

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
    void runtimeProviderChangesSwitchBetweenDemoAndLiveTransports() throws Exception {
        server = new MockWebServer();
        server.start();

        AiAssistantProperties properties = new AiAssistantProperties();
        properties.setProvider("demo");
        properties.setBaseUrl(server.url("/v1").toString());
        properties.setLlmMaxRetries(0);
        client = new ProviderAwareChatCompletionClient(properties);

        ObjectNode request = request("hello");
        assertTrue(
                client.complete(request, null)
                        .startsWith(DemoChatCompletionClient.RESPONSE_MARKER));
        assertEquals(0, server.getRequestCount());

        server.enqueue(
                new MockResponse()
                        .setHeader("Content-Type", "application/json")
                        .setBody("{\"choices\":[{\"message\":{\"content\":\"live response\"}}]}"));
        properties.setProvider("openai");

        assertEquals("live response", client.complete(request, "live-key"));
        assertEquals("Bearer live-key", server.takeRequest().getHeader("Authorization"));
    }

    private static ObjectNode request(String text) {
        ObjectNode body = new ObjectMapper().createObjectNode();
        body.put("model", "demo-local");
        body.putArray("messages").addObject().put("role", "user").put("content", text);
        return body;
    }
}
