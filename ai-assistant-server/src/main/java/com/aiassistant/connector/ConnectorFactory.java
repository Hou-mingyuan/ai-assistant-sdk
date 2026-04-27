package com.aiassistant.connector;

import com.aiassistant.config.ConnectorProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.Locale;

/**
 * Creates {@link DataConnector} instances from {@link ConnectorProperties} configuration.
 * Shared between auto-configuration and runtime dynamic registration.
 */
public final class ConnectorFactory {

    private static final Logger log = LoggerFactory.getLogger(ConnectorFactory.class);

    private ConnectorFactory() {}

    public static DataConnector create(ConnectorProperties cfg) {
        if (cfg == null) return null;
        String type = cfg.getType() != null ? cfg.getType().toLowerCase(Locale.ROOT) : "";
        return switch (type) {
            case "informat" -> {
                if (isBlank(cfg.getBaseUrl()) || isBlank(cfg.getAppId())) {
                    log.warn("Skipping informat connector '{}': baseUrl and appId are required",
                            cfg.resolveId());
                    yield null;
                }
                InformatConnector ic = new InformatConnector(
                        cfg.resolveId(), cfg.resolveDisplayName(),
                        cfg.getBaseUrl(), cfg.getAppId(), cfg.getToken(),
                        cfg.getTimeoutSeconds());
                ic.setMaskedFieldNames(cfg.resolveMaskedFields());
                yield ic;
            }
            case "rest" -> {
                if (isBlank(cfg.getBaseUrl())) {
                    log.warn("Skipping REST connector '{}': baseUrl is required", cfg.resolveId());
                    yield null;
                }
                RestApiConnector rc = new RestApiConnector(
                        cfg.resolveId(), cfg.resolveDisplayName(),
                        cfg.getBaseUrl(), null, null, null,
                        cfg.resolveHeaders(), cfg.getTimeoutSeconds());
                rc.setMaskedFieldNames(cfg.resolveMaskedFields());
                yield rc;
            }
            case "jdbc" -> {
                log.warn("JDBC connector '{}' requires a DataSource bean and cannot be created dynamically. " +
                        "Configure it in application.yml with a Spring DataSource.", cfg.resolveId());
                yield null;
            }
            default -> {
                log.warn("Unknown connector type '{}' for '{}', skipping. Valid types: informat, rest (jdbc via Spring config)",
                        type, cfg.resolveId());
                yield null;
            }
        };
    }

    private static boolean isBlank(String s) {
        return s == null || s.isBlank();
    }
}
