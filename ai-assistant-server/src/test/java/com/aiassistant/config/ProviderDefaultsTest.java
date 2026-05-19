package com.aiassistant.config;

import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

/**
 * 覆盖 T2 新增的 {@link ProviderDefaults}：16 家内置 Provider 的 base-url / model 常量 + MiniMax VLM 地区推断 +
 * 显式覆盖 + 未知 provider 抛 IllegalArgumentException。
 *
 * <p>Provided by T3 coverage recovery wave.
 */
class ProviderDefaultsTest {

    @Nested
    @DisplayName("resolveBaseUrl")
    class ResolveBaseUrl {

        @ParameterizedTest(name = "{0} → {1}")
        @CsvSource({
            "openai,         https://api.openai.com/v1",
            "deepseek,       https://api.deepseek.com/v1",
            "tongyi,         https://dashscope.aliyuncs.com/compatible-mode/v1",
            "qwen,           https://dashscope.aliyuncs.com/compatible-mode/v1",
            "zhipu,          https://api.z.ai/api/paas/v4",
            "glm,            https://api.z.ai/api/paas/v4",
            "volcengine,     https://ark.cn-beijing.volces.com/api/v3",
            "doubao,         https://ark.cn-beijing.volces.com/api/v3",
            "minimax,        https://api.minimax.chat/v1",
            "kimi,           https://api.moonshot.cn/v1",
            "moonshot,       https://api.moonshot.cn/v1",
            "gemini,         https://generativelanguage.googleapis.com/v1beta/openai/",
            "google,         https://generativelanguage.googleapis.com/v1beta/openai/",
            "siliconflow,    https://api.siliconflow.cn/v1",
            "groq,           https://api.groq.com/openai/v1",
            "yi,             https://api.lingyiwanwu.com/v1",
            "lingyiwanwu,    https://api.lingyiwanwu.com/v1",
            "spark,          https://spark-api-open.xf-yun.com/v1",
            "xunfei,         https://spark-api-open.xf-yun.com/v1",
            "baichuan,       https://api.baichuan-ai.com/v1",
            "stepfun,        https://api.stepfun.com/v1",
            "hunyuan,        https://api.hunyuan.cloud.tencent.com/v1",
            "tencent,        https://api.hunyuan.cloud.tencent.com/v1",
            "ollama,         http://localhost:11434/v1"
        })
        void allBuiltInProviders_returnExpectedBaseUrl(String provider, String expected) {
            assertEquals(expected, ProviderDefaults.resolveBaseUrl(provider, null));
        }

        @Test
        @DisplayName("provider 大小写不敏感")
        void providerNameIsCaseInsensitive() {
            assertEquals(
                    "https://api.openai.com/v1", ProviderDefaults.resolveBaseUrl("OpenAI", null));
            assertEquals(
                    "https://api.openai.com/v1", ProviderDefaults.resolveBaseUrl("OPENAI", null));
        }

        @Test
        @DisplayName("显式 baseUrl 直接返回，不查表")
        void explicitBaseUrlOverridesProviderDefault() {
            assertEquals(
                    "https://my-proxy.local/v1",
                    ProviderDefaults.resolveBaseUrl("openai", "https://my-proxy.local/v1"));
        }

        @Test
        @DisplayName("显式 baseUrl 为空字符串或纯空白时不视为有效，仍走 provider 默认")
        void blankExplicitBaseUrlFallsBackToProviderDefault() {
            assertEquals(
                    "https://api.openai.com/v1", ProviderDefaults.resolveBaseUrl("openai", ""));
            assertEquals(
                    "https://api.openai.com/v1", ProviderDefaults.resolveBaseUrl("openai", "   "));
        }

        @Test
        @DisplayName("未知 provider 抛 IllegalArgumentException 且消息中含 provider 名")
        void unknownProviderThrows() {
            var ex =
                    assertThrows(
                            IllegalArgumentException.class,
                            () -> ProviderDefaults.resolveBaseUrl("nonexistent-llm", null));
            assertTrue(ex.getMessage().contains("nonexistent-llm"));
            assertTrue(ex.getMessage().contains("ai-assistant.base-url"));
        }
    }

    @Nested
    @DisplayName("resolveDefaultModel")
    class ResolveDefaultModel {

