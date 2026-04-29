package com.aiassistant.model;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import java.util.List;
import org.junit.jupiter.api.Test;

class ChatInputLimitsTest {

    @Test
    void validateTotalCharsWithinLimit() {
        ChatRequest req = new ChatRequest();
        req.setText("ab");
        assertNull(ChatInputLimits.validateTotalChars(req, 10));
    }

    @Test
    void validateTotalCharsExceeds() {
        ChatRequest req = new ChatRequest();
        req.setText("abcd");
        assertEquals(
                "Input too large: 4 characters (max 2)",
                ChatInputLimits.validateTotalChars(req, 2));
    }

    @Test
    void validateTotalCharsIncludesSystemPrompt() {
        ChatRequest req = new ChatRequest();
        req.setText("ab");
        req.setSystemPrompt("xy");
        assertNull(ChatInputLimits.validateTotalChars(req, 10));
        assertEquals(
                "Input too large: 4 characters (max 3)",
                ChatInputLimits.validateTotalChars(req, 3));
    }

    @Test
    void validateTotalCharsDoesNotCountModel() {
        ChatRequest req = new ChatRequest();
        req.setText("ab");
        req.setModel("mmm");
        assertNull(ChatInputLimits.validateTotalChars(req, 10));
        assertNull(ChatInputLimits.validateTotalChars(req, 2));
        assertEquals(
                "Input too large: 2 characters (max 1)",
                ChatInputLimits.validateTotalChars(req, 1));
    }

    @Test
    void validateTotalCharsUnlimitedWhenMaxZero() {
        ChatRequest req = new ChatRequest();
        req.setText("x".repeat(9999));
        assertNull(ChatInputLimits.validateTotalChars(req, 0));
    }

    @Test
    void tailHistoryWithinBudgetKeepsSuffix() {
        ChatRequest.MessageItem a = new ChatRequest.MessageItem();
        a.setRole("user");
        a.setContent("aa");
        ChatRequest.MessageItem b = new ChatRequest.MessageItem();
        b.setRole("assistant");
        b.setContent("bbbb");
        List<ChatRequest.MessageItem> hist = List.of(a, b);
        List<ChatRequest.MessageItem> out = ChatInputLimits.tailHistoryWithinBudget(hist, 4);
        assertEquals(1, out.size());
        assertEquals("bbbb", out.get(0).getContent());
    }
}
