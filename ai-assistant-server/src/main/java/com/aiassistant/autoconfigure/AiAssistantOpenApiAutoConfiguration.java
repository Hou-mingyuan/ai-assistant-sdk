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
 * <p>Only kicks in when:
 *
 * <ul>
 *   <li>springdoc-openapi is on the classpath (the dependency is {@code optional} in the Starter
 *       POM so hosts must opt in by re-declaring it as a non-optional dependency or by depending
 *       on the standalone service that already includes it), AND
 *   <li>the host has not provided its own {@link OpenAPI} bean, AND
 *   <li>{@code ai-assistant.openapi.enabled=true} is set (default {@code false}; we want hosts to
 *       deliberately opt in before exposing a JSON schema and Swagger UI to their users).
 * </ul>
 *
 * <p>Once enabled, the JSON spec is reachable at {@code /v3/api-docs} (springdoc default) and the
 * Swagger UI at {@code /swagger-ui.html}. Hosts should gate these behind their own access control;
 * the standalone service guards both behind the same {@code X-AI-Token} as the chat endpoints (see
 * {@code AiAssistantAuthFilter}).
 *
 * <p>This bean exists primarily to give the front-end OpenAPI codegen a stable, versioned schema
 * to consume — see {@code scripts/generate-frontend-types.mjs} and the
 * {@code docs/guide/openapi-typescript-codegen.md} guide.
 *
 * <p>If you need to extend the OpenAPI model (extra tags, server URLs, security schemes), simply
 * provide your own {@link OpenAPI} {@link Bean} in the host context and this auto-configuration
 * will let you win via {@link ConditionalOnMissingBean}.
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
