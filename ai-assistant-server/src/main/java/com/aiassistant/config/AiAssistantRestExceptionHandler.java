package com.aiassistant.config;

import com.aiassistant.controller.AiAssistantController;
import com.aiassistant.model.ChatResponse;
import com.aiassistant.service.SessionStoreUnavailableException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice(basePackageClasses = AiAssistantController.class)
public class AiAssistantRestExceptionHandler {

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ChatResponse> handleInvalidRequestBody(
            MethodArgumentNotValidException ex) {
        String msg =
                ex.getBindingResult().getFieldErrors().stream()
                        .findFirst()
                        .map(FieldError::getDefaultMessage)
                        .orElse("Invalid request");
        return ResponseEntity.badRequest().body(ChatResponse.fail(msg));
    }

    /** A stateful-store write that could not reach its backend → 503 (retryable), not a 500. */
    @ExceptionHandler(SessionStoreUnavailableException.class)
    public ResponseEntity<ChatResponse> handleSessionStoreUnavailable(
            SessionStoreUnavailableException ex) {
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                .body(ChatResponse.fail("Session store temporarily unavailable, please retry"));
    }
}
