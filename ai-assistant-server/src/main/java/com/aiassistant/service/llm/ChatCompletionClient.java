package com.aiassistant.service.llm;

import com.fasterxml.jackson.databind.node.ObjectNode;
import reactor.core.publisher.Flux;

public interface ChatCompletionClient {

    String complete(ObjectNode requestBody, String apiKey);

    Flux<String> completeStream(ObjectNode requestBody, String apiKey);
}
