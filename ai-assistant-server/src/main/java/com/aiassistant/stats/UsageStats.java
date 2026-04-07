package com.aiassistant.stats;

import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

public class UsageStats {

    private final AtomicLong totalCalls = new AtomicLong();
    private final ConcurrentHashMap<String, AtomicLong> callsByAction = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, AtomicLong> callsByDate = new ConcurrentHashMap<>();
    private final AtomicLong totalErrors = new AtomicLong();

    private static final int MAX_DATE_ENTRIES = 90;

    public void recordCall(String action) {
        totalCalls.incrementAndGet();
        callsByAction.computeIfAbsent(action, k -> new AtomicLong()).incrementAndGet();
        String today = LocalDate.now().toString();
        callsByDate.computeIfAbsent(today, k -> new AtomicLong()).incrementAndGet();
        if (callsByDate.size() > MAX_DATE_ENTRIES) {
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
