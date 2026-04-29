package com.aiassistant.prompt;

import java.util.Collections;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Central registry for prompt templates. Templates can be registered programmatically or loaded
 * from configuration.
 */
public class PromptTemplateRegistry {

    private static final Logger log = LoggerFactory.getLogger(PromptTemplateRegistry.class);
    private final Map<String, PromptTemplate> templates = new ConcurrentHashMap<>();

    public PromptTemplateRegistry() {
        registerDefaults();
    }

    public void register(PromptTemplate template) {
        templates.put(template.getName(), template);
        log.info("Registered prompt template: {}", template.getName());
    }

    public PromptTemplate get(String name) {
        return templates.get(name);
    }

    public Map<String, PromptTemplate> all() {
        return Collections.unmodifiableMap(templates);
    }

    public String render(String templateName, Map<String, String> variables) {
        PromptTemplate tpl = templates.get(templateName);
        if (tpl == null) {
            log.warn("Prompt template '{}' not found, returning empty", templateName);
            return "";
        }
        return tpl.render(variables);
    }

    private void registerDefaults() {
        register(
                new PromptTemplate(
                        "general",
                        "你是一个智能助手，名叫{{name}}。{{#if industry}}你精通{{industry}}行业知识。{{/if}}"
                                + "{{#if tone}}请用{{tone}}的语气回答。{{/if}}请用中文回答。",
                        Map.of("name", "AI助手")));

        register(
                new PromptTemplate(
                        "customer-service",
                        "你是{{company}}的客服助手。请礼貌、专业地回答客户问题。"
                                + "{{#if knowledge}}参考以下知识库信息：\n{{knowledge}}{{/if}}",
                        Map.of("company", "我们")));

        register(
                new PromptTemplate(
                        "data-analyst",
                        "你是数据分析助手。用户会询问关于{{domain}}的数据问题。"
                                + "请用清晰的结构化格式回答，必要时使用表格。"
                                + "{{#if constraints}}注意以下限制：{{constraints}}{{/if}}",
                        Map.of("domain", "业务数据")));

        register(
                new PromptTemplate(
                        "code-assistant",
                        "你是编程助手，精通{{languages}}。{{#if framework}}你熟悉{{framework}}框架。{{/if}}"
                                + "请提供简洁、可运行的代码示例。{{#unless verbose}}不要过多解释。{{/unless}}",
                        Map.of("languages", "Java, Python, JavaScript")));
    }
}
