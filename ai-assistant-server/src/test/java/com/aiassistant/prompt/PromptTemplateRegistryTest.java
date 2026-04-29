package com.aiassistant.prompt;

import static org.junit.jupiter.api.Assertions.*;

import java.util.Map;
import org.junit.jupiter.api.Test;

class PromptTemplateRegistryTest {

    @Test
    void defaultTemplates_areRegistered() {
        var registry = new PromptTemplateRegistry();
        assertNotNull(registry.get("general"));
        assertNotNull(registry.get("customer-service"));
        assertNotNull(registry.get("data-analyst"));
        assertNotNull(registry.get("code-assistant"));
        assertEquals(4, registry.all().size());
    }

    @Test
    void register_addsNewTemplate() {
        var registry = new PromptTemplateRegistry();
        registry.register(new PromptTemplate("custom", "Hello {{name}}!"));
        assertNotNull(registry.get("custom"));
        assertEquals(5, registry.all().size());
    }

    @Test
    void register_overridesExisting() {
        var registry = new PromptTemplateRegistry();
        registry.register(new PromptTemplate("general", "New template"));
        assertEquals("New template", registry.get("general").getTemplate());
    }

    @Test
    void render_withValidTemplate() {
        var registry = new PromptTemplateRegistry();
        String result = registry.render("general", Map.of("name", "小明", "industry", "金融"));
        assertTrue(result.contains("小明"));
        assertTrue(result.contains("金融"));
    }

    @Test
    void render_withMissingTemplate_returnsEmpty() {
        var registry = new PromptTemplateRegistry();
        assertEquals("", registry.render("nonexistent", Map.of()));
    }

    @Test
    void generalTemplate_conditionalIndustry() {
        var registry = new PromptTemplateRegistry();
        String withIndustry = registry.render("general", Map.of("industry", "医疗"));
        assertTrue(withIndustry.contains("医疗"));
        String withoutIndustry = registry.render("general", Map.of());
        assertFalse(withoutIndustry.contains("精通"));
    }

    @Test
    void codeAssistant_unlessVerbose() {
        var registry = new PromptTemplateRegistry();
        String brief = registry.render("code-assistant", Map.of());
        assertTrue(brief.contains("不要过多解释"));
        String verbose = registry.render("code-assistant", Map.of("verbose", "true"));
        assertFalse(verbose.contains("不要过多解释"));
    }

    @Test
    void all_returnsUnmodifiable() {
        var registry = new PromptTemplateRegistry();
        assertThrows(
                UnsupportedOperationException.class,
                () -> registry.all().put("hack", new PromptTemplate("hack", "bad")));
    }
}
