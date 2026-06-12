package com.aiassistant.stats;

import com.aiassistant.util.ThrottledWarnLogger;
import java.time.Duration;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.connection.StringRedisConnection;
import org.springframework.data.redis.core.RedisCallback;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;

/**
 * Redis-backed {@link TokenUsageTracker}: usage counters and per-tenant daily quotas are shared
 * across replicas, so a daily quota of {@code N} stays {@code N} regardless of how many instances
 * are running. Drop-in replacement for {@link InMemoryTokenUsageTracker}; auto-wired when a {@code
 * StringRedisTemplate} bean is present.
 *
 * <p>Storage model (keys are namespaced under {@code ai-usage:}):
 *
 * <ul>
 *   <li>{@code ai-usage:quota} — hash, field = tenantId, value = daily token limit.
 *   <li>{@code ai-usage:u:{tenant}:{date}} — hash with fields {@code total / prompt / completion /
 *       calls / m:{model}}; TTL {@value #USAGE_TTL_DAYS} days.
 *   <li>{@code ai-usage:r:{tenant}:{date}} — string holding in-flight reserved tokens; TTL {@value
 *       #RESERVATION_TTL_DAYS} days.
 *   <li>{@code ai-usage:tenants:{date}} — per-day set of active tenant ids (TTL {@value
 *       #TENANTS_TTL_DAYS} days), used by global snapshots.
 *   <li>{@code ai-usage:g} — hash, field = date, value = global tokens that day, pruned to the most
 *       recent {@value #GLOBAL_RETENTION_DAYS} days (for {@link #getTotalTokens()}).
 * </ul>
 *
 * <p>The usage hash and reservation key share a {@code {tenant}} hash-tag so they live on the same
 * Redis Cluster slot and can be touched atomically by the reserve/release Lua scripts.
 *
 * <p>Snapshots ({@link #getSnapshot} / {@link #getGlobalSnapshot}) are scoped to the current day to
 * avoid full-keyspace scans; quota enforcement is exact and cross-replica consistent.
 */
public class RedisTokenUsageTracker implements TokenUsageTracker {

    private static final Logger log = LoggerFactory.getLogger(RedisTokenUsageTracker.class);

    private static final String PREFIX = "ai-usage:";
    private static final String QUOTA_KEY = PREFIX + "quota";
    private static final String TENANTS_KEY = PREFIX + "tenants";
    private static final String GLOBAL_KEY = PREFIX + "g";

    private static final int USAGE_TTL_DAYS = 40;
    private static final int RESERVATION_TTL_DAYS = 2;
    private static final int TENANTS_TTL_DAYS = 2;
    private static final int GLOBAL_RETENTION_DAYS = 90;
    private static final Duration USAGE_TTL = Duration.ofDays(USAGE_TTL_DAYS);
    private static final Duration RESERVATION_TTL = Duration.ofDays(RESERVATION_TTL_DAYS);
    private static final Duration TENANTS_TTL = Duration.ofDays(TENANTS_TTL_DAYS);
    private static final Duration GLOBAL_TTL = Duration.ofDays(GLOBAL_RETENTION_DAYS + 10L);

    /**
     * Atomically: read today's used + reserved, and reserve {@code est} only when used + reserved +
     * est stays within quota. KEYS[1]=usage hash, KEYS[2]=reservation key; ARGV=quota, est, ttl.
     */
    private static final DefaultRedisScript<Long> RESERVE_SCRIPT =
            new DefaultRedisScript<>(
                    "local quota = tonumber(ARGV[1]) "
                            + "if quota <= 0 then return 1 end "
                            + "local est = tonumber(ARGV[2]) "
                            + "local ttl = tonumber(ARGV[3]) "
                            + "local used = tonumber(redis.call('HGET', KEYS[1], 'total') or '0') "
                            + "local reserved = tonumber(redis.call('GET', KEYS[2]) or '0') "
                            + "if used + reserved + est > quota then return 0 end "
                            + "redis.call('INCRBY', KEYS[2], est) "
                            + "redis.call('EXPIRE', KEYS[2], ttl) "
                            + "return 1",
                    Long.class);

    /** Decrement the reservation counter, clamped at zero. KEYS[1]=reservation key; ARGV=amount. */
    private static final DefaultRedisScript<Long> RELEASE_SCRIPT =
            new DefaultRedisScript<>(
                    "local cur = tonumber(redis.call('GET', KEYS[1]) or '0') "
                            + "local n = cur - tonumber(ARGV[1]) "
                            + "if n < 0 then n = 0 end "
                            + "if n == 0 then redis.call('DEL', KEYS[1]) "
                            + "else redis.call('SET', KEYS[1], tostring(n)) end "
                            + "return n",
                    Long.class);

