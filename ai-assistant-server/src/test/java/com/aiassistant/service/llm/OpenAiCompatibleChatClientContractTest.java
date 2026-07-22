package com.aiassistant.service.llm;

import com.aiassistant.config.AiAssistantProperties;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import okhttp3.mockwebserver.MockWebServer;

/**
 * Contract test for {@link OpenAiCompatibleChatClient}.
 *
 * <p>Inherits every test from {@link ChatCompletionClientContract}; the only thing this class
 * provides is "how to instantiate this particular client and how to shape a minimal request body
 * for its wire format".
 *
 * <p>When you add a new {@link ChatCompletionClient} implementation, add a parallel
 * <em>YourClientContractTest</em> here in the same package, extend {@link
 * ChatCompletionClientContract}, and you get the same negative / edge battery for free.
 */
class OpenAiCompatibleChatClientContractTest extends ChatCompletionClientContract {

    private OpenAiCompatibleChatClient openAiClient;

    @Override
    protected ChatCompletionClient newClient(MockWebServer server) {
        AiAssistantProperties properties = new AiAssistantProperties();
        properties.setBaseUrl(server.url("/v1").toString());
        // Keep failure tests bounded without making Reactor/Netty cold startup flaky on Windows CI.
        properties.setTimeoutSeconds(5);
        properties.setLlmMaxRetries(0);
        properties.setChatMaxTotalChars(16_000);

        openAiClient = new OpenAiCompatibleChatClient(properties);
        return openAiClient;
    }

    @Override
    protected ObjectNode newRequestBody() {
        ObjectNode body = mapper.createObjectNode();
        body.put("model", "demo-model");
        ArrayNode messages = body.putArray("messages");
        ObjectNode userMessage = messages.addObject();
        userMessage.put("role", "user");
        userMessage.put("content", "ping");
        return body;
    }

    @Override
    protected void teardownClient() {
        if (openAiClient != null) {
            openAiClient.destroy();
        }
    }
}
