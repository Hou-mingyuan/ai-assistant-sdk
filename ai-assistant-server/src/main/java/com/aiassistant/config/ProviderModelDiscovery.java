package com.aiassistant.config;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.MissingNode;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

/** Provider-aware parser for upstream model discovery responses. */
class ProviderModelDiscovery {

    private final ObjectMapper mapper = new ObjectMapper();

    String modelsPath(String provider) {
        return "/models";
    }

    List<String> parseModels(String provider, String json) throws IOException {
        if (json == null || json.isBlank()) {
            return List.of();
        }
        JsonNode root = mapper.readTree(json);
        JsonNode list = findModelArray(root);
        if (!list.isArray()) {
            return List.of();
        }
        List<String> models = new ArrayList<>();
        for (JsonNode item : list) {
            String model = extractModelId(item);
            if (!model.isBlank()) {
                models.add(model);
            }
        }
        return models.stream().distinct().collect(Collectors.toList());
    }

    private static JsonNode findModelArray(JsonNode root) {
        if (root.isArray()) {
            return root;
        }
        JsonNode data = root.path("data");
        if (data.isArray()) {
            return data;
        }
        JsonNode models = root.path("models");
        if (models.isArray()) {
            return models;
        }
        return MissingNode.getInstance();
    }

    private static String extractModelId(JsonNode item) {
        if (item.isTextual()) {
            return item.asText("").trim();
        }
        String id = item.path("id").asText("").trim();
        if (!id.isBlank()) {
            return id;
        }
        String model = item.path("model").asText("").trim();
        if (!model.isBlank()) {
            return model;
        }
        return item.path("name").asText("").trim();
    }
}
