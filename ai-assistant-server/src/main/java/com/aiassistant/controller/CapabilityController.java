package com.aiassistant.controller;

import com.aiassistant.spi.AssistantCapability;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * Exposes assistant capabilities for discovery and invocation. Compatible with MCP tool discovery
 * patterns.
 */
@RestController
@RequestMapping("${ai-assistant.context-path:/ai-assistant}")
public class CapabilityController {

    private static final Logger log = LoggerFactory.getLogger(CapabilityController.class);
    private static final Pattern SAFE_CAPABILITY_NAME = Pattern.compile("[A-Za-z0-9_.:-]{1,80}");
    private final List<AssistantCapability> capabilities;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public CapabilityController(List<AssistantCapability> capabilities) {
        this.capabilities = capabilities != null ? capabilities : List.of();
    }

    @GetMapping("/capabilities")
    public ResponseEntity<String> listCapabilities() {
        ArrayNode arr = objectMapper.createArrayNode();
        for (AssistantCapability cap : capabilities) {
            ObjectNode node = arr.addObject();
            node.put("name", cap.name());
            node.put("description", cap.description());
            node.set("inputSchema", objectMapper.valueToTree(cap.inputSchema()));
            node.set("tags", objectMapper.valueToTree(cap.tags()));
        }
        return ResponseEntity.ok().contentType(MediaType.APPLICATION_JSON).body(arr.toString());
    }

    @PostMapping("/capabilities/{name}/invoke")
    public ResponseEntity<String> invokeCapability(
            @PathVariable String name, @RequestBody(required = false) Map<String, Object> params) {
        if (!isSafeCapabilityName(name)) {
            ObjectNode err = objectMapper.createObjectNode();
            err.put("error", "Invalid capability name");
            return ResponseEntity.badRequest()
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(err.toString());
        }
        AssistantCapability cap =
                capabilities.stream().filter(c -> c.name().equals(name)).findFirst().orElse(null);
        if (cap == null) {
            return ResponseEntity.notFound().build();
        }
        try {
            String result = cap.execute(params != null ? params : Map.of());
            ObjectNode resp = objectMapper.createObjectNode();
            resp.put("capability", name);
            resp.put("result", result);
            return ResponseEntity.ok()
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(resp.toString());
        } catch (Exception e) {
            log.error("Capability invocation failed: {} - {}", name, e.getMessage(), e);
            ObjectNode err = objectMapper.createObjectNode();
            err.put("error", "Capability invocation failed. Check server logs for details.");
            return ResponseEntity.internalServerError()
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(err.toString());
        }
    }

    private boolean isSafeCapabilityName(String name) {
        return name != null && SAFE_CAPABILITY_NAME.matcher(name).matches();
    }
}
