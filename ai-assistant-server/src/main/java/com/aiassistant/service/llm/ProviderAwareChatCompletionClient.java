package com.aiassistant.service.llm;

import com.aiassistant.config.AiAssistantProperties;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.beans.factory.DisposableBean;
import reactor.core.publisher.Flux;

/** Default client that selects the explicit local demo or live OpenAI-compatible transport. */
public final class ProviderAwareChatCompletionClient
        implements ChatCompletionClient, DisposableBean {

    private final AiAssistantProperties properties;
    private final DemoChatCompletionClient demoClient;
    private final OpenAiCompatibleChatClient liveClient;

    public ProviderAwareChatCompletionClient(AiAssistantProperties properties) {
        this.properties = properties;
        this.demoClient = new DemoChatCompletionClient();
        this.liveClient = new OpenAiCompatibleChatClient(properties);
    }

    @Override
    public String complete(ObjectNode requestBody, String apiKey) {
        return delegate().complete(requestBody, apiKey);
    }

    @Override
    public String completeRaw(ObjectNode requestBody, String apiKey) {
        return delegate().completeRaw(requestBody, apiKey);
    }

    @Override
    public Flux<String> completeStream(ObjectNode requestBody, String apiKey) {
        return delegate().completeStream(requestBody, apiKey);
    }

    @Override
    public void destroy() {
        liveClient.destroy();
    }

    private ChatCompletionClient delegate() {
        return properties.isDemoProvider() ? demoClient : liveClient;
    }
}
