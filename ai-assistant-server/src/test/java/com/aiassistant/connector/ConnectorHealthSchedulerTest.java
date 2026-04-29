package com.aiassistant.connector;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import java.util.List;
import org.junit.jupiter.api.Test;

class ConnectorHealthSchedulerTest {

    @Test
    void healthyByDefault() {
        var scheduler = new ConnectorHealthScheduler(List.of(), 30_000);
        assertTrue(scheduler.isHealthy("any"));
        assertTrue(scheduler.getUnhealthyIds().isEmpty());
    }

    @Test
    void nullConnectorsHandledGracefully() {
        var scheduler = new ConnectorHealthScheduler(null, 30_000);
        assertTrue(scheduler.isHealthy("x"));
        scheduler.stop();
    }

    @Test
    void marksUnhealthy_whenListModulesThrows() throws Exception {
        DataConnector broken = mock(DataConnector.class);
        when(broken.id()).thenReturn("broken1");
        when(broken.listModules()).thenThrow(new RuntimeException("down"));

        DataConnector healthy = mock(DataConnector.class);
        when(healthy.id()).thenReturn("ok1");
        when(healthy.listModules())
                .thenReturn(List.of(new DataConnector.ModuleInfo("m1", "Module 1", "table")));

        var scheduler = new ConnectorHealthScheduler(List.of(broken, healthy), 30_000);

        // Manually simulate a probe cycle via reflection
        var probeMethod = ConnectorHealthScheduler.class.getDeclaredMethod("probe");
        probeMethod.setAccessible(true);
        probeMethod.invoke(scheduler);

        assertFalse(scheduler.isHealthy("broken1"));
        assertTrue(scheduler.isHealthy("ok1"));
        assertTrue(scheduler.getUnhealthyIds().contains("broken1"));
        assertFalse(scheduler.getUnhealthyIds().contains("ok1"));

        scheduler.stop();
    }

    @Test
    void recoversAfterReturningToHealth() throws Exception {
        DataConnector flaky = mock(DataConnector.class);
        when(flaky.id()).thenReturn("flaky1");

        when(flaky.listModules()).thenThrow(new RuntimeException("down"));

        var scheduler = new ConnectorHealthScheduler(List.of(flaky), 30_000);
        var probeMethod = ConnectorHealthScheduler.class.getDeclaredMethod("probe");
        probeMethod.setAccessible(true);

        probeMethod.invoke(scheduler);
        assertFalse(scheduler.isHealthy("flaky1"));

        doReturn(List.of(new DataConnector.ModuleInfo("m1", "Module 1", "table")))
                .when(flaky)
                .listModules();
        probeMethod.invoke(scheduler);
        assertTrue(scheduler.isHealthy("flaky1"));

        scheduler.stop();
    }
}
