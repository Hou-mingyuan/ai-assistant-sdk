package com.aiassistant.config;

import static org.junit.jupiter.api.Assertions.*;

import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

/**
 * 覆盖 {@link AiAssistantProperties} 内部 nested static classes 的 setter 边界 与 flat delegation 兼容层。原版有
 * 500+ 行 flat delegation，每个 getter/setter 都需要被触达才能进 jacoco 报告，但大量分支从未被业务代码触发。
 *
 * <p>Provided by T3-Wave2 coverage recovery.
 */
class AiAssistantPropertiesNestedTest {

    @Nested
    @DisplayName("SessionStoreProperties setter clamping")
    class SessionStorePropertiesTest {
        @Test
        @DisplayName("maxSessionsPerUser ≥ 1")
        void maxSessionsClampedToAtLeastOne() {
            AiAssistantProperties.SessionStoreProperties s =
                    new AiAssistantProperties.SessionStoreProperties();
            s.setMaxSessionsPerUser(0);
            assertEquals(1, s.getMaxSessionsPerUser());
            s.setMaxSessionsPerUser(-100);
            assertEquals(1, s.getMaxSessionsPerUser());
            s.setMaxSessionsPerUser(99);
            assertEquals(99, s.getMaxSessionsPerUser());
        }

        @Test
        @DisplayName("maxUsers ≥ 1")
        void maxUsersClampedToAtLeastOne() {
            AiAssistantProperties.SessionStoreProperties s =
                    new AiAssistantProperties.SessionStoreProperties();
            s.setMaxUsers(0);
            assertEquals(1, s.getMaxUsers());
            s.setMaxUsers(-50);
            assertEquals(1, s.getMaxUsers());
            s.setMaxUsers(50_000);
            assertEquals(50_000, s.getMaxUsers());
        }

        @Test
        @DisplayName("maxMessagesPerSession ≥ 0（0 表示不限制）")
        void maxMessagesAllowsZero() {
            AiAssistantProperties.SessionStoreProperties s =
                    new AiAssistantProperties.SessionStoreProperties();
            s.setMaxMessagesPerSession(0);
            assertEquals(0, s.getMaxMessagesPerSession());
            s.setMaxMessagesPerSession(-1);
            assertEquals(0, s.getMaxMessagesPerSession());
            s.setMaxMessagesPerSession(500);
            assertEquals(500, s.getMaxMessagesPerSession());
        }
    }

    @Nested
    @DisplayName("ExportProperties setter clamping")
    class ExportPropertiesTest {
        @Test
        @DisplayName("maxImageUrls clamp 在 [0, 1024]")
        void maxImageUrlsClampedToRange() {
            AiAssistantProperties.ExportProperties e = new AiAssistantProperties.ExportProperties();
            e.setMaxImageUrls(-5);
            assertEquals(0, e.getMaxImageUrls());
            e.setMaxImageUrls(0);
            assertEquals(0, e.getMaxImageUrls());
            e.setMaxImageUrls(2048);
            assertEquals(1024, e.getMaxImageUrls());
            e.setMaxImageUrls(512);
            assertEquals(512, e.getMaxImageUrls());
        }
    }

    @Nested
    @DisplayName("AdminProperties.resolveAdminToken")
    class AdminPropertiesTest {
        @Test
        @DisplayName("adminToken 非空时直接返回，不 fallback")
        void explicitAdminTokenWins() {
            AiAssistantProperties.AdminProperties a = new AiAssistantProperties.AdminProperties();
            a.setAdminToken("admin-secret-123");
            assertEquals("admin-secret-123", a.resolveAdminToken("access-secret"));
            assertEquals("admin-secret-123", a.resolveAdminToken(null));
        }

        @Test
        @DisplayName("adminToken null/空 时 fallback 到 accessToken")
        void fallsBackToAccessToken() {
            AiAssistantProperties.AdminProperties a = new AiAssistantProperties.AdminProperties();
            assertEquals("access-secret", a.resolveAdminToken("access-secret"));
            a.setAdminToken("");
            assertEquals("access-secret", a.resolveAdminToken("access-secret"));
            a.setAdminToken("   ");
            assertEquals("access-secret", a.resolveAdminToken("access-secret"));
        }

        @Test
        @DisplayName("adminToken 与 fallback 都为 null 时返回 null（即未启用鉴权）")
        void bothNullReturnsNull() {
            AiAssistantProperties.AdminProperties a = new AiAssistantProperties.AdminProperties();
            assertNull(a.resolveAdminToken(null));
        }
    }

