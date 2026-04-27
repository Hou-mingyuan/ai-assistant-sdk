package com.aiassistant.stats;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Tracks token usage per tenant/model/day for cost control and billing.
 * Thread-safe; designed for multi-tenant deployments.
 */
public class TokenUsageTracker {

    private static final Logger log = LoggerFactory.getLogger(TokenUsageTracker.class);

    private final ConcurrentHashMap<String, TenantUsage> usageByTenant = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, Long> tenantQuotas = new ConcurrentHashMap<>();

    public void recordUsage(String tenantId, String model, int promptTokens, int completionTokens) {
        TenantUsage usage = usageByTenant.computeIfAbsent(tenantId, k -> new TenantUsage());
        usage.record(model, promptTokens, completionTokens);
    }

    /**
     * Set a daily token quota for a tenant. 0 = unlimited.
     */
    public void setQuota(String tenantId, long dailyTokenLimit) {
        if (dailyTokenLimit > 0) {
            tenantQuotas.put(tenantId, dailyTokenLimit);
        } else {
            tenantQuotas.remove(tenantId);
        }
    }

    /**
     * Check if the tenant has exceeded their daily quota.
     */
    public boolean isQuotaExceeded(String tenantId) {
        Long quota = tenantQuotas.get(tenantId);
        if (quota == null || quota <= 0) return false;
        TenantUsage usage = usageByTenant.get(tenantId);
        if (usage == null) return false;
        return usage.todayTotal() >= quota;
    }

    public long remainingQuota(String tenantId) {
        Long quota = tenantQuotas.get(tenantId);
        if (quota == null || quota <= 0) return Long.MAX_VALUE;
        TenantUsage usage = usageByTenant.get(tenantId);
        long used = usage != null ? usage.todayTotal() : 0;
        return Math.max(0, quota - used);
    }

    public Map<String, Object> getSnapshot(String tenantId) {
        TenantUsage usage = usageByTenant.get(tenantId);
        if (usage == null) return Map.of("tenantId", tenantId, "totalTokens", 0);
        return usage.toSnapshot(tenantId, tenantQuotas.get(tenantId));
    }

    public Map<String, Object> getGlobalSnapshot() {
        Map<String, Object> result = new LinkedHashMap<>();
        long globalTotal = 0;
        for (Map.Entry<String, TenantUsage> entry : usageByTenant.entrySet()) {
            Map<String, Object> tenantSnap = entry.getValue().toSnapshot(entry.getKey(), tenantQuotas.get(entry.getKey()));
            result.put(entry.getKey(), tenantSnap);
            globalTotal += entry.getValue().totalTokens.get();
        }
        result.put("_globalTotalTokens", globalTotal);
        return result;
    }

    private static class TenantUsage {
        final AtomicLong totalTokens = new AtomicLong();
        final AtomicLong totalPromptTokens = new AtomicLong();
        final AtomicLong totalCompletionTokens = new AtomicLong();
        final AtomicLong totalCalls = new AtomicLong();
        final ConcurrentHashMap<String, AtomicLong> tokensByModel = new ConcurrentHashMap<>();
        final ConcurrentHashMap<String, AtomicLong> tokensByDate = new ConcurrentHashMap<>();

        void record(String model, int promptTokens, int completionTokens) {
            int total = promptTokens + completionTokens;
            totalTokens.addAndGet(total);
            totalPromptTokens.addAndGet(promptTokens);
            totalCompletionTokens.addAndGet(completionTokens);
            totalCalls.incrementAndGet();
            tokensByModel.computeIfAbsent(model, k -> new AtomicLong()).addAndGet(total);
            tokensByDate.computeIfAbsent(LocalDate.now().toString(), k -> new AtomicLong()).addAndGet(total);

            if (tokensByDate.size() > 90) {
                tokensByDate.keySet().stream().sorted().limit(tokensByDate.size() - 90).forEach(tokensByDate::remove);
            }
        }

        long todayTotal() {
            AtomicLong today = tokensByDate.get(LocalDate.now().toString());
            return today != null ? today.get() : 0;
        }

        Map<String, Object> toSnapshot(String tenantId, Long quota) {
            Map<String, Object> snap = new LinkedHashMap<>();
            snap.put("tenantId", tenantId);
            snap.put("totalTokens", totalTokens.get());
            snap.put("promptTokens", totalPromptTokens.get());
            snap.put("completionTokens", totalCompletionTokens.get());
            snap.put("totalCalls", totalCalls.get());
            snap.put("todayTokens", todayTotal());
            if (quota != null) {
                snap.put("dailyQuota", quota);
                snap.put("remainingQuota", Math.max(0, quota - todayTotal()));
            }
            Map<String, Long> byModel = new LinkedHashMap<>();
            tokensByModel.forEach((k, v) -> byModel.put(k, v.get()));
            snap.put("byModel", byModel);
            return snap;
        }
    }
}
