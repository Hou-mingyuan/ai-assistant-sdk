package com.aiassistant.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * 把 OpenAI 兼容 {@code /v1/chat/completions} 的非流式响应解析逻辑从 {@link LlmService} 抽出。
 *
 * <p>抽出的目的：
 *
 * <ul>
 *   <li>让 {@code LlmService} 把"调用 LLM"和"解释 LLM 返回的 JSON 结构"两个关注点分开；
 *   <li>方便后续 Pipeline 化重构（PromptComposer / RequestEnricher / <b>ResponseParser</b> /
 *       ResponsePostProcessor）落地；
 *   <li>方便单测验证 token usage 解析、content 提取的边界场景。
 * </ul>
 *
 * <p>当前抽出的两个方法行为与 {@code LlmService} 内原方法完全一致：
 *
 * <ul>
 *   <li>{@link #parseContent(String)} 取 {@code choices[0].message.content}；解析失败返回原始字符串。
 *   <li>{@link #parseUsage(String)} 取 {@code usage.prompt_tokens / completion_tokens}；解析失败返回 {@code
 *       [0, 0]}。
 * </ul>
 *
 * <p>该类不持有任何业务状态，可被多个 service 共享。
 */
public class OpenAiResponseParser {

    private static final Logger log = LoggerFactory.getLogger(OpenAiResponseParser.class);

    private final ObjectMapper objectMapper;

    public OpenAiResponseParser(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    /**
     * 从 OpenAI 兼容响应中提取 {@code choices[0].message.content}。
     *
     * <p>失败回退：解析异常时直接返回输入字符串，调用方继续走原始返回链路（与抽出前一致）。
     */
    public String parseContent(String raw) {
        if (raw == null) return null;
        try {
            JsonNode root = objectMapper.readTree(raw);
            JsonNode choices = root.path("choices");
            if (choices.isArray() && !choices.isEmpty()) {
                return choices.get(0).path("message").path("content").asText("");
            }
        } catch (Exception e) {
            log.debug("parseContent fallback to raw: {}", e.getMessage());
        }
        return raw;
    }

    /**
     * 从 OpenAI 兼容响应中提取 {@code usage} 字段，返回 {@code [promptTokens, completionTokens]}。
     *
     * <p>当响应不包含 {@code usage} 字段、或解析失败时返回 {@code [0, 0]}（不抛异常）。
     */
    public int[] parseUsage(String raw) {
        int[] counts = {0, 0};
        if (raw == null) return counts;
        try {
            JsonNode root = objectMapper.readTree(raw);
            JsonNode usage = root.path("usage");
            if (usage.isMissingNode()) return counts;
            counts[0] = usage.path("prompt_tokens").asInt(0);
            counts[1] = usage.path("completion_tokens").asInt(0);
        } catch (Exception e) {
            log.debug("parseUsage fallback to zeros: {}", e.getMessage());
        }
        return counts;
    }
}