    @Nested
    @DisplayName("AiAssistantProperties.resolveApiKeys")
    class ApiKeysTest {
        @Test
        @DisplayName("apiKey + apiKeys 合并去重")
        void mergesPrimaryAndListWithoutDup() {
            AiAssistantProperties p = new AiAssistantProperties();
            p.setApiKey("k1");
            p.setApiKeys(java.util.List.of("k2", "k3", "k1"));
            var resolved = p.resolveApiKeys();
            assertEquals(3, resolved.size());
            assertEquals("k1", resolved.get(0));
            assertTrue(resolved.contains("k2"));
            assertTrue(resolved.contains("k3"));
        }

        @Test
        @DisplayName("仅 apiKey 一个时返回单元素列表")
        void singleKeyOnly() {
            AiAssistantProperties p = new AiAssistantProperties();
            p.setApiKey("only");
            var resolved = p.resolveApiKeys();
            assertEquals(1, resolved.size());
            assertEquals("only", resolved.get(0));
        }

        @Test
        @DisplayName("空白 key 被过滤")
        void blanksFiltered() {
            AiAssistantProperties p = new AiAssistantProperties();
            p.setApiKey("");
            p.setApiKeys(java.util.List.of("", "  ", "k1"));
            var resolved = p.resolveApiKeys();
            assertEquals(1, resolved.size());
            assertEquals("k1", resolved.get(0));
        }

        @Test
        @DisplayName("两者皆空返回空列表")
        void allEmptyReturnsEmpty() {
            AiAssistantProperties p = new AiAssistantProperties();
            assertTrue(p.resolveApiKeys().isEmpty());
        }
    }

    @Nested
    @DisplayName("AiAssistantProperties.resolveAllowedOrigins")
    class AllowedOriginsTest {
        @Test
        @DisplayName("默认值是 *")
        void defaultIsStar() {
            AiAssistantProperties p = new AiAssistantProperties();
            assertArrayEquals(new String[] {"*"}, p.resolveAllowedOrigins());
        }

        @Test
        @DisplayName("逗号分隔 + trim + 去重")
        void splitsTrimsDedupes() {
            AiAssistantProperties p = new AiAssistantProperties();
            p.getSecurity().setAllowedOrigins("https://a.com, https://b.com , https://a.com");
            String[] origins = p.resolveAllowedOrigins();
            assertEquals(2, origins.length);
            assertEquals("https://a.com", origins[0]);
            assertEquals("https://b.com", origins[1]);
        }

        @Test
        @DisplayName("空白结果回退为 *")
        void blankFallsBackToStar() {
            AiAssistantProperties p = new AiAssistantProperties();
            p.getSecurity().setAllowedOrigins("  , , ");
            assertArrayEquals(new String[] {"*"}, p.resolveAllowedOrigins());
        }
    }

    @Nested
    @DisplayName("AiAssistantProperties.resolveRateLimit")
    class RateLimitTest {
        @Test
        @DisplayName("有 per-action 时优先返回 action 对应值")
        void perActionTakesPriority() {
            AiAssistantProperties p = new AiAssistantProperties();
            p.getRateLimitConfig().setRequestsPerMinute(60);
            p.getRateLimitConfig().setPerAction(Map.of("export", 5, "stream", 30));
            assertEquals(5, p.resolveRateLimit("export"));
            assertEquals(30, p.resolveRateLimit("stream"));
        }

        @Test
        @DisplayName("per-action 缺失 action 时 fallback 到全局值")
        void fallsBackToGlobalWhenActionMissing() {
            AiAssistantProperties p = new AiAssistantProperties();
            p.getRateLimitConfig().setRequestsPerMinute(60);
            p.getRateLimitConfig().setPerAction(Map.of("chat", 100));
            assertEquals(60, p.resolveRateLimit("unknown_action"));
            assertEquals(60, p.resolveRateLimit(null));
        }

        @Test
        @DisplayName("per-action 值 ≤ 0 时不视为有效，fallback")
        void invalidPerActionValueFallsBack() {
            AiAssistantProperties p = new AiAssistantProperties();
            p.getRateLimitConfig().setRequestsPerMinute(60);
            p.getRateLimitConfig().setPerAction(Map.of("chat", 0));
            assertEquals(60, p.resolveRateLimit("chat"));
        }
    }

    @Nested
    @DisplayName("AiAssistantProperties.setContextPath 校验")
    class ContextPathTest {
        @Test
        @DisplayName("不以 / 开头自动补充")
        void prefixesSlashAutomatically() {
            AiAssistantProperties p = new AiAssistantProperties();
            p.setContextPath("ai-assistant");
            assertEquals("/ai-assistant", p.getContextPath());
        }

