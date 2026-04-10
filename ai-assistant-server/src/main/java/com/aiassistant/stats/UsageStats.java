package com.aiassistant.stats;

import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

/**
 * 进程内用量统计：按 action 和日期记录调用次数与错误次数，保留最近 90 天数据。
 * 多实例部署时各节点独立计数。
 */
public class UsageStats {

    private final AtomicLong totalCalls = new AtomicLong();
    private final ConcurrentHashMap<String, AtomicLong> callsByAction = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, AtomicLong> callsByDate = new ConcurrentHashMap<>();
    private final AtomicLong totalErrors = new AtomicLong();

    private static final int MAX_DATE_ENTRIES = 90;
    private volatile long lastDateCleanupMs;

    public void recordCall(String action) {
        totalCalls.incrementAndGet();
        callsByAction.computeIfAbsent(action, k -> new AtomicLong()).incrementAndGet();
        String today = LocalDate.now().toString();
        callsByDate.computeIfAbsent(today, k -> new AtomicLong()).incrementAndGet();
        long now = System.currentTimeMillis();
        if (callsByDate.size() > MAX_DATE_ENTRIES && now - lastDateCleanupMs > 3_600_000) {
            lastDateCleanupMs = now;
            callsByDate.keySet().stream()
                    .sorted()
                    .limit(callsByDate.size() - MAX_DATE_ENTRIES)
                    .forEach(callsByDate::remove);
        }
    }

    public void recordError() {
        totalErrors.incrementAndGet();
    }

    public Map<String, Object> getSnapshot() {
        Map<String, Object> snapshot = new LinkedHashMap<>();
        snapshot.put("totalCalls", totalCalls.get());
        snapshot.put("totalErrors", totalErrors.get());

        Map<String, Long> actions = new LinkedHashMap<>();
        callsByAction.forEach((k, v) -> actions.put(k, v.get()));
        snapshot.put("callsByAction", actions);

        Map<String, Long> daily = new LinkedHashMap<>();
        callsByDate.forEach((k, v) -> daily.put(k, v.get()));
        snapshot.put("callsByDate", daily);

        return snapshot;
    }

    public void reset() {
        totalCalls.set(0);
        totalErrors.set(0);
        callsByAction.clear();
        callsByDate.clear();
    }
}
