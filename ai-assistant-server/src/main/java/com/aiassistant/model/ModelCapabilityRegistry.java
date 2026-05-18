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
    private final Map<String, ProbeEntry> visionProbeCache = new ConcurrentHashMap<>();

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

    public List<ModelsListResponse.ModelDetail> describeAllWithVisionProbe(
            String provider, List<String> modelIds, VisionProbe probe) {
        if (modelIds == null || modelIds.isEmpty()) return List.of();
        List<ModelsListResponse.ModelDetail> details = new ArrayList<>(modelIds.size());
        for (String modelId : modelIds) {
            if (modelId != null && !modelId.isBlank()) {
                details.add(describeWithVisionProbe(provider, modelId, probe));
            }
        }
        return List.copyOf(details);
    }

    private ModelsListResponse.ModelDetail describeWithVisionProbe(
            String provider, String modelId, VisionProbe probe) {
        ModelsListResponse.ModelDetail base = describe(provider, modelId);
        if ("registry".equals(base.getSource())) {
            return base;
        }
        String key = normalize(provider) + "\n" + normalize(modelId);
        long now = System.currentTimeMillis();
        ProbeEntry cached = visionProbeCache.get(key);
        if (cached == null || now - cached.createdAtMs >= CACHE_TTL_MS) {
            cached = new ProbeEntry(probe.supportsVision(modelId), now);
            visionProbeCache.put(key, cached);
        }
        Set<String> capabilities = new LinkedHashSet<>(base.getCapabilities());
        if (cached.supportsVision) {
            capabilities.add("vision");
        } else {
            capabilities.remove("vision");
        }
        return new ModelsListResponse.ModelDetail(
                base.getId(), List.copyOf(capabilities), "probe", Instant.now().toString());
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
                "(?:^|[-_./])(?:gpt-4o|gpt-4\\.1|gpt-5(?:\\.\\d+)?|o[134])",
                true,
                "vision",
                "tools",
                "longContext",
                "reasoning");
        add(rules, "", "gpt-realtime|realtime", true, "text", "audio", "speech", "tools");
        add(
                rules,
                "",
                "(?:gpt-image|image-\\d|dall-e|imagen|flux|stable-diffusion)",
                true,
                "imageGeneration");
        add(
                rules,
                "",
                "claude-(?:opus|sonnet|haiku)?-?4|claude-(?:3|4)",
                true,
                "vision",
                "tools",
                "longContext",
                "reasoning");
        add(
                rules,
                "",
                "gemini-(?:1\\.5|2|2\\.5|3|3\\.1)",
                true,
                "vision",
                "audio",
                "video",
                "tools",
                "longContext",
                "reasoning");
        add(
                rules,
                "",
                "qwen.*omni",
                true,
                "vision",
                "audio",
                "video",
                "speech",
                "tools",
                "longContext",
                "reasoning");
        add(
                rules,
                "",
                "qwen.*(?:vl|vision|image|3\\.5|3\\.6)",
                true,
                "vision",
                "tools",
                "longContext",
                "reasoning");
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
                "video",
                "tools",
                "longContext",
                "reasoning");
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
                "longContext",
                "reasoning");
        add(
                rules,
                "",
                "(?:hunyuan|yuanbao|spark|max|ernie|yi-|baichuan|step)",
                true,
                "tools",
                "longContext");
        add(
                rules,
                "",
                "(?:vl|vision|visual|image|multimodal|omni|llava|pixtral)",
                false,
                "vision");
        add(rules, "", "(?:audio|voice|speech|asr|tts|whisper)", false, "audio", "speech");
        add(rules, "", "(?:video|sora|veo|wan|hailuo)", false, "video");
        add(rules, "", "(?:embed|embedding|text-embedding|bge-m3|gte)", false, "embedding");
        add(rules, "", "(?:rerank|reranker|bge-reranker|jina-reranker)", false, "rerank");
        add(rules, "", "(?:reason|thinking|r1|r2)", false, "reasoning");
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

    private record ProbeEntry(boolean supportsVision, long createdAtMs) {}

    @FunctionalInterface
    public interface VisionProbe {
        boolean supportsVision(String modelId);
    }
}
