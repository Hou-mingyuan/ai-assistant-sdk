package com.aiassistant.stats;

import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Process-local {@link TokenUsageTracker}. Thread-safe; correct for single-replica deployments.
 *
 * <p>In a multi-replica deployment every replica keeps its own counters, so a daily quota of {@code
 * N} effectively becomes {@code N * replicas}. Use {@link RedisTokenUsageTracker} (auto-wired when
 * a {@code StringRedisTemplate} bean is present) to share usage and quotas across replicas.
 */
public class InMemoryTokenUsageTracker implements TokenUsageTracker {

    /**
     * Upper bound on distinct tenants tracked in-process. {@code tenantId} originates from the
     * (format-validated but still caller-controlled) {@code X-Tenant-Id} header, so without a cap a
     * flood of distinct tenant ids would grow these maps unbounded — a memory DoS. When exceeded,
     * the least-recently-used tenants are evicted. Quotas set explicitly via {@link #setQuota} are
     * governed by admin action and are intentionally not evicted here.
     */
    private static final int MAX_TENANTS = 100_000;

    private final ConcurrentHashMap<String, TenantUsage> usageByTenant = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, Long> tenantQuotas = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, AtomicLong> reservedTokens = new ConcurrentHashMap<>();

    /**
     * Evicts the least-recently-used tenants when {@link #usageByTenant} exceeds {@link
     * #MAX_TENANTS}. Called before inserting a new tenant. Ordering is by {@code lastAccessMs}, so
     * an actively-used tenant is never the one dropped. Approximate under concurrency (best-effort
     * cap), which is acceptable for a memory safeguard.
     */
    private void evictTenantsIfNeeded() {
        int size = usageByTenant.size();
        if (size <= MAX_TENANTS) return;
        int toRemove = size - MAX_TENANTS + (MAX_TENANTS / 10);
        usageByTenant.entrySet().stream()
                .sorted(java.util.Comparator.comparingLong(e -> e.getValue().lastAccessMs))
                .limit(toRemove)
                .map(Map.Entry::getKey)
                .forEach(
                        k -> {
                            usageByTenant.remove(k);
                            reservedTokens.remove(k);
                        });
    }

    @Override
    public void recordUsage(String tenantId, String model, int promptTokens, int completionTokens) {
        if (!usageByTenant.containsKey(tenantId)) {
            evictTenantsIfNeeded();
        }
        TenantUsage usage = usageByTenant.computeIfAbsent(tenantId, k -> new TenantUsage());
        usage.record(model, promptTokens, completionTokens);
    }

    /** Set a daily token quota for a tenant. 0 = unlimited. */
    @Override
    public void setQuota(String tenantId, long dailyTokenLimit) {
        if (dailyTokenLimit > 0) {
            tenantQuotas.put(tenantId, dailyTokenLimit);
        } else {
            tenantQuotas.remove(tenantId);
        }
    }

    /** Check if the tenant has exceeded their daily quota. */
    @Override
    public boolean isQuotaExceeded(String tenantId) {
        Long quota = tenantQuotas.get(tenantId);
        if (quota == null || quota <= 0) return false;
        TenantUsage usage = usageByTenant.get(tenantId);
        if (usage == null) return false;
        long used = usage.todayTotal();
        AtomicLong reserved = reservedTokens.get(tenantId);
        if (reserved != null) used += reserved.get();
        return used >= quota;
    }

    /**
     * Atomically check quota and reserve estimated tokens using CAS. Prevents concurrent requests
     * from all passing the quota check simultaneously. Must be paired with {@link
     * #releaseReservation} after the request completes.
     */
    @Override
    public boolean tryReserveQuota(String tenantId, int estimatedTokens) {
        Long quota = tenantQuotas.get(tenantId);
        if (quota == null || quota <= 0) return true;

        TenantUsage usage = usageByTenant.get(tenantId);
        long used = usage != null ? usage.todayTotal() : 0;

        AtomicLong reserved = reservedTokens.computeIfAbsent(tenantId, k -> new AtomicLong());
        while (true) {
            long currentReserved = reserved.get();
            if (used + currentReserved + estimatedTokens > quota) return false;
            if (reserved.compareAndSet(currentReserved, currentReserved + estimatedTokens))
                return true;
        }
    }

    @Override
    public void releaseReservation(String tenantId, int estimatedTokens) {
        AtomicLong reserved = reservedTokens.get(tenantId);
        if (reserved != null) {
            reserved.updateAndGet(cur -> Math.max(0, cur - estimatedTokens));
        }
    }

    @Override
    public long remainingQuota(String tenantId) {
        Long quota = tenantQuotas.get(tenantId);
        if (quota == null || quota <= 0) return Long.MAX_VALUE;
        TenantUsage usage = usageByTenant.get(tenantId);
        long used = usage != null ? usage.todayTotal() : 0;
        return Math.max(0, quota - used);
    }

    @Override
    public Map<String, Object> getSnapshot(String tenantId) {
        TenantUsage usage = usageByTenant.get(tenantId);
        if (usage == null) return Map.of("tenantId", tenantId, "totalTokens", 0);
        return usage.toSnapshot(tenantId, tenantQuotas.get(tenantId));
    }

    /** Total tokens consumed across all tenants (all time). */
    @Override
    public long getTotalTokens() {
        long total = 0;
        for (TenantUsage usage : usageByTenant.values()) {
            total += usage.totalTokens.get();
        }
        return total;
    }

    @Override
    public Map<String, Object> getGlobalSnapshot() {
        Map<String, Object> result = new LinkedHashMap<>();
        long globalTotal = 0;
        for (Map.Entry<String, TenantUsage> entry : usageByTenant.entrySet()) {
            Map<String, Object> tenantSnap =
                    entry.getValue().toSnapshot(entry.getKey(), tenantQuotas.get(entry.getKey()));
            result.put(entry.getKey(), tenantSnap);
            globalTotal += entry.getValue().totalTokens.get();
        }
        result.put("_globalTotalTokens", globalTotal);
        return result;
    }

    private static class TenantUsage {
        // Wall-clock of the last write; used by evictTenantsIfNeeded() for LRU ordering.
        volatile long lastAccessMs = System.currentTimeMillis();
        final AtomicLong totalTokens = new AtomicLong();
        final AtomicLong totalPromptTokens = new AtomicLong();
        final AtomicLong totalCompletionTokens = new AtomicLong();
        final AtomicLong totalCalls = new AtomicLong();
        final ConcurrentHashMap<String, AtomicLong> tokensByModel = new ConcurrentHashMap<>();
        final ConcurrentHashMap<String, AtomicLong> tokensByDate = new ConcurrentHashMap<>();

        void record(String model, int promptTokens, int completionTokens) {
            lastAccessMs = System.currentTimeMillis();
            int total = promptTokens + completionTokens;
            totalTokens.addAndGet(total);
            totalPromptTokens.addAndGet(promptTokens);
            totalCompletionTokens.addAndGet(completionTokens);
            totalCalls.incrementAndGet();
            tokensByModel.computeIfAbsent(model, k -> new AtomicLong()).addAndGet(total);
            tokensByDate
                    .computeIfAbsent(LocalDate.now().toString(), k -> new AtomicLong())
                    .addAndGet(total);

            if (tokensByDate.size() > 90) {
                tokensByDate.keySet().stream()
                        .sorted()
                        .limit(tokensByDate.size() - 90)
                        .forEach(tokensByDate::remove);
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
