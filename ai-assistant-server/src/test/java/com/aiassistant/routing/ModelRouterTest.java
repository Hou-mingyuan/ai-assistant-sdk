package com.aiassistant.routing;

import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class ModelRouterTest {

    private ModelRouter router;

    @BeforeEach
    void setUp() {
        router = new ModelRouter("gpt-4o-mini");
        router.registerModel(
                new ModelRouter.ModelConfig(
                        "gpt-4o-mini", ModelRouter.ModelTier.LIGHT, 0.15, 128000));
        router.registerModel(
                new ModelRouter.ModelConfig("gpt-4o", ModelRouter.ModelTier.PREMIUM, 5.0, 128000));
    }

    @Test
    void defaultRouting_usesDefaultModel() {
        var decision = router.route("chat", "user1", 100);
        assertEquals("gpt-4o-mini", decision.modelId());
        assertEquals("default", decision.reason());
    }

    @Test
    void ruleRouting_usesConfiguredModel() {
        router.addRule(new ModelRouter.RoutingRule("translate", "gpt-4o"));
        var decision = router.route("translate", "user1", 100);
        assertEquals("gpt-4o", decision.modelId());
        assertTrue(decision.reason().startsWith("rule:"));
    }

    @Test
    void abTest_splitsByTenantHash() {
        router.configureABTest("chat", "gpt-4o-mini", "gpt-4o", 50);
        int countA = 0, countB = 0;
        for (int i = 0; i < 100; i++) {
            var decision = router.route("chat", "user" + i, 100);
            if ("A".equals(decision.abGroup())) countA++;
            else countB++;
        }
        assertTrue(countA > 10);
        assertTrue(countB > 10);
    }

    @Test
    void costOptimization_pickLightModel_forLargeTokens() {
        var decision = router.route("unknown_task", "user1", 5000);
        assertEquals("gpt-4o-mini", decision.modelId());
        assertEquals("cost_optimization", decision.reason());
    }

    @Test
    void activeABTests_returnsConfigured() {
        router.configureABTest("test1", "a", "b", 70);
        assertEquals(1, router.getActiveABTests().size());
        assertEquals(70, router.getActiveABTests().get("test1").percentA());
    }
}
