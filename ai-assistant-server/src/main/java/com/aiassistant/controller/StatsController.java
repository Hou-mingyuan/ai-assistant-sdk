package com.aiassistant.controller;

import com.aiassistant.stats.UsageStats;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("${ai-assistant.context-path:/ai-assistant}")
public class StatsController {

    private final UsageStats usageStats;

    public StatsController(UsageStats usageStats) {
        this.usageStats = usageStats;
    }

    @GetMapping("/stats")
    public Map<String, Object> stats() {
        return usageStats.getSnapshot();
    }
}
