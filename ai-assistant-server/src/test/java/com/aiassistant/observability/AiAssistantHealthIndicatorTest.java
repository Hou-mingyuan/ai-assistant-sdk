package com.aiassistant.observability;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.aiassistant.config.AiAssistantProperties;
import com.aiassistant.config.ProviderConnectivityChecker;
import org.junit.jupiter.api.Test;
import org.springframework.boot.actuate.health.Health;
import org.springframework.boot.actuate.health.Status;

class AiAssistantHealthIndicatorTest {

    @Test
    void health_up_whenProviderReachable() {
        var props = new AiAssistantProperties();
        props.setApiKey("sk-test1234567890");
        var checker = mock(ProviderConnectivityChecker.class);
        var result =
                new ProviderConnectivityChecker.ConnectivityResult(
                        true, "openai", "sk-t****7890", 150, 200, null);
        when(checker.getLastResult()).thenReturn(result);

        var indicator = new AiAssistantHealthIndicator(props, checker);
        Health health = indicator.health();

        assertEquals(Status.UP, health.getStatus());
        assertEquals(true, health.getDetails().get("providerReachable"));
        assertEquals(150L, health.getDetails().get("providerLatencyMs"));
    }

    @Test
    void health_down_whenProviderUnreachable() {
        var props = new AiAssistantProperties();
        props.setApiKey("sk-test1234567890");
        var checker = mock(ProviderConnectivityChecker.class);
        var result =
                new ProviderConnectivityChecker.ConnectivityResult(
                        false, "openai", null, -1, -1, "Connection refused");
        when(checker.getLastResult()).thenReturn(result);

        var indicator = new AiAssistantHealthIndicator(props, checker);
        Health health = indicator.health();

        assertEquals(Status.DOWN, health.getStatus());
        assertEquals("Connection refused", health.getDetails().get("reason"));
    }

    @Test
    void health_up_whenCheckerNotYetRun() {
        var props = new AiAssistantProperties();
        props.setApiKey("sk-test1234567890");
        var checker = mock(ProviderConnectivityChecker.class);
        when(checker.getLastResult()).thenReturn(null);

        var indicator = new AiAssistantHealthIndicator(props, checker);
        Health health = indicator.health();

        assertEquals(Status.UP, health.getStatus());
        assertEquals("pending", health.getDetails().get("providerReachable"));
    }

    @Test
    void health_includesProviderAndModel() {
        var props = new AiAssistantProperties();
        props.setApiKey("sk-test1234567890");
        var indicator = new AiAssistantHealthIndicator(props, null);
        Health health = indicator.health();

        assertNotNull(health.getDetails().get("provider"));
        assertNotNull(health.getDetails().get("model"));
        assertEquals(1, (int) health.getDetails().get("apiKeysConfigured"));
    }
}
