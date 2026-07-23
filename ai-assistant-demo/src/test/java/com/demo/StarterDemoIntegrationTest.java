package com.demo;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;

@SpringBootTest(
        webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = {
            "ai-assistant.provider=demo",
            "ai-assistant.api-key=",
            "ai-assistant.admin-enabled=false",
            "ai-assistant.websocket-enabled=false"
        })
class StarterDemoIntegrationTest {

    @LocalServerPort private int port;

    @Autowired private TestRestTemplate rest;

    @Autowired private ObjectMapper mapper;

    @Test
    void starterServesResponsiveLocalDemoPages() {
        ResponseEntity<String> index =
                rest.getForEntity("http://127.0.0.1:" + port + "/", String.class);
        assertThat(index.getStatusCode().value()).isEqualTo(200);
        assertThat(index.getBody())
                .contains("min-height: 44px")
                .contains("aria-live=\"polite\"")
                .contains("/assistant-demo.html");

        ResponseEntity<String> webComponent =
                rest.getForEntity(
                        "http://127.0.0.1:" + port + "/assistant-demo.html", String.class);
        assertThat(webComponent.getStatusCode().value()).isEqualTo(200);
        assertThat(webComponent.getBody())
                .contains("<ai-assistant")
                .contains("/vue-dist/style.css")
                .contains("/vue-dist/ai-assistant-wc.umd.cjs")
                .contains("min-height: 44px")
                .doesNotContain("https://");
    }

    @Test
    void starterAutoConfigurationServesExplicitDemoHealthAndChat() throws Exception {
        String baseUrl = "http://127.0.0.1:" + port + "/ai-assistant";

        ResponseEntity<String> health = rest.getForEntity(baseUrl + "/health", String.class);
        assertThat(health.getStatusCode().value()).isEqualTo(200);
        JsonNode healthBody = mapper.readTree(health.getBody());
        assertThat(healthBody.path("provider").asText()).isEqualTo("demo");
        assertThat(healthBody.path("mode").asText()).isEqualTo("demo");
        assertThat(healthBody.path("mock").asBoolean()).isTrue();

        ResponseEntity<String> liveness =
                rest.getForEntity(
                        "http://127.0.0.1:" + port + "/actuator/health/liveness", String.class);
        assertThat(liveness.getStatusCode().value()).isEqualTo(200);
        assertThat(mapper.readTree(liveness.getBody()).path("status").asText()).isEqualTo("UP");

        ResponseEntity<String> readiness =
                rest.getForEntity(
                        "http://127.0.0.1:" + port + "/actuator/health/readiness", String.class);
        assertThat(readiness.getStatusCode().value()).isEqualTo(200);
        assertThat(mapper.readTree(readiness.getBody()).path("status").asText()).isEqualTo("UP");

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        ResponseEntity<String> chat =
                rest.postForEntity(
                        baseUrl + "/chat",
                        new HttpEntity<>(Map.of("action", "chat", "text", "starter smoke"), headers),
                        String.class);
        assertThat(chat.getStatusCode().value()).isEqualTo(200);
        JsonNode chatBody = mapper.readTree(chat.getBody());
        assertThat(chatBody.path("success").asBoolean()).isTrue();
        assertThat(chatBody.path("meta").path("provider").asText()).isEqualTo("demo");
        assertThat(chatBody.path("result").asText())
                .contains("[DEMO MODE - deterministic local response, not real AI]")
                .contains("starter smoke");
    }

    @Test
    void starterAutoConfigurationStreamsExplicitDemoSse() {
        String url = "http://127.0.0.1:" + port + "/ai-assistant/stream";
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setAccept(java.util.List.of(MediaType.TEXT_EVENT_STREAM));

        ResponseEntity<String> response =
                rest.exchange(
                        url,
                        HttpMethod.POST,
                        new HttpEntity<>(Map.of("action", "chat", "text", "starter stream"), headers),
                        String.class);

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getHeaders().getContentType())
                .isNotNull()
                .satisfies(type -> assertThat(type.isCompatibleWith(MediaType.TEXT_EVENT_STREAM)).isTrue());
        assertThat(response.getBody())
                .contains("[DEMO MODE - deterministic local response, not real AI]")
                .contains("starter stream");
    }
}
