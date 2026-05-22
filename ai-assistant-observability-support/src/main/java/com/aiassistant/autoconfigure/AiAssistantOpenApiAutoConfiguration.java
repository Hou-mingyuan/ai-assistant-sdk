package com.aiassistant.autoconfigure;

import com.aiassistant.config.AiAssistantProperties;
import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.info.License;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import io.swagger.v3.oas.models.servers.Server;
import java.util.List;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnClass;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;

/**
 * Auto-configuration for the OpenAPI 3.1 specification served by springdoc.
 *
 * <p>This optional configuration lives in {@code ai-assistant-observability-support}, so hosts only
 * get springdoc/OpenAPI wiring after opting into that support artifact.
 */
@AutoConfiguration
@ConditionalOnClass(name = "org.springdoc.core.configuration.SpringDocConfiguration")
@ConditionalOnProperty(prefix = "ai-assistant.openapi", name = "enabled", havingValue = "true")
@EnableConfigurationProperties(AiAssistantProperties.class)
public class AiAssistantOpenApiAutoConfiguration {

    /** Single-source-of-truth API metadata bean for springdoc. */
    @Bean
    @ConditionalOnMissingBean
    public OpenAPI aiAssistantOpenApi(AiAssistantProperties properties) {
        String contextPath = properties.getContextPath();
        if (contextPath == null || contextPath.isBlank()) {
            contextPath = "/ai-assistant";
        }

        Info info =
                new Info()
                        .title("AI Assistant SDK API")
                        .description(
                                "REST + SSE + WebSocket surface exposed by the AI Assistant"
                                        + " Starter and the standalone service. Use this schema to"
                                        + " generate type-safe clients (see"
                                        + " docs/guide/openapi-typescript-codegen.md).")
                        .version("1.0.x")
                        .license(
                                new License()
                                        .name("MIT")
                                        .url("https://opensource.org/licenses/MIT"));

        SecurityScheme aiTokenScheme =
                new SecurityScheme()
                        .type(SecurityScheme.Type.APIKEY)
                        .in(SecurityScheme.In.HEADER)
                        .name("X-AI-Token")
                        .description(
                                "Short-lived API token issued by the host. Required for"
                                        + " /chat, /stream, /file/*, /export, /admin/*.");

        SecurityScheme adminTokenScheme =
                new SecurityScheme()
                        .type(SecurityScheme.Type.APIKEY)
                        .in(SecurityScheme.In.HEADER)
                        .name("X-Admin-Token")
                        .description(
                                "Admin-only token; gates /admin/** endpoints when"
                                        + " ai-assistant.admin.enabled=true.");

        SecurityScheme tenantHeader =
                new SecurityScheme()
                        .type(SecurityScheme.Type.APIKEY)
                        .in(SecurityScheme.In.HEADER)
                        .name("X-Tenant-Id")
                        .description(
                                "Optional. Routes the request into a tenant-scoped configuration"
                                        + " (rate limit, model overrides, quota).");

        return new OpenAPI()
                .info(info)
                .addServersItem(new Server().url(contextPath).description("Starter context root"))
                .components(
                        new Components()
                                .addSecuritySchemes("AiToken", aiTokenScheme)
                                .addSecuritySchemes("AdminToken", adminTokenScheme)
                                .addSecuritySchemes("TenantId", tenantHeader))
                .security(List.of(new SecurityRequirement().addList("AiToken")));
    }
}
