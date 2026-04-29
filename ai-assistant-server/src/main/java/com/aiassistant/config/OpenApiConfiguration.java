package com.aiassistant.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.info.License;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.springframework.boot.autoconfigure.condition.ConditionalOnClass;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
@ConditionalOnClass(name = "org.springdoc.core.configuration.SpringDocConfiguration")
public class OpenApiConfiguration {

    @Bean
    public OpenAPI aiAssistantOpenApi() {
        return new OpenAPI()
                .info(
                        new Info()
                                .title("AI Assistant SDK API")
                                .version("1.0.0")
                                .description(
                                        "Embeddable AI assistant REST API - chat, translate, summarize, RAG, tool-calling, multi-tenant")
                                .license(new License().name("MIT"))
                                .contact(new Contact().name("AI Assistant Team")))
                .addSecurityItem(new SecurityRequirement().addList("X-AI-Token"))
                .schemaRequirement(
                        "X-AI-Token",
                        new SecurityScheme()
                                .type(SecurityScheme.Type.APIKEY)
                                .in(SecurityScheme.In.HEADER)
                                .name("X-AI-Token"));
    }
}