        @ParameterizedTest(name = "{0} → {1}")
        @CsvSource({
            "openai,         gpt-5.4-mini",
            "deepseek,       deepseek-v4-flash",
            "tongyi,         qwen3.5-plus",
            "qwen,           qwen3.5-plus",
            "zhipu,          glm-5.1",
            "glm,            glm-5.1",
            "volcengine,     doubao-seed-2-0-pro-260215",
            "doubao,         doubao-seed-2-0-pro-260215",
            "minimax,        MiniMax-M2.7",
            "kimi,           kimi-k2.6",
            "moonshot,       kimi-k2.6",
            "gemini,         gemini-3.1-pro-preview",
            "google,         gemini-3.1-pro-preview",
            "siliconflow,    deepseek-ai/DeepSeek-V3",
            "groq,           llama-3.3-70b-versatile",
            "yi,             yi-lightning",
            "lingyiwanwu,    yi-lightning",
            "spark,          generalv3.5",
            "xunfei,         generalv3.5",
            "baichuan,       Baichuan4",
            "stepfun,        step-2-16k",
            "hunyuan,        hunyuan-pro",
            "tencent,        hunyuan-pro",
            "ollama,         llama3"
        })
        void allBuiltInProviders_returnExpectedModel(String provider, String expected) {
            assertEquals(expected, ProviderDefaults.resolveDefaultModel(provider, null));
        }

        @Test
        @DisplayName("显式 model 直接返回，不查表")
        void explicitModelOverridesProviderDefault() {
            assertEquals(
                    "my-fine-tuned-model",
                    ProviderDefaults.resolveDefaultModel("openai", "my-fine-tuned-model"));
        }

        @Test
        @DisplayName("显式 model 为空白时回退到 provider 默认")
        void blankExplicitModelFallsBackToProviderDefault() {
            assertEquals("gpt-5.4-mini", ProviderDefaults.resolveDefaultModel("openai", ""));
            assertEquals("gpt-5.4-mini", ProviderDefaults.resolveDefaultModel("openai", "   "));
        }

        @Test
        @DisplayName("未知 provider 抛 IllegalArgumentException 且消息中含 provider 名")
        void unknownProviderThrows() {
            var ex =
                    assertThrows(
                            IllegalArgumentException.class,
                            () -> ProviderDefaults.resolveDefaultModel("future-llm", null));
            assertTrue(ex.getMessage().contains("future-llm"));
            assertTrue(ex.getMessage().contains("ai-assistant.model"));
        }
    }

    @Nested
    @DisplayName("resolveMinimaxVlmBaseUrl")
    class ResolveMinimaxVlmBaseUrl {

        @Test
        @DisplayName("显式 vlmBaseUrl 直接返回（去掉尾斜杠）")
        void explicitVlmBaseUrlStripsTrailingSlashes() {
            assertEquals(
                    "https://my-minimax.local/v1",
                    ProviderDefaults.resolveMinimaxVlmBaseUrl(
                            "https://my-minimax.local/v1//", null));
        }

        @Test
        @DisplayName("baseUrl 含 api.minimaxi.com → 国内端点")
        void detectsMainlandRegionFromBaseUrl() {
            assertEquals(
                    "https://api.minimaxi.com/v1",
                    ProviderDefaults.resolveMinimaxVlmBaseUrl(null, "https://api.minimaxi.com/v1"));
        }

        @Test
        @DisplayName("baseUrl 含 api.minimax.io → 国际端点")
        void detectsInternationalRegionFromBaseUrl() {
            assertEquals(
                    "https://api.minimax.io/v1",
                    ProviderDefaults.resolveMinimaxVlmBaseUrl(null, "https://api.minimax.io/v1"));
        }

        @Test
        @DisplayName("baseUrl 为空或 null 时默认返回国际端点")
        void defaultsToInternationalWhenBaseUrlMissing() {
            assertEquals(
                    "https://api.minimax.io/v1",
                    ProviderDefaults.resolveMinimaxVlmBaseUrl(null, null));
            assertEquals(
                    "https://api.minimax.io/v1",
                    ProviderDefaults.resolveMinimaxVlmBaseUrl(null, ""));
            assertEquals(
                    "https://api.minimax.io/v1",
                    ProviderDefaults.resolveMinimaxVlmBaseUrl(null, "   "));
        }

        @Test
        @DisplayName("显式 vlmBaseUrl 为空白时回退到 baseUrl 启发式")
        void blankExplicitVlmFallsBackToHeuristic() {
            assertEquals(
                    "https://api.minimaxi.com/v1",
                    ProviderDefaults.resolveMinimaxVlmBaseUrl(
                            "   ", "https://api.minimaxi.com/v1"));
        }
    }
}
