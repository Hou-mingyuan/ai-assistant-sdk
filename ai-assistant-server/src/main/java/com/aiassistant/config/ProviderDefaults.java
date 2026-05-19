package com.aiassistant.config;

import java.util.Locale;

/**
 * 内置 LLM Provider 的默认 base-url / 默认 model / MiniMax VLM 端点的查表常量集合。
 *
 * <p>Refactor (T2)：从 {@link AiAssistantProperties} 抽出。原本两个 ~50 行的 switch 表达式（{@link
 * AiAssistantProperties#resolveBaseUrl()} / {@link AiAssistantProperties#resolveModel()}）整合到本工具类。
 *
 * <p>新增 Provider 时：
 *
 * <ol>
 *   <li>在 {@link #resolveBaseUrl(String, String)} 的 switch 中追加 base-url；
 *   <li>在 {@link #resolveDefaultModel(String, String)} 的 switch 中追加默认 model；
 *   <li>对应文档：{@code docs/guide/configuration.md} 的"内置 Provider 列表"段落。
 * </ol>
 *
 * <p>本类不应该被任何业务代码直接调用——业务方应继续使用 {@code properties.resolveBaseUrl()} / {@code
 * properties.resolveModel()}，以便 baseUrl/model 的显式覆盖逻辑生效。
 */
public final class ProviderDefaults {

    private ProviderDefaults() {}

    /**
     * 给 Provider 名称返回 OpenAI 兼容 base URL；当未知 provider 时抛 {@link IllegalArgumentException}。
     *
     * @param provider 配置中的 {@code ai-assistant.provider}（不区分大小写）
     * @param explicitBaseUrl 用户显式配置的 {@code ai-assistant.base-url}；非空时直接返回
     */
    public static String resolveBaseUrl(String provider, String explicitBaseUrl) {
        if (explicitBaseUrl != null && !explicitBaseUrl.isBlank()) return explicitBaseUrl;
        return switch (provider.toLowerCase(Locale.ROOT)) {
            case "openai" -> "https://api.openai.com/v1";
            case "deepseek" -> "https://api.deepseek.com/v1";
            case "tongyi", "qwen" -> "https://dashscope.aliyuncs.com/compatible-mode/v1";
            case "zhipu", "glm" -> "https://api.z.ai/api/paas/v4";
            case "volcengine", "doubao" -> "https://ark.cn-beijing.volces.com/api/v3";
            case "minimax" -> "https://api.minimax.chat/v1";
            case "kimi", "moonshot" -> "https://api.moonshot.cn/v1";
            case "gemini", "google" -> "https://generativelanguage.googleapis.com/v1beta/openai/";
            case "siliconflow" -> "https://api.siliconflow.cn/v1";
            case "groq" -> "https://api.groq.com/openai/v1";
            case "yi", "lingyiwanwu" -> "https://api.lingyiwanwu.com/v1";
            case "spark", "xunfei" -> "https://spark-api-open.xf-yun.com/v1";
            case "baichuan" -> "https://api.baichuan-ai.com/v1";
            case "stepfun" -> "https://api.stepfun.com/v1";
            case "hunyuan", "tencent" -> "https://api.hunyuan.cloud.tencent.com/v1";
            case "ollama" -> "http://localhost:11434/v1";
            default ->
                    throw new IllegalArgumentException(
                            "Unknown provider: "
                                    + provider
                                    + ". Please set ai-assistant.base-url explicitly.");
        };
    }

    /**
     * 给 Provider 名称返回默认 model id；当未知 provider 时抛 {@link IllegalArgumentException}。
     *
     * @param provider 配置中的 {@code ai-assistant.provider}（不区分大小写）
     * @param explicitModel 用户显式配置的 {@code ai-assistant.model}；非空时直接返回
     */
    public static String resolveDefaultModel(String provider, String explicitModel) {
        if (explicitModel != null && !explicitModel.isBlank()) return explicitModel;
        return switch (provider.toLowerCase(Locale.ROOT)) {
            case "openai" -> "gpt-5.4-mini";
            case "deepseek" -> "deepseek-v4-flash";
            case "tongyi", "qwen" -> "qwen3.5-plus";
            case "zhipu", "glm" -> "glm-5.1";
            case "volcengine", "doubao" -> "doubao-seed-2-0-pro-260215";
            case "minimax" -> "MiniMax-M2.7";
            case "kimi", "moonshot" -> "kimi-k2.6";
            case "gemini", "google" -> "gemini-3.1-pro-preview";
            case "siliconflow" -> "deepseek-ai/DeepSeek-V3";
            case "groq" -> "llama-3.3-70b-versatile";
            case "yi", "lingyiwanwu" -> "yi-lightning";
            case "spark", "xunfei" -> "generalv3.5";
            case "baichuan" -> "Baichuan4";
            case "stepfun" -> "step-2-16k";
            case "hunyuan", "tencent" -> "hunyuan-pro";
            case "ollama" -> "llama3";
            default ->
                    throw new IllegalArgumentException(
                            "Unknown provider: "
                                    + provider
                                    + ". Please set ai-assistant.model explicitly.");
        };
    }

    /**
     * MiniMax 有两套地区端点（国际 / 国内）+ 独立的 Coding Plan VLM 域；这里按 base-url 启发式推断。
     *
     * @param explicitVlmBaseUrl 用户显式配置的 {@code ai-assistant.minimax-vlm-base-url}；非空时直接返回（去除尾斜杠）
     * @param baseUrl 通用 base-url（用于推断地区）
     */
    public static String resolveMinimaxVlmBaseUrl(String explicitVlmBaseUrl, String baseUrl) {
        if (explicitVlmBaseUrl != null && !explicitVlmBaseUrl.isBlank()) {
            return trimTrailingSlash(explicitVlmBaseUrl);
        }
        String base = baseUrl == null ? "" : baseUrl.trim();
        if (base.contains("api.minimaxi.com")) return "https://api.minimaxi.com/v1";
        if (base.contains("api.minimax.io")) return "https://api.minimax.io/v1";
        return "https://api.minimax.io/v1";
    }

    private static String trimTrailingSlash(String value) {
        String normalized = value.trim();
        while (normalized.endsWith("/")) {
            normalized = normalized.substring(0, normalized.length() - 1);
        }
        return normalized;
    }
}
