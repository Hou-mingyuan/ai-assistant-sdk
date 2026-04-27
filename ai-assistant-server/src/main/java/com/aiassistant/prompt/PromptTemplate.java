package com.aiassistant.prompt;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Lightweight prompt template engine with variable interpolation and conditionals.
 *
 * Syntax:
 *   {{variable}}          - replaced with the variable value
 *   {{#if variable}}...{{/if}}  - block included only if variable is truthy
 *   {{#unless variable}}...{{/unless}} - block included only if variable is falsy
 *
 * Example:
 *   "你是{{role}}助手。{{#if industry}}你精通{{industry}}行业。{{/if}}"
 */
public class PromptTemplate {

    private static final Logger log = LoggerFactory.getLogger(PromptTemplate.class);
    private static final Pattern VAR_PATTERN = Pattern.compile("\\{\\{(\\w+)}}");
    private static final Pattern IF_PATTERN = Pattern.compile("\\{\\{#if (\\w+)}}(.*?)\\{\\{/if}}", Pattern.DOTALL);
    private static final Pattern UNLESS_PATTERN = Pattern.compile("\\{\\{#unless (\\w+)}}(.*?)\\{\\{/unless}}", Pattern.DOTALL);

    private final String name;
    private final String template;
    private final Map<String, String> defaults;
    private final List<FewShotExample> fewShotExamples;

    public PromptTemplate(String name, String template, Map<String, String> defaults,
                           List<FewShotExample> fewShotExamples) {
        this.name = name;
        this.template = template;
        this.defaults = defaults != null ? Map.copyOf(defaults) : Map.of();
        this.fewShotExamples = fewShotExamples != null ? List.copyOf(fewShotExamples) : List.of();
    }

    public PromptTemplate(String name, String template, Map<String, String> defaults) {
        this(name, template, defaults, null);
    }

    public PromptTemplate(String name, String template) {
        this(name, template, null, null);
    }

    public record FewShotExample(String userInput, String assistantOutput) {}

    /**
     * Render the template with the given variables.
     */
    public String render(Map<String, String> variables) {
        Map<String, String> merged = new HashMap<>(defaults);
        if (variables != null) merged.putAll(variables);

        String result = template;

        Matcher ifMatcher = IF_PATTERN.matcher(result);
        StringBuilder sb = new StringBuilder();
        while (ifMatcher.find()) {
            String varName = ifMatcher.group(1);
            String block = ifMatcher.group(2);
            String value = merged.get(varName);
            boolean truthy = value != null && !value.isBlank() && !"false".equalsIgnoreCase(value);
            ifMatcher.appendReplacement(sb, Matcher.quoteReplacement(truthy ? block : ""));
        }
        ifMatcher.appendTail(sb);
        result = sb.toString();

        Matcher unlessMatcher = UNLESS_PATTERN.matcher(result);
        sb = new StringBuilder();
        while (unlessMatcher.find()) {
            String varName = unlessMatcher.group(1);
            String block = unlessMatcher.group(2);
            String value = merged.get(varName);
            boolean falsy = value == null || value.isBlank() || "false".equalsIgnoreCase(value);
            unlessMatcher.appendReplacement(sb, Matcher.quoteReplacement(falsy ? block : ""));
        }
        unlessMatcher.appendTail(sb);
        result = sb.toString();

        Matcher varMatcher = VAR_PATTERN.matcher(result);
        sb = new StringBuilder();
        while (varMatcher.find()) {
            String varName = varMatcher.group(1);
            String value = merged.getOrDefault(varName, "");
            varMatcher.appendReplacement(sb, Matcher.quoteReplacement(value));
        }
        varMatcher.appendTail(sb);
        return sb.toString().trim();
    }

    public String render() {
        return render(null);
    }

    /**
     * Render with few-shot examples appended (if any).
     */
    public String renderWithExamples(Map<String, String> variables) {
        String base = render(variables);
        if (fewShotExamples.isEmpty()) return base;
        StringBuilder sb = new StringBuilder(base);
        sb.append("\n\n以下是示例：\n");
        for (int i = 0; i < fewShotExamples.size(); i++) {
            FewShotExample ex = fewShotExamples.get(i);
            sb.append("用户: ").append(ex.userInput()).append("\n");
            sb.append("助手: ").append(ex.assistantOutput()).append("\n");
            if (i < fewShotExamples.size() - 1) sb.append("\n");
        }
        return sb.toString().trim();
    }

    public String getName() { return name; }
    public String getTemplate() { return template; }
    public List<FewShotExample> getFewShotExamples() { return fewShotExamples; }
}
