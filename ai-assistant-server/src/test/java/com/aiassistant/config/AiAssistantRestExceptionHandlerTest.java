package com.aiassistant.config;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

import com.aiassistant.model.ChatResponse;
import com.aiassistant.service.SessionStoreUnavailableException;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

class AiAssistantRestExceptionHandlerTest {

    @Test
    void mapsSessionStoreUnavailableTo503() {
        AiAssistantRestExceptionHandler handler = new AiAssistantRestExceptionHandler();

        ResponseEntity<ChatResponse> response =
                handler.handleSessionStoreUnavailable(
                        new SessionStoreUnavailableException(
                                "down", new RuntimeException("redis")));

        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, response.getStatusCode());
        assertNotNull(response.getBody());
    }
}
