package com.aiassistant.controller;

import com.aiassistant.stats.UsageStats;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** GET /stats：返回按 action、日期汇总的调用次数和错误次数（进程内计数，多实例不汇总）。 */
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
