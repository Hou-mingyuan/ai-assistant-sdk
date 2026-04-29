package com.aiassistant.controller;

import com.aiassistant.prompt.PromptTemplate;
import com.aiassistant.prompt.PromptTemplateRegistry;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.List;
import java.util.Map;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/** REST API for prompt template management: list, get, create, render. */
@RestController
@RequestMapping("${ai-assistant.context-path:/ai-assistant}")
public class PromptTemplateController {

    private final PromptTemplateRegistry registry;
    private final ObjectMapper mapper = new ObjectMapper();

    public PromptTemplateController(PromptTemplateRegistry registry) {
        this.registry = registry;
    }

    @GetMapping("/templates")
    public ResponseEntity<String> listTemplates() {
        ArrayNode arr = mapper.createArrayNode();
        for (Map.Entry<String, PromptTemplate> entry : registry.all().entrySet()) {
            ObjectNode node = arr.addObject();
            node.put("name", entry.getKey());
            node.put("template", entry.getValue().getTemplate());
            node.put("hasFewShot", !entry.getValue().getFewShotExamples().isEmpty());
        }
        return ResponseEntity.ok().contentType(MediaType.APPLICATION_JSON).body(arr.toString());
    }

    @PostMapping("/templates/{name}/render")
    public ResponseEntity<Map<String, String>> renderTemplate(
            @PathVariable String name,
            @RequestBody(required = false) Map<String, String> variables) {
        PromptTemplate tpl = registry.get(name);
        if (tpl == null) {
            return ResponseEntity.notFound().build();
        }
        String rendered = tpl.renderWithExamples(variables);
        return ResponseEntity.ok(Map.of("name", name, "rendered", rendered));
    }

    @PostMapping("/templates")
    public ResponseEntity<Map<String, String>> createTemplate(
            @RequestBody Map<String, Object> body) {
        Object rawName = body.get("name");
        Object rawTemplate = body.get("template");
        if (!(rawName instanceof String name) || !(rawTemplate instanceof String template)) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "name and template are required and must be strings"));
        }

        Map<String, String> defaults = null;
        Object rawDefaults = body.get("defaults");
        if (rawDefaults instanceof Map<?, ?> defMap) {
            defaults = new java.util.LinkedHashMap<>();
            for (Map.Entry<?, ?> e : defMap.entrySet()) {
                if (e.getKey() instanceof String k && e.getValue() instanceof String v) {
                    defaults.put(k, v);
                }
            }
        }

        List<PromptTemplate.FewShotExample> examples = null;
        Object rawExamples = body.get("fewShotExamples");
        if (rawExamples instanceof List<?> exList) {
            examples =
                    exList.stream()
                            .filter(Map.class::isInstance)
                            .map(
                                    m -> {
                                        @SuppressWarnings("unchecked")
                                        Map<String, Object> map = (Map<String, Object>) m;
                                        String userInput =
                                                map.get("userInput") instanceof String s ? s : "";
                                        String assistantOutput =
                                                map.get("assistantOutput") instanceof String s
                                                        ? s
                                                        : "";
                                        return new PromptTemplate.FewShotExample(
                                                userInput, assistantOutput);
                                    })
                            .toList();
        }

        registry.register(new PromptTemplate(name, template, defaults, examples));
        return ResponseEntity.ok(Map.of("name", name, "status", "registered"));
    }
}
