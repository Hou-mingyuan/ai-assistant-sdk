package com.aiassistant.agent;

import com.aiassistant.tool.ToolRegistry;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.ArrayList;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Multi-step agent executor implementing a ReAct-style loop. The agent can plan, execute tools,
 * observe results, and iterate until it reaches a final answer or hits the max rounds limit.
 *
 * <p>Execution trace is maintained for auditability and debugging.
 */
public class AgentExecutor {

    private static final Logger log = LoggerFactory.getLogger(AgentExecutor.class);
    private static final int DEFAULT_MAX_ROUNDS = 10;

    private final ToolRegistry toolRegistry;
    private final ObjectMapper mapper = new ObjectMapper();
    private final int maxRounds;

    public AgentExecutor(ToolRegistry toolRegistry, int maxRounds) {
        this.toolRegistry = toolRegistry;
        this.maxRounds = Math.max(1, Math.min(maxRounds, 20));
    }

    public AgentExecutor(ToolRegistry toolRegistry) {
        this(toolRegistry, DEFAULT_MAX_ROUNDS);
    }

    /**
     * Execute a plan (list of steps), each step may invoke a tool. Returns a complete execution
     * trace.
     */
    public ExecutionTrace execute(List<AgentStep> plan) {
        List<StepResult> results = new ArrayList<>();
        long start = System.currentTimeMillis();

        for (int i = 0; i < Math.min(plan.size(), maxRounds); i++) {
            AgentStep step = plan.get(i);
            StepResult result;
            try {
                if (step.toolName() != null && !step.toolName().isBlank()) {
                    JsonNode args =
                            step.arguments() != null
                                    ? mapper.readTree(step.arguments())
                                    : mapper.createObjectNode();
                    String output = toolRegistry.execute(step.toolName(), args);
                    result = new StepResult(i, step, output, null, true);
                    log.info("Agent step {} completed: tool={}", i, step.toolName());
                } else {
                    result = new StepResult(i, step, step.description(), null, true);
                }
            } catch (Exception e) {
                result = new StepResult(i, step, null, e.getMessage(), false);
                log.warn(
                        "Agent step {} failed: tool={} error={}",
                        i,
                        step.toolName(),
                        e.getMessage());
                results.add(result);
                if (step.stopOnError()) break;
                continue;
            }
            results.add(result);
        }

        long elapsed = System.currentTimeMillis() - start;
        return new ExecutionTrace(results, elapsed);
    }

    /** Execute a single tool call directly (used by LlmService function calling loop). */
    public String executeTool(String toolName, String argumentsJson) throws Exception {
        JsonNode args = mapper.readTree(argumentsJson);
        return toolRegistry.execute(toolName, args);
    }

    public record AgentStep(
            String description, String toolName, String arguments, boolean stopOnError) {
        public AgentStep(String description, String toolName, String arguments) {
            this(description, toolName, arguments, false);
        }
    }

    public record StepResult(
            int index, AgentStep step, String output, String error, boolean success) {}

    public record ExecutionTrace(List<StepResult> steps, long totalElapsedMs) {
        public boolean allSucceeded() {
            return steps.stream().allMatch(StepResult::success);
        }

        public String summary() {
            StringBuilder sb = new StringBuilder();
            for (StepResult r : steps) {
                sb.append("[Step ").append(r.index()).append("] ");
                sb.append(r.success() ? "OK" : "FAIL");
                sb.append(" - ").append(r.step().description());
                if (r.output() != null) sb.append(" → ").append(truncate(r.output(), 200));
                if (r.error() != null) sb.append(" ✗ ").append(r.error());
                sb.append("\n");
            }
            sb.append("Total: ").append(totalElapsedMs).append("ms");
            return sb.toString();
        }

        private static String truncate(String s, int maxLen) {
            return s.length() > maxLen ? s.substring(0, maxLen) + "..." : s;
        }
    }
}
