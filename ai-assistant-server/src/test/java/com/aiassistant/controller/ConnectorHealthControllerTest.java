package com.aiassistant.controller;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.aiassistant.config.ConnectorProperties;
import com.aiassistant.tool.ToolRegistry;
import java.util.Map;
import org.junit.jupiter.api.Test;

class ConnectorHealthControllerTest {

    @Test
    void dynamicConnectorRegistrationIsDisabledByDefault() {
        ConnectorHealthController controller = new ConnectorHealthController(
                java.util.List.of(), new ToolRegistry(java.util.List.of()));

        Map<String, Object> result = controller.registerConnector(new ConnectorProperties());

        assertEquals(false, result.get("success"));
        assertEquals("CONNECTOR_MANAGEMENT_DISABLED", result.get("errorCode"));
    }

    @Test
    void dynamicConnectorUnregistrationIsDisabledByDefault() {
        ConnectorHealthController controller = new ConnectorHealthController(
                java.util.List.of(), new ToolRegistry(java.util.List.of()));

        Map<String, Object> result = controller.unregisterConnector("demo");

        assertEquals(false, result.get("success"));
        assertEquals("CONNECTOR_MANAGEMENT_DISABLED", result.get("errorCode"));
    }
}
