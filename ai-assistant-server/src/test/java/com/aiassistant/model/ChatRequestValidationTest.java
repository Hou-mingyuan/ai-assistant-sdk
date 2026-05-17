package com.aiassistant.model;

import static org.junit.jupiter.api.Assertions.assertTrue;

import jakarta.validation.Validation;
import jakarta.validation.Validator;
import java.util.List;
import org.junit.jupiter.api.Test;

class ChatRequestValidationTest {

    private final Validator validator = Validation.buildDefaultValidatorFactory().getValidator();

    @Test
    void historyMessageRequiresKnownRoleAndContent() {
        ChatRequest.MessageItem message = new ChatRequest.MessageItem();
        message.setRole("not-a-chat-role");
        message.setContent(" ");

        ChatRequest request = new ChatRequest();
        request.setAction("chat");
        request.setText("hello");
        request.setHistory(List.of(message));

        var violations = validator.validate(request);

        assertTrue(
                violations.stream().anyMatch(v -> v.getPropertyPath().toString().contains("role")),
                "invalid history role should be rejected");
        assertTrue(
                violations.stream()
                        .anyMatch(v -> v.getPropertyPath().toString().contains("content")),
                "blank history content should be rejected");
    }
}
