package com.aiassistant.routing;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Intelligent model router that selects the optimal model based on
 * task type, complexity, cost constraints, and A/B test assignments.
 */
public class ModelRouter {

    private static final Logger log = LoggerFactory.getLogger(ModelRouter.class);

    private final Map<String, ModelConfig> models = new ConcurrentHashMap<>();
    private final Map<String, RoutingRule> rules = new ConcurrentHashMap<>();
    private final Map<String, ABTestConfig> abTests = new ConcurrentHashMap<>();
    private String defaultModel;

    public ModelRouter(String defaultModel) {
        this.defaultModel = defaultModel;
    }

    public void registerModel(ModelConfig config) {
        models.put(config.modelId(), config);
        log.info("Registered model: {} (tier={}, costPer1k={})", config.modelId(), config.tier(), config.costPer1kTokens());
    }

    public void addRule(RoutingRule rule) {
        rules.put(rule.taskType(), rule);
    }

    /**
     * Configure an A/B test: split traffic between two models.
     */
    public void configureABTest(String testName, String modelA, String modelB, int percentA) {
        abTests.put(testName, new ABTestConfig(testName, modelA, modelB, Math.max(0, Math.min(100, percentA))));
        log.info("A/B test configured: {} → {}({}%) vs {}({}%)", testName, modelA, percentA, modelB, 100 - percentA);
    }

    /**
     * Route to the best model for the given context.
     */
    public RoutingDecision route(String taskType, String tenantId, int estimatedTokens) {
        ABTestConfig abTest = abTests.get(taskType);
        if (abTest != null) {
            int hash = Math.abs((tenantId + taskType).hashCode()) % 100;
            String selected = hash < abTest.percentA() ? abTest.modelA() : abTest.modelB();
            return new RoutingDecision(selected, "ab_test:" + abTest.testName(),
                    hash < abTest.percentA() ? "A" : "B");
        }

        RoutingRule rule = rules.get(taskType);
        if (rule != null) {
            return new RoutingDecision(rule.modelId(), "rule:" + taskType, null);
        }

        if (estimatedTokens > 2000) {
            Optional<ModelConfig> costEfficient = models.values().stream()
                    .filter(m -> m.tier() == ModelTier.LIGHT)
                    .min(Comparator.comparingDouble(ModelConfig::costPer1kTokens));
            if (costEfficient.isPresent()) {
                return new RoutingDecision(costEfficient.get().modelId(), "cost_optimization", null);
            }
        }

        return new RoutingDecision(defaultModel, "default", null);
    }

    private final List<String> fallbackChain = new java.util.concurrent.CopyOnWriteArrayList<>();

    /**
     * Configure a fallback chain: when the primary model fails, try each in order.
     * @param modelIds ordered list of model IDs to try on failure
     */
    public void setFallbackChain(List<String> modelIds) {
        fallbackChain.clear();
        if (modelIds != null) {
            fallbackChain.addAll(modelIds);
        }
        log.info("Fallback chain configured: {}", fallbackChain);
    }

    /**
     * Get the next fallback model after the given model fails.
     * @return next model ID, or null if no more fallbacks
     */
    public String nextFallback(String failedModelId) {
        if (fallbackChain.isEmpty()) return null;
        int idx = fallbackChain.indexOf(failedModelId);
        if (idx < 0) {
            return fallbackChain.isEmpty() ? null : fallbackChain.get(0);
        }
        int next = idx + 1;
        return next < fallbackChain.size() ? fallbackChain.get(next) : null;
    }

    public List<String> getFallbackChain() {
        return List.copyOf(fallbackChain);
    }

    public Map<String, ABTestConfig> getActiveABTests() {
        return Map.copyOf(abTests);
    }

    public enum ModelTier { LIGHT, STANDARD, PREMIUM }

    public record ModelConfig(String modelId, ModelTier tier, double costPer1kTokens, int maxTokens) {}
    public record RoutingRule(String taskType, String modelId) {}
    public record ABTestConfig(String testName, String modelA, String modelB, int percentA) {}
    public record RoutingDecision(String modelId, String reason, String abGroup) {}
}
