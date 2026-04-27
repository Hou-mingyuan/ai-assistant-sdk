package com.aiassistant.rag;

import com.aiassistant.config.AiAssistantProperties;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.reactive.function.client.WebClient;

import java.util.ArrayList;
import java.util.List;

/**
 * Calls the OpenAI-compatible /v1/embeddings endpoint.
 * Works with OpenAI, Azure OpenAI, and compatible providers (Ollama, vLLM, etc.).
 */
public class OpenAiEmbeddingProvider implements EmbeddingProvider {

    private static final Logger log = LoggerFactory.getLogger(OpenAiEmbeddingProvider.class);
    private final WebClient webClient;
    private final String model;
    private final ObjectMapper mapper = new ObjectMapper();
    private final int dims;

    public OpenAiEmbeddingProvider(AiAssistantProperties properties) {
        String baseUrl = properties.getBaseUrl();
        if (baseUrl == null || baseUrl.isBlank()) baseUrl = "https://api.openai.com";
        this.model = properties.getEmbeddingModel() != null ? properties.getEmbeddingModel() : "text-embedding-3-small";
        this.dims = properties.getEmbeddingDimensions() > 0 ? properties.getEmbeddingDimensions() : 1536;

        List<String> keys = properties.resolveApiKeys();
        String apiKey = keys.isEmpty() ? "" : keys.get(0);

        this.webClient = WebClient.builder()
                .baseUrl(baseUrl)
                .defaultHeader("Authorization", "Bearer " + apiKey)
                .defaultHeader("Content-Type", "application/json")
                .codecs(c -> c.defaultCodecs().maxInMemorySize(10 * 1024 * 1024))
                .build();

        log.info("OpenAiEmbeddingProvider initialized: model={}, dims={}, baseUrl={}", model, dims, baseUrl);
    }

    @Override
    public float[] embed(String text) {
        return embedBatch(List.of(text)).get(0);
    }

    @Override
    public List<float[]> embedBatch(List<String> texts) {
        try {
            ObjectNode body = mapper.createObjectNode();
            body.put("model", model);
            ArrayNode input = body.putArray("input");
            texts.forEach(input::add);

            String response = webClient.post()
                    .uri("/v1/embeddings")
                    .bodyValue(body.toString())
                    .retrieve()
                    .bodyToMono(String.class)
                    .block();

            JsonNode root = mapper.readTree(response);
            JsonNode dataNode = root.get("data");
            if (dataNode == null || !dataNode.isArray()) {
                throw new RuntimeException("Embedding API returned unexpected format: missing 'data' array");
            }
            ArrayNode data = (ArrayNode) dataNode;
            List<float[]> result = new ArrayList<>();
            for (JsonNode item : data) {
                JsonNode embeddingNode = item.get("embedding");
                if (embeddingNode == null || !embeddingNode.isArray()) {
                    throw new RuntimeException("Embedding API returned invalid item: missing 'embedding' array");
                }
                ArrayNode embedding = (ArrayNode) embeddingNode;
                float[] vec = new float[embedding.size()];
                for (int i = 0; i < embedding.size(); i++) {
                    vec[i] = (float) embedding.get(i).asDouble();
                }
                result.add(vec);
            }
            return result;
        } catch (Exception e) {
            log.error("Embedding API call failed: {}", e.getMessage());
            throw new RuntimeException("Embedding failed", e);
        }
    }

    @Override
    public int dimensions() {
        return dims;
    }
}