    private final StringRedisTemplate redis;
    private final ThrottledWarnLogger warnLog = new ThrottledWarnLogger(log, 30_000);

    public RedisTokenUsageTracker(StringRedisTemplate redisTemplate) {
        this.redis = redisTemplate;
    }

    @Override
    public void recordUsage(String tenantId, String model, int promptTokens, int completionTokens) {
        if (tenantId == null) return;
        String date = today();
        String uKey = usageKey(tenantId, date);
        long total = (long) promptTokens + completionTokens;
        String tenantsKey = tenantsKey(date);
        try {
            // One network round-trip instead of ~9. Pipelining (not a single Lua / MULTI) is used
            // on purpose: the usage hash carries a {tenant} hash-tag while the per-day tenants set
            // and the global hash do not, so they live on different Redis Cluster slots and a
            // cross-slot Lua/transaction would fail. Counters tolerate non-atomic application.
            redis.executePipelined(
                    (RedisCallback<Object>)
                            connection -> {
                                StringRedisConnection conn = (StringRedisConnection) connection;
                                conn.sAdd(tenantsKey, tenantId);
                                conn.expire(tenantsKey, TENANTS_TTL.toSeconds());
                                conn.hIncrBy(uKey, "total", total);
                                conn.hIncrBy(uKey, "prompt", promptTokens);
                                conn.hIncrBy(uKey, "completion", completionTokens);
                                conn.hIncrBy(uKey, "calls", 1);
                                if (model != null && !model.isBlank()) {
                                    conn.hIncrBy(uKey, "m:" + model, total);
                                }
                                conn.expire(uKey, USAGE_TTL.toSeconds());
                                conn.hIncrBy(GLOBAL_KEY, date, total);
                                return null;
                            });
            trimGlobalHistory();
        } catch (RuntimeException e) {
            warnLog.warn("recordUsage to Redis failed for tenant {}: {}", tenantId, e.getMessage());
        }
    }

    @Override
    public void setQuota(String tenantId, long dailyTokenLimit) {
        if (tenantId == null) return;
        try {
            if (dailyTokenLimit > 0) {
                redis.opsForHash().put(QUOTA_KEY, tenantId, Long.toString(dailyTokenLimit));
            } else {
                redis.opsForHash().delete(QUOTA_KEY, tenantId);
            }
        } catch (RuntimeException e) {
            warnLog.warn("setQuota to Redis failed for tenant {}: {}", tenantId, e.getMessage());
        }
    }

    @Override
    public boolean isQuotaExceeded(String tenantId) {
        long quota = quotaOf(tenantId);
        if (quota <= 0) return false;
        return usedToday(tenantId) + reservedToday(tenantId) >= quota;
    }

    @Override
    public boolean tryReserveQuota(String tenantId, int estimatedTokens) {
        long quota = quotaOf(tenantId);
        if (quota <= 0) return true;
        String date = today();
        try {
            Long allowed =
                    redis.execute(
                            RESERVE_SCRIPT,
                            List.of(usageKey(tenantId, date), resvKey(tenantId, date)),
                            Long.toString(quota),
                            Integer.toString(estimatedTokens),
                            Long.toString(RESERVATION_TTL.getSeconds()));
            return allowed != null && allowed == 1L;
        } catch (RuntimeException e) {
            // Fail-open: a Redis outage must not block all quota'd traffic. The gateway / upstream
            // limiter remains the hard ceiling.
            warnLog.warn(
                    "tryReserveQuota Redis call failed for tenant {}: {}",
                    tenantId,
                    e.getMessage());
            return true;
        }
    }

    @Override
    public void releaseReservation(String tenantId, int estimatedTokens) {
        if (tenantId == null || estimatedTokens <= 0) return;
        try {
            redis.execute(
                    RELEASE_SCRIPT,
                    List.of(resvKey(tenantId, today())),
                    Integer.toString(estimatedTokens));
        } catch (RuntimeException e) {
            warnLog.warn(
                    "releaseReservation Redis call failed for tenant {}: {}",
                    tenantId,
                    e.getMessage());
        }
    }

    @Override
    public long remainingQuota(String tenantId) {
        long quota = quotaOf(tenantId);
        if (quota <= 0) return Long.MAX_VALUE;
        return Math.max(0, quota - usedToday(tenantId));
    }

