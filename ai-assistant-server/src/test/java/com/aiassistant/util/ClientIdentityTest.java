package com.aiassistant.util;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;

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
        assertTrue(
                ClientIdentity.tokenFingerprint("a").equals(ClientIdentity.tokenFingerprint("a")));
    }

    @Test
    void defaultIgnoresForwardedForAndUsesRemoteAddr() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("X-Forwarded-For", "9.9.9.9");
        request.setRemoteAddr("10.0.0.5");

        // 默认 0 跳：不信任 XFF，必须落到 remoteAddr，避免伪造绕过限流。
        assertEquals("ip:10.0.0.5", ClientIdentity.resolve(request));
        assertEquals("ip:10.0.0.5", ClientIdentity.resolve(request, 0));
    }

    @Test
    void tokenStillTakesPriorityOverForwardedFor() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("X-AI-Token", "secret");
        request.addHeader("X-Forwarded-For", "9.9.9.9");
        request.setRemoteAddr("10.0.0.5");

        assertTrue(ClientIdentity.resolve(request, 1).startsWith("token:"));
    }

    @Test
    void oneTrustedHopTakesRightmostForgedEntriesAreIgnored() {
        // 客户端伪造 9.9.9.9，可信代理在右侧追加真实客户端 8.8.8.8；1 跳应取 8.8.8.8。
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("X-Forwarded-For", "9.9.9.9, 8.8.8.8");
        request.setRemoteAddr("10.0.0.5");

        assertEquals("ip:8.8.8.8", ClientIdentity.resolve(request, 1));
    }

    @Test
    void twoTrustedHopsTakeClientPositionFromRight() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("X-Forwarded-For", "1.1.1.1, 2.2.2.2, 3.3.3.3");
        request.setRemoteAddr("10.0.0.5");

        // len=3, hops=2 -> idx=1 -> 2.2.2.2
        assertEquals("ip:2.2.2.2", ClientIdentity.resolve(request, 2));
    }

    @Test
    void chainShorterThanConfiguredHopsFallsBackToRemoteAddr() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("X-Forwarded-For", "1.1.1.1, 2.2.2.2");
        request.setRemoteAddr("10.0.0.5");

        // hops=3 > 链长 2 -> 视为异常 -> remoteAddr
        assertEquals("ip:10.0.0.5", ClientIdentity.resolve(request, 3));
    }

    @Test
    void clientIpFromForwardedForHelperEdgeCases() {
        assertNull(ClientIdentity.clientIpFromForwardedFor(null, 1));
        assertNull(ClientIdentity.clientIpFromForwardedFor("  ", 1));
        assertNull(ClientIdentity.clientIpFromForwardedFor("1.1.1.1", 0));
        assertNull(ClientIdentity.clientIpFromForwardedFor("1.1.1.1", 2));
        assertNull(ClientIdentity.clientIpFromForwardedFor("1.1.1.1, ", 1));
        assertEquals("1.1.1.1", ClientIdentity.clientIpFromForwardedFor("1.1.1.1", 1));
        assertEquals("2.2.2.2", ClientIdentity.clientIpFromForwardedFor("1.1.1.1, 2.2.2.2", 1));
    }
}
