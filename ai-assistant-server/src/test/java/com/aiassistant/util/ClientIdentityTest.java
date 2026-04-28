package com.aiassistant.util;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ClientIdentityTest {

    @Test
    void tokenIdentityUsesHashInsteadOfRawToken() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("X-AI-Token", "secret-token-value");

        String identity = ClientIdentity.resolve(request);

        assertTrue(identity.startsWith("token:"));
        assertFalse(identity.contains("secret-token-value"));
    }

    @Test
    void tokenIdentityIsStableAndDistinct() {
        assertNotEquals(ClientIdentity.tokenFingerprint("a"), ClientIdentity.tokenFingerprint("b"));
        assertTrue(ClientIdentity.tokenFingerprint("a").equals(ClientIdentity.tokenFingerprint("a")));
    }
}
