package com.aiassistant.connector;

import com.aiassistant.config.ConnectorProperties;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class ConnectorFactoryTest {

    @Test
    void returnsNullForNullConfig() {
        assertNull(ConnectorFactory.create(null));
    }

    @Test
    void createsInformatConnector() {
        ConnectorProperties cfg = new ConnectorProperties();
        cfg.setType("informat");
        cfg.setId("erp");
        cfg.setDisplayName("ERP");
        cfg.setBaseUrl("https://example.com");
        cfg.setAppId("app123");
        cfg.setToken("tok");
        cfg.setTimeoutSeconds(10);

        DataConnector dc = ConnectorFactory.create(cfg);
        assertNotNull(dc);
        assertInstanceOf(InformatConnector.class, dc);
        assertEquals("erp", dc.id());
        assertEquals("ERP", dc.displayName());
    }

    @Test
    void skipsInformatWithoutBaseUrl() {
        ConnectorProperties cfg = new ConnectorProperties();
        cfg.setType("informat");
        cfg.setAppId("app123");
        assertNull(ConnectorFactory.create(cfg));
    }

    @Test
    void skipsInformatWithoutAppId() {
        ConnectorProperties cfg = new ConnectorProperties();
        cfg.setType("informat");
        cfg.setBaseUrl("https://example.com");
        assertNull(ConnectorFactory.create(cfg));
    }

    @Test
    void createsRestConnector() {
        ConnectorProperties cfg = new ConnectorProperties();
        cfg.setType("rest");
        cfg.setId("api");
        cfg.setBaseUrl("https://api.example.com");

        DataConnector dc = ConnectorFactory.create(cfg);
        assertNotNull(dc);
        assertInstanceOf(RestApiConnector.class, dc);
        assertEquals("api", dc.id());
    }

    @Test
    void skipsRestWithoutBaseUrl() {
        ConnectorProperties cfg = new ConnectorProperties();
        cfg.setType("rest");
        assertNull(ConnectorFactory.create(cfg));
    }

    @Test
    void returnsNullForJdbcType() {
        ConnectorProperties cfg = new ConnectorProperties();
        cfg.setType("jdbc");
        cfg.setId("mydb");
        assertNull(ConnectorFactory.create(cfg));
    }

    @Test
    void returnsNullForUnknownType() {
        ConnectorProperties cfg = new ConnectorProperties();
        cfg.setType("cassandra");
        assertNull(ConnectorFactory.create(cfg));
    }

    @Test
    void appliesMaskedFields() {
        ConnectorProperties cfg = new ConnectorProperties();
        cfg.setType("informat");
        cfg.setBaseUrl("https://example.com");
        cfg.setAppId("app1");
        cfg.setMaskedFields("password,secret");

        DataConnector dc = ConnectorFactory.create(cfg);
        assertNotNull(dc);
        assertTrue(dc.maskedFieldNames().contains("password"));
        assertTrue(dc.maskedFieldNames().contains("secret"));
    }

    @Test
    void usesDefaultIdAndDisplayName() {
        ConnectorProperties cfg = new ConnectorProperties();
        cfg.setType("informat");
        cfg.setBaseUrl("https://example.com");
        cfg.setAppId("app1");

        DataConnector dc = ConnectorFactory.create(cfg);
        assertNotNull(dc);
        assertEquals("informat", dc.id());
        assertEquals("织信NEXT", dc.displayName());
    }
}
