package com.aiassistant.agent;

import com.aiassistant.tool.ToolDefinition;
import com.aiassistant.tool.ToolRegistry;
import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class AgentExecutorTest {

    private ToolRegistry registry;
    private AgentExecutor executor;

    @BeforeEach
    void setUp() {
        registry = new ToolRegistry(List.of(
                new ToolDefinition() {
                    @Override public String name() { return "add"; }
                    @Override public String description() { return "Add numbers"; }
                    @Override public JsonNode parametersSchema() { return null; }
                    @Override public String execute(JsonNode args) { return "42"; }
                },
                new ToolDefinition() {
                    @Override public String name() { return "fail_tool"; }
                    @Override public String description() { return "Always fails"; }
                    @Override public JsonNode parametersSchema() { return null; }
                    @Override public String execute(JsonNode args) { throw new RuntimeException("boom"); }
                }
        ));
        executor = new AgentExecutor(registry, 10);
    }

    @Test
    void execute_singleStep_success() {
        var trace = executor.execute(List.of(
                new AgentExecutor.AgentStep("Add numbers", "add", "{}")
        ));
        assertTrue(trace.allSucceeded());
        assertEquals(1, trace.steps().size());
        assertEquals("42", trace.steps().get(0).output());
    }

    @Test
    void execute_multipleSteps_allSucceed() {
        var trace = executor.execute(List.of(
                new AgentExecutor.AgentStep("Step 1", "add", "{}"),
                new AgentExecutor.AgentStep("Step 2", "add", "{}")
        ));
        assertTrue(trace.allSucceeded());
        assertEquals(2, trace.steps().size());
    }

    @Test
    void execute_stepWithoutTool_usesDescription() {
        var trace = executor.execute(List.of(
                new AgentExecutor.AgentStep("Think about the problem", null, null)
        ));
        assertTrue(trace.allSucceeded());
        assertEquals("Think about the problem", trace.steps().get(0).output());
    }

    @Test
    void execute_failingTool_continuesIfNotStopOnError() {
        var trace = executor.execute(List.of(
                new AgentExecutor.AgentStep("Will fail", "fail_tool", "{}", false),
                new AgentExecutor.AgentStep("Should run", "add", "{}")
        ));
        assertFalse(trace.allSucceeded());
        assertEquals(2, trace.steps().size());
        assertFalse(trace.steps().get(0).success());
        assertTrue(trace.steps().get(1).success());
    }

    @Test
    void execute_failingTool_stopsIfStopOnError() {
        var trace = executor.execute(List.of(
                new AgentExecutor.AgentStep("Will fail", "fail_tool", "{}", true),
                new AgentExecutor.AgentStep("Should NOT run", "add", "{}")
        ));
        assertEquals(1, trace.steps().size());
        assertFalse(trace.steps().get(0).success());
        assertNotNull(trace.steps().get(0).error());
    }

    @Test
    void execute_respectsMaxRounds() {
        var executor2 = new AgentExecutor(registry, 2);
        var trace = executor2.execute(List.of(
                new AgentExecutor.AgentStep("S1", "add", "{}"),
                new AgentExecutor.AgentStep("S2", "add", "{}"),
                new AgentExecutor.AgentStep("S3 - should not run", "add", "{}")
        ));
        assertEquals(2, trace.steps().size());
    }

    @Test
    void executeTool_directCall() throws Exception {
        String result = executor.executeTool("add", "{}");
        assertEquals("42", result);
    }

    @Test
    void executeTool_unknownTool_throws() {
        assertThrows(IllegalArgumentException.class, () -> executor.executeTool("nonexistent", "{}"));
    }

    @Test
    void trace_summary_isReadable() {
        var trace = executor.execute(List.of(
                new AgentExecutor.AgentStep("Add things", "add", "{}"),
                new AgentExecutor.AgentStep("Explode", "fail_tool", "{}")
        ));
        String summary = trace.summary();
        assertTrue(summary.contains("[Step 0] OK"));
        assertTrue(summary.contains("[Step 1] FAIL"));
        assertTrue(summary.contains("Total:"));
    }

    @Test
    void trace_totalElapsedMs_isPositive() {
        var trace = executor.execute(List.of(
                new AgentExecutor.AgentStep("Add", "add", "{}")
        ));
        assertTrue(trace.totalElapsedMs() >= 0);
    }
}
