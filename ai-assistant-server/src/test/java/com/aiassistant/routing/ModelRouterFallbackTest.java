package com.aiassistant.routing;

import static org.junit.jupiter.api.Assertions.*;

import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 覆盖 {@link ModelRouter} 的 fallback chain 与 A/B test 边界行为；这些路径在原 {@code ModelRouterTest} 里未触达。
 *
 * <p>Provided by T3 coverage recovery wave.
 */
class ModelRouterFallbackTest {

    private ModelRouter router;

    @BeforeEach
    void setUp() {
        router = new ModelRouter("primary");
    }

    @Test
    @DisplayName("nextFallback：空 chain 时返回 null")
    void emptyChainReturnsNull() {
        assertNull(router.nextFallback("primary"));
        assertNull(router.nextFallback(null));
    }

    @Test
    @DisplayName("nextFallback：传入失败模型在 chain 内，返回下一个")
    void returnsNextWhenFailedModelInChain() {
        router.setFallbackChain(List.of("model-a", "model-b", "model-c"));
        assertEquals("model-b", router.nextFallback("model-a"));
        assertEquals("model-c", router.nextFallback("model-b"));
    }

    @Test
    @DisplayName("nextFallback：失败模型在 chain 末尾，返回 null（无下一个）")
    void returnsNullWhenFailedModelIsLast() {
        router.setFallbackChain(List.of("a", "b"));
        assertNull(router.nextFallback("b"));
    }

    @Test
    @DisplayName("nextFallback：失败模型不在 chain 中，返回第一个 fallback")
    void returnsFirstWhenFailedModelNotInChain() {
        router.setFallbackChain(List.of("a", "b"));
        assertEquals("a", router.nextFallback("unknown-primary"));
    }

    @Test
    @DisplayName("setFallbackChain：null 入参会清空 chain")
    void nullChainClearsExisting() {
        router.setFallbackChain(List.of("a", "b"));
        assertFalse(router.getFallbackChain().isEmpty());
        router.setFallbackChain(null);
        assertTrue(router.getFallbackChain().isEmpty());
    }

    @Test
    @DisplayName("getFallbackChain：返回不可变副本，外部修改不影响内部状态")
    void returnedFallbackChainIsImmutable() {
        router.setFallbackChain(List.of("a", "b"));
        List<String> snapshot = router.getFallbackChain();
        assertThrows(UnsupportedOperationException.class, () -> snapshot.add("c"));
        assertEquals(2, router.getFallbackChain().size());
    }

    @Test
    @DisplayName("configureABTest：percentA 自动 clamp 到 [0, 100]")
    void abTestPercentClampedToValidRange() {
        router.configureABTest("over", "a", "b", 150);
        assertEquals(100, router.getActiveABTests().get("over").percentA());

        router.configureABTest("under", "a", "b", -10);
        assertEquals(0, router.getActiveABTests().get("under").percentA());
    }

    @Test
    @DisplayName("A/B test percentA = 100：所有租户都路由到模型 A（A 组）")
    void abTestPercentA100AlwaysRoutesToA() {
        router.configureABTest("all-a", "model-a", "model-b", 100);
        for (int i = 0; i < 50; i++) {
            var decision = router.route("all-a", "tenant-" + i, 100);
            assertEquals("model-a", decision.modelId());
            assertEquals("A", decision.abGroup());
        }
    }

    @Test
    @DisplayName("A/B test percentA = 0：所有租户都路由到模型 B（B 组）")
    void abTestPercentA0AlwaysRoutesToB() {
        router.configureABTest("all-b", "model-a", "model-b", 0);
        for (int i = 0; i < 50; i++) {
            var decision = router.route("all-b", "tenant-" + i, 100);
            assertEquals("model-b", decision.modelId());
            assertEquals("B", decision.abGroup());
        }
    }

    @Test
    @DisplayName("getActiveABTests：返回不可变副本")
    void activeABTestsReturnsImmutableCopy() {
        router.configureABTest("t1", "a", "b", 50);
        var copy = router.getActiveABTests();
        assertThrows(
                UnsupportedOperationException.class,
                () -> copy.put("t2", new ModelRouter.ABTestConfig("t2", "x", "y", 30)));
    }

    @Test
    @DisplayName("cost optimization：tokens > 2000 但无 LIGHT 模型时回退到 default")
    void costOptimizationFallsBackToDefaultWithoutLightModel() {
        router.registerModel(
                new ModelRouter.ModelConfig(
                        "only-premium", ModelRouter.ModelTier.PREMIUM, 5.0, 8000));
        var decision = router.route("unknown_task", "u1", 5000);
        assertEquals("primary", decision.modelId());
        assertEquals("default", decision.reason());
    }
}
