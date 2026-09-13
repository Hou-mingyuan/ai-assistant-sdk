package com.aiassistant.controller;

import com.aiassistant.config.AiAssistantProperties;
import com.aiassistant.security.HmacTenantTokens;
import java.time.Instant;
import java.util.Map;
import java.util.regex.Pattern;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Issues HMAC-signed tenant tokens for the {@code hmac} auth mode. Host applications call this
 * endpoint server-side (admin token required) and hand the returned token to their own frontend;
 * the token then authenticates embedded-assistant calls with its tenant identity derived from the
 * signature instead of a client-supplied header.
 */
@RestController
@RequestMapping("${ai-assistant.context-path:/ai-assistant}/admin")
public class TenantTokenController {

    private static final Pattern SAFE_TENANT_ID = Pattern.compile("[a-zA-Z0-9_.:-]{1,64}");

    private final AiAssistantProperties properties;

    public TenantTokenController(AiAssistantProperties properties) {
        this.properties = properties;
    }

    @PostMapping("/tenant-tokens")
    public ResponseEntity<Map<String, Object>> issueTenantToken(@RequestBody Map<String, Object> body) {
        if (!"hmac".equalsIgnoreCase(properties.getAuthMode())) {
            return ResponseEntity.status(409)
                    .body(Map.of(
                            "success",
                            false,
                            "error",
                            "tenant tokens require ai-assistant.security.auth-mode=hmac"));
        }
        String tenantId = body.get("tenantId") instanceof String s ? s : null;
        if (tenantId == null || !SAFE_TENANT_ID.matcher(tenantId.trim()).matches()) {
            return ResponseEntity.badRequest()
                    .body(Map.of(
                            "success",
                            false,
                            "error",
                            "tenantId is required and must match [a-zA-Z0-9_.:-]{1,64}"));
        }
        long ttl = properties.getTenantTokenTtlSeconds();
        if (body.get("ttlSeconds") instanceof Number requested) {
            ttl = requested.longValue();
        }
        String secret = properties.getAccessToken();
        if (secret == null || secret.isBlank()) {
            return ResponseEntity.status(409)
                    .body(Map.of(
                            "success",
                            false,
                            "error",
                            "ai-assistant.security.access-token must be configured as the signing secret"));
        }
        String token = HmacTenantTokens.issue(tenantId.trim(), ttl, secret, Instant.now());
        return ResponseEntity.ok(Map.of(
                "success",
                true,
                "tenantId",
                tenantId.trim(),
                "token",
                token,
                "ttlSeconds",
                ttl));
    }
}
