package com.aiassistant.controller;

import com.aiassistant.prompt.PromptTemplate;
import com.aiassistant.prompt.PromptTemplateRegistry;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * REST API for prompt template management: list, get, create, render.
 */
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
    public ResponseEntity<Map<String, String>> createTemplate(@RequestBody Map<String, Object> body) {
        String name = (String) body.get("name");
        String template = (String) body.get("template");
        if (name == null || template == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "name and template are required"));
        }

        @SuppressWarnings("unchecked")
        Map<String, String> defaults = (Map<String, String>) body.get("defaults");

        @SuppressWarnings("unchecked")
        List<Map<String, String>> examplesRaw = (List<Map<String, String>>) body.get("fewShotExamples");
        List<PromptTemplate.FewShotExample> examples = null;
        if (examplesRaw != null) {
            examples = examplesRaw.stream()
                    .map(m -> new PromptTemplate.FewShotExample(m.get("userInput"), m.get("assistantOutput")))
                    .toList();
        }

        registry.register(new PromptTemplate(name, template, defaults, examples));
        return ResponseEntity.ok(Map.of("name", name, "status", "registered"));
    }
}
