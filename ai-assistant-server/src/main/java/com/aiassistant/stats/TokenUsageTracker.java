package com.aiassistant.stats;

import java.util.Map;

/**
 * Tracks token usage per tenant/model/day for cost control and billing, and enforces optional
 * per-tenant daily quotas with atomic reservation.
 *
 * <p>Two implementations are provided:
 *
 * <ul>
 *   <li>{@link InMemoryTokenUsageTracker} — process-local counters; correct for single-replica
 *       deployments. In a multi-replica deployment every replica keeps its own counters, so a daily
 *       quota of {@code N} effectively becomes {@code N * replicas}.
 *   <li>{@link RedisTokenUsageTracker} — shared Redis backend so usage and quotas stay consistent
 *       across replicas. Auto-wired when a {@code StringRedisTemplate} bean is present.
 * </ul>
 *
 * <p>All methods must be thread-safe.
 */
public interface TokenUsageTracker {

    /** Record consumed tokens for the given tenant/model. */
    void recordUsage(String tenantId, String model, int promptTokens, int completionTokens);

    /** Set a daily token quota for a tenant. {@code 0} (or negative) means unlimited. */
    void setQuota(String tenantId, long dailyTokenLimit);

    /** Return {@code true} when the tenant has reached or exceeded today's quota. */
    boolean isQuotaExceeded(String tenantId);

    /**
     * Atomically check the quota and reserve {@code estimatedTokens} so that concurrent requests
     * cannot all pass the check at once. Must be paired with {@link #releaseReservation} once the
     * request finishes. Returns {@code true} when the reservation succeeded (or no quota applies).
     */
    boolean tryReserveQuota(String tenantId, int estimatedTokens);

    /** Release a previously made reservation (no-op when none exists / unlimited). */
    void releaseReservation(String tenantId, int estimatedTokens);

    /** Remaining tokens before today's quota is hit, or {@link Long#MAX_VALUE} when unlimited. */
    long remainingQuota(String tenantId);

    /** Per-tenant usage snapshot for admin / reporting. */
    Map<String, Object> getSnapshot(String tenantId);

    /** Total tokens consumed across all tenants. */
    long getTotalTokens();

    /** Usage snapshot for every known tenant plus a {@code _globalTotalTokens} entry. */
    Map<String, Object> getGlobalSnapshot();
}
