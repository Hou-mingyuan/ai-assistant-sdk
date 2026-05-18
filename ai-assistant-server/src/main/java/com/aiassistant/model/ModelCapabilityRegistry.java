package com.aiassistant.model;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Pattern;

/**
 * Lightweight model capability registry used by GET /models.
 *
 * <p>Provider model catalogs rarely expose a portable capability schema. This registry combines a
 * curated 2026 seed set with name-based inference and a short-lived cache so the frontend can make
 * better decisions without probing the upstream LLM on every page load.
 */
public class ModelCapabilityRegistry {

    private static final long CACHE_TTL_MS = 6 * 60 * 60 * 1000L;
    private static final List<Rule> RULES = buildRules();
    private final Map<String, CacheEntry> cache = new ConcurrentHashMap<>();

    public ModelsListResponse.ModelDetail describe(String provider, String modelId) {
        String id = modelId == null ? "" : modelId.trim();
        String normalizedProvider = normalize(provider);
        String key = normalizedProvider + "\n" + normalize(id);
        long now = System.currentTimeMillis();
        CacheEntry cached = cache.get(key);
        if (cached != null && now - cached.createdAtMs < CACHE_TTL_MS) {
            return cached.detail;
        }
        ModelsListResponse.ModelDetail detail = infer(normalizedProvider, id);
        cache.put(key, new CacheEntry(detail, now));
        return detail;
    }

    public List<ModelsListResponse.ModelDetail> describeAll(
            String provider, List<String> modelIds) {
        if (modelIds == null || modelIds.isEmpty()) return List.of();
        List<ModelsListResponse.ModelDetail> details = new ArrayList<>(modelIds.size());
        for (String modelId : modelIds) {
            if (modelId != null && !modelId.isBlank()) {
                details.add(describe(provider, modelId));
            }
        }
        return List.copyOf(details);
    }

    private ModelsListResponse.ModelDetail infer(String provider, String id) {
        Set<String> capabilities = new LinkedHashSet<>();
        capabilities.add("text");
        String source = "heuristic";
        for (Rule rule : RULES) {
            if (rule.matches(provider, id)) {
                capabilities.addAll(rule.capabilities());
                if (rule.registry()) source = "registry";
            }
        }
        return new ModelsListResponse.ModelDetail(
                id, List.copyOf(capabilities), source, Instant.now().toString());
    }

    private static List<Rule> buildRules() {
        List<Rule> rules = new ArrayList<>();
        add(
                rules,
                "",
                "(?:^|[-_./])(?:gpt-4o|gpt-4\\.1|gpt-5|o[134])",
                true,
                "vision",
                "tools",
                "longContext");
        add(
                rules,
                "",
                "claude-(?:opus|sonnet|haiku)?-?4|claude-(?:3|4)",
                true,
                "vision",
                "tools",
                "longContext");
        add(
                rules,
                "",
                "gemini-(?:1\\.5|2|2\\.5|3|3\\.1)",
                true,
                "vision",
                "tools",
                "longContext");
        add(
                rules,
                "",
                "qwen.*(?:vl|omni|vision|image|3\\.5|3\\.6)",
                true,
                "vision",
                "tools",
                "longContext");
        add(
                rules,
                "",
                "minimax-(?:m2(?:\\.\\d+)?|text-01|vl-01)",
                true,
                "vision",
                "tools",
                "longContext",
                "reasoning");
        add(
                rules,
                "",
                "kimi-k2(?:\\.\\d+)?|kimi.*vision",
                true,
                "vision",
                "tools",
                "longContext");
        add(
                rules,
                "",
                "deepseek-(?:v4|r2|chat|reasoner)",
                true,
                "tools",
                "longContext",
                "reasoning");
        add(
                rules,
                "",
                "glm-(?:4|5)|glm.*(?:v|vision)",
                true,
                "tools",
                "longContext",
                "reasoning");
        add(
                rules,
                "",
                "doubao.*(?:vision|seed|pro)",
                true,
                "vision",
                "tools",
                "longContext");
        add(
                rules,
                "",
                "(?:vl|vision|visual|image|multimodal|omni|llava|pixtral)",
                false,
                "vision");
        add(rules, "", "(?:tool|function|agent|mcp|assistant)", false, "tools");
        add(rules, "", "(?:32k|64k|100k|128k|200k|256k|1m|long|context)", false, "longContext");
        return List.copyOf(rules);
    }

    private static void add(
            List<Rule> rules,
            String providerPattern,
            String modelPattern,
            boolean registry,
            String... capabilities) {
        rules.add(
                new Rule(
                        providerPattern.isBlank()
                                ? null
                                : Pattern.compile(providerPattern, Pattern.CASE_INSENSITIVE),
                        Pattern.compile(modelPattern, Pattern.CASE_INSENSITIVE),
                        registry,
                        List.of(capabilities)));
    }

    private static String normalize(String value) {
        return value == null ? "" : value.trim().toLowerCase(Locale.ROOT);
    }

    private record Rule(
            Pattern providerPattern,
            Pattern modelPattern,
            boolean registry,
            List<String> capabilities) {
        boolean matches(String provider, String modelId) {
            boolean providerMatches =
                    providerPattern == null || providerPattern.matcher(provider).find();
            return providerMatches && modelPattern.matcher(modelId).find();
        }
    }

    private record CacheEntry(ModelsListResponse.ModelDetail detail, long createdAtMs) {}
}