    @Override
    public Map<String, Object> getSnapshot(String tenantId) {
        Map<Object, Object> raw = Map.of();
        try {
            raw = redis.opsForHash().entries(usageKey(tenantId, today()));
        } catch (RuntimeException e) {
            warnLog.warn(
                    "getSnapshot Redis read failed for tenant {}: {}", tenantId, e.getMessage());
        }
        if (raw == null || raw.isEmpty()) {
            return Map.of("tenantId", tenantId, "totalTokens", 0);
        }
        long total = parseLong(raw.get("total"));
        Map<String, Object> snap = new LinkedHashMap<>();
        snap.put("tenantId", tenantId);
        snap.put("totalTokens", total);
        snap.put("promptTokens", parseLong(raw.get("prompt")));
        snap.put("completionTokens", parseLong(raw.get("completion")));
        snap.put("totalCalls", parseLong(raw.get("calls")));
        snap.put("todayTokens", total);
        long quota = quotaOf(tenantId);
        if (quota > 0) {
            snap.put("dailyQuota", quota);
            snap.put("remainingQuota", Math.max(0, quota - total));
        }
        Map<String, Long> byModel = new LinkedHashMap<>();
        for (Map.Entry<Object, Object> e : raw.entrySet()) {
            String field = String.valueOf(e.getKey());
            if (field.startsWith("m:")) {
                byModel.put(field.substring(2), parseLong(e.getValue()));
            }
        }
        snap.put("byModel", byModel);
        return snap;
    }

    @Override
    public long getTotalTokens() {
        try {
            Map<Object, Object> g = redis.opsForHash().entries(GLOBAL_KEY);
            long total = 0;
            for (Object v : g.values()) {
                total += parseLong(v);
            }
            return total;
        } catch (RuntimeException e) {
            warnLog.warn("getTotalTokens Redis read failed: {}", e.getMessage());
            return 0;
        }
    }

    @Override
    public Map<String, Object> getGlobalSnapshot() {
        Map<String, Object> result = new LinkedHashMap<>();
        try {
            Set<String> tenants = redis.opsForSet().members(tenantsKey(today()));
            if (tenants != null) {
                for (String tenant : tenants) {
                    result.put(tenant, getSnapshot(tenant));
                }
            }
        } catch (RuntimeException e) {
            warnLog.warn("getGlobalSnapshot Redis read failed: {}", e.getMessage());
        }
        result.put("_globalTotalTokens", getTotalTokens());
        return result;
    }

    private long quotaOf(String tenantId) {
        if (tenantId == null) return 0;
        try {
            Object v = redis.opsForHash().get(QUOTA_KEY, tenantId);
            return parseLong(v);
        } catch (RuntimeException e) {
            warnLog.warn("quota lookup failed for tenant {}: {}", tenantId, e.getMessage());
            return 0;
        }
    }

    private long usedToday(String tenantId) {
        try {
            Object v = redis.opsForHash().get(usageKey(tenantId, today()), "total");
            return parseLong(v);
        } catch (RuntimeException e) {
            return 0;
        }
    }

    private long reservedToday(String tenantId) {
        try {
            String v = redis.opsForValue().get(resvKey(tenantId, today()));
            return parseLong(v);
        } catch (RuntimeException e) {
            return 0;
        }
    }

    private static long parseLong(Object value) {
        if (value == null) return 0;
        try {
            return Long.parseLong(value.toString().trim());
        } catch (NumberFormatException e) {
            return 0;
        }
    }

    private static String today() {
        return LocalDate.now().toString();
    }

    /** {@code {tenant}} hash-tag keeps the usage + reservation keys on the same cluster slot. */
    private static String usageKey(String tenantId, String date) {
        return PREFIX + "u:{" + tenantId + "}:" + date;
    }

    private static String resvKey(String tenantId, String date) {
        return PREFIX + "r:{" + tenantId + "}:" + date;
    }

    private static String tenantsKey(String date) {
        return TENANTS_KEY + ":" + date;
    }

    /**
     * Keeps the by-date global hash bounded to the most recent {@link #GLOBAL_RETENTION_DAYS} days
     * (ISO dates sort chronologically) and refreshes its TTL. The expensive HKEYS/HDEL only runs on
     * the first call of a new day, when the field count momentarily exceeds the retention window.
     */
    private void trimGlobalHistory() {
        redis.expire(GLOBAL_KEY, GLOBAL_TTL);
        Long size = redis.opsForHash().size(GLOBAL_KEY);
        if (size == null || size <= GLOBAL_RETENTION_DAYS) {
            return;
        }
        Set<Object> dateFields = redis.opsForHash().keys(GLOBAL_KEY);
        if (dateFields == null || dateFields.isEmpty()) {
            return;
        }
        List<String> sorted = dateFields.stream().map(String::valueOf).sorted().toList();
        int removeCount = sorted.size() - GLOBAL_RETENTION_DAYS;
        for (int i = 0; i < removeCount; i++) {
            redis.opsForHash().delete(GLOBAL_KEY, sorted.get(i));
        }
    }
}