        @Test
        @DisplayName("移除尾部 /")
        void removesTrailingSlash() {
            AiAssistantProperties p = new AiAssistantProperties();
            p.setContextPath("/ai-assistant/");
            assertEquals("/ai-assistant", p.getContextPath());
        }

        @Test
        @DisplayName("空字符串抛 IllegalArgumentException")
        void blankThrows() {
            AiAssistantProperties p = new AiAssistantProperties();
            assertThrows(IllegalArgumentException.class, () -> p.setContextPath(""));
            assertThrows(IllegalArgumentException.class, () -> p.setContextPath("   "));
        }

        @Test
        @DisplayName("根路径 / 抛 IllegalArgumentException")
        void rootPathThrows() {
            AiAssistantProperties p = new AiAssistantProperties();
            assertThrows(IllegalArgumentException.class, () -> p.setContextPath("/"));
            assertThrows(IllegalArgumentException.class, () -> p.setContextPath("///"));
        }
    }

    @Nested
    @DisplayName("AiAssistantProperties.resolveEffectiveModel 白名单")
    class EffectiveModelTest {
        @Test
        @DisplayName("无白名单时始终返回默认 model")
        void noWhitelistAlwaysReturnsDefault() {
            AiAssistantProperties p = new AiAssistantProperties();
            p.setProvider("openai");
            assertEquals("gpt-5.4-mini", p.resolveEffectiveModel("custom-model"));
            assertEquals("gpt-5.4-mini", p.resolveEffectiveModel(null));
        }

        @Test
        @DisplayName("白名单包含请求 model 时返回该 model")
        void whitelistedRequestModelHonored() {
            AiAssistantProperties p = new AiAssistantProperties();
            p.setProvider("openai");
            p.setAllowedModels(java.util.List.of("gpt-5", "gpt-5-mini", "gpt-5.4-mini"));
            assertEquals("gpt-5", p.resolveEffectiveModel("gpt-5"));
            assertEquals("gpt-5-mini", p.resolveEffectiveModel("gpt-5-mini"));
        }

        @Test
        @DisplayName("请求 model 不在白名单时回退到默认")
        void nonWhitelistedFallsBackToDefault() {
            AiAssistantProperties p = new AiAssistantProperties();
            p.setProvider("openai");
            p.setAllowedModels(java.util.List.of("gpt-5", "gpt-5-mini"));
            assertEquals("gpt-5.4-mini", p.resolveEffectiveModel("malicious-fine-tuned"));
        }

        @Test
        @DisplayName("请求 model 为 null/空白时回退到默认")
        void nullRequestModelReturnsDefault() {
            AiAssistantProperties p = new AiAssistantProperties();
            p.setProvider("openai");
            p.setAllowedModels(java.util.List.of("gpt-5"));
            assertEquals("gpt-5.4-mini", p.resolveEffectiveModel(null));
            assertEquals("gpt-5.4-mini", p.resolveEffectiveModel(""));
            assertEquals("gpt-5.4-mini", p.resolveEffectiveModel("  "));
        }
    }

    @Nested
    @DisplayName("AiAssistantProperties.listModelsForClient")
    class ListModelsTest {
        @Test
        @DisplayName("无白名单时仅返回默认 model 一条")
        void noWhitelistReturnsSingleDefault() {
            AiAssistantProperties p = new AiAssistantProperties();
            p.setProvider("openai");
            var models = p.listModelsForClient();
            assertEquals(1, models.size());
            assertEquals("gpt-5.4-mini", models.get(0));
        }

        @Test
        @DisplayName("有白名单时去重 + trim 后返回")
        void whitelistedReturnsTrimmedDeduped() {
            AiAssistantProperties p = new AiAssistantProperties();
            p.setAllowedModels(java.util.List.of("gpt-5", " gpt-5-mini ", "gpt-5"));
            var models = p.listModelsForClient();
            assertEquals(2, models.size());
            assertTrue(models.contains("gpt-5"));
            assertTrue(models.contains("gpt-5-mini"));
        }

        @Test
        @DisplayName("二次调用命中缓存（cachedClientModels）")
        void secondCallUsesCacheUntilModelChanges() {
            AiAssistantProperties p = new AiAssistantProperties();
            p.setProvider("openai");
            p.setAllowedModels(java.util.List.of("a", "b"));
            var first = p.listModelsForClient();
            var second = p.listModelsForClient();
            assertSame(first, second);

            p.setModel("explicit-default");
            var third = p.listModelsForClient();
            assertNotSame(first, third);
        }
    }
}
