package com.aiassistant.controller;

import com.aiassistant.spi.AssistantCapability;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class CapabilityControllerTest {

    private final ObjectMapper om = new ObjectMapper();

    private AssistantCapability dummyCap(String name) {
        return new AssistantCapability() {
            @Override public String name() { return name; }
            @Override public String description() { return name + " desc"; }
            @Override public Map<String, Object> inputSchema() { return Map.of("type", "object"); }
            @Override public String execute(Map<String, Object> params) { return "result:" + params; }
            @Override public List<String> tags() { return List.of("test"); }
        };
    }

    @Test
    void listCapabilities_returnsAllRegistered() throws Exception {
        var controller = new CapabilityController(List.of(dummyCap("a"), dummyCap("b")));
        ResponseEntity<String> resp = controller.listCapabilities();
        assertEquals(200, resp.getStatusCode().value());
        JsonNode arr = om.readTree(resp.getBody());
        assertTrue(arr.isArray());
        assertEquals(2, arr.size());
        assertEquals("a", arr.get(0).get("name").asText());
        assertEquals("b", arr.get(1).get("name").asText());
    }

    @Test
    void listCapabilities_emptyWhenNoCapabilities() throws Exception {
        var controller = new CapabilityController(List.of());
        ResponseEntity<String> resp = controller.listCapabilities();
        assertEquals(200, resp.getStatusCode().value());
        JsonNode arr = om.readTree(resp.getBody());
        assertEquals(0, arr.size());
    }

    @Test
    void listCapabilities_nullSafe() throws Exception {
        var controller = new CapabilityController(null);
        ResponseEntity<String> resp = controller.listCapabilities();
        assertEquals(200, resp.getStatusCode().value());
        JsonNode arr = om.readTree(resp.getBody());
        assertEquals(0, arr.size());
    }

    @Test
    void invokeCapability_success() throws Exception {
        var controller = new CapabilityController(List.of(dummyCap("echo")));
        ResponseEntity<String> resp = controller.invokeCapability("echo", Map.of("k", "v"));
        assertEquals(200, resp.getStatusCode().value());
        JsonNode body = om.readTree(resp.getBody());
        assertEquals("echo", body.get("capability").asText());
        assertTrue(body.get("result").asText().contains("k=v"));
    }

    @Test
    void invokeCapability_notFound() {
        var controller = new CapabilityController(List.of(dummyCap("x")));
        ResponseEntity<String> resp = controller.invokeCapability("nonexistent", Map.of());
        assertEquals(404, resp.getStatusCode().value());
    }

    @Test
    void invokeCapability_rejectsInvalidName() {
        var controller = new CapabilityController(List.of(dummyCap("echo")));
        ResponseEntity<String> resp = controller.invokeCapability("../echo", Map.of());
        assertEquals(400, resp.getStatusCode().value());
        assertTrue(resp.getBody().contains("Invalid capability name"));
    }

    @Test
    void invokeCapability_rejectsOverlongName() {
        var controller = new CapabilityController(List.of(dummyCap("echo")));
        ResponseEntity<String> resp = controller.invokeCapability("a".repeat(81), Map.of());
        assertEquals(400, resp.getStatusCode().value());
    }

    @Test
    void invokeCapability_nullParams_treatedAsEmpty() throws Exception {
        var controller = new CapabilityController(List.of(dummyCap("test")));
        ResponseEntity<String> resp = controller.invokeCapability("test", null);
        assertEquals(200, resp.getStatusCode().value());
    }

    @Test
    void invokeCapability_executionError_returns500() {
        AssistantCapability failCap = new AssistantCapability() {
            @Override public String name() { return "fail"; }
            @Override public String description() { return "always fails"; }
            @Override public Map<String, Object> inputSchema() { return Map.of(); }
            @Override public String execute(Map<String, Object> params) throws Exception {
                throw new RuntimeException("boom");
            }
        };
        var controller = new CapabilityController(List.of(failCap));
        ResponseEntity<String> resp = controller.invokeCapability("fail", Map.of());
        assertEquals(500, resp.getStatusCode().value());
        assertTrue(resp.getBody().contains("Capability invocation failed"));
    }

    @Test
    void listCapabilities_includesTags() throws Exception {
        var controller = new CapabilityController(List.of(dummyCap("tagged")));
        ResponseEntity<String> resp = controller.listCapabilities();
        JsonNode arr = om.readTree(resp.getBody());
        JsonNode tags = arr.get(0).get("tags");
        assertTrue(tags.isArray());
        assertEquals("test", tags.get(0).asText());
    }

    @Test
    void listCapabilities_includesInputSchema() throws Exception {
        var controller = new CapabilityController(List.of(dummyCap("s")));
        ResponseEntity<String> resp = controller.listCapabilities();
        JsonNode arr = om.readTree(resp.getBody());
        JsonNode schema = arr.get(0).get("inputSchema");
        assertEquals("object", schema.get("type").asText());
    }
}
