package com.aiassistant.prompt;

import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class PromptTemplateTest {

    @Test
    void render_replacesVariables() {
        var tpl = new PromptTemplate("test", "Hello {{name}}, you are {{role}}.");
        String result = tpl.render(Map.of("name", "Alice", "role", "admin"));
        assertEquals("Hello Alice, you are admin.", result);
    }

    @Test
    void render_usesDefaults() {
        var tpl = new PromptTemplate("test", "Hello {{name}}.", Map.of("name", "World"));
        assertEquals("Hello World.", tpl.render());
    }

    @Test
    void render_overridesDefaults() {
        var tpl = new PromptTemplate("test", "Hello {{name}}.", Map.of("name", "World"));
        assertEquals("Hello Alice.", tpl.render(Map.of("name", "Alice")));
    }

    @Test
    void render_ifBlock_included_whenTruthy() {
        var tpl = new PromptTemplate("test", "Start.{{#if extra}} Extra info here.{{/if}} End.");
        String result = tpl.render(Map.of("extra", "yes"));
        assertTrue(result.contains("Extra info here."));
    }

    @Test
    void render_ifBlock_excluded_whenFalsy() {
        var tpl = new PromptTemplate("test", "Start.{{#if extra}} Extra info here.{{/if}} End.");
        String result = tpl.render(Map.of());
        assertFalse(result.contains("Extra info here."));
    }

    @Test
    void render_unlessBlock_included_whenFalsy() {
        var tpl = new PromptTemplate("test", "{{#unless verbose}}Be brief.{{/unless}}");
        String result = tpl.render(Map.of());
        assertTrue(result.contains("Be brief."));
    }

    @Test
    void render_unlessBlock_excluded_whenTruthy() {
        var tpl = new PromptTemplate("test", "{{#unless verbose}}Be brief.{{/unless}}");
        String result = tpl.render(Map.of("verbose", "true"));
        assertFalse(result.contains("Be brief."));
    }

    @Test
    void render_missingVariable_becomesEmpty() {
        var tpl = new PromptTemplate("test", "Hello {{name}}!");
        assertEquals("Hello !", tpl.render(Map.of()));
    }
}
