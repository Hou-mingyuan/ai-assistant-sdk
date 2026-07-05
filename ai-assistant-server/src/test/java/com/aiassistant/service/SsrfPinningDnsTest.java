package com.aiassistant.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.aiassistant.security.DefaultSsrfPolicy;
import com.aiassistant.security.SsrfPolicy;
import java.net.InetAddress;
import java.net.UnknownHostException;
import java.util.ArrayList;
import java.util.List;
import okhttp3.Dns;
import org.junit.jupiter.api.Test;

class SsrfPinningDnsTest {

    /** 固定解析结果的假 Dns，IP 字面量不触发真实 DNS。 */
    private static Dns fixedDelegate(String... ips) {
        return hostname -> {
            List<InetAddress> out = new ArrayList<>();
            for (String ip : ips) {
                out.add(InetAddress.getByName(ip));
            }
            return out;
        };
    }

    @Test
    void dropsInternalAddressesAndKeepsPublic() throws Exception {
        SsrfPinningDns dns =
                new SsrfPinningDns(
                        new DefaultSsrfPolicy(), fixedDelegate("8.8.8.8", "10.0.0.1", "127.0.0.1"));

        List<InetAddress> result = dns.lookup("example.com");

        assertEquals(1, result.size());
        assertEquals("8.8.8.8", result.get(0).getHostAddress());
    }

    @Test
    void throwsWhenAllResolvedAddressesAreBlocked() {
        // 模拟 DNS 重绑定到内网/元数据地址：全部被基线策略拒绝 -> 抛 UnknownHostException，连接根本不会建立。
        SsrfPinningDns dns =
                new SsrfPinningDns(
                        new DefaultSsrfPolicy(),
                        fixedDelegate("169.254.169.254", "10.0.0.1", "127.0.0.1"));

        assertThrows(UnknownHostException.class, () -> dns.lookup("rebind.evil.example.com"));
    }

    @Test
    void permissivePolicyKeepsAllResolvedAddresses() throws Exception {
        // 仅按主机名校验的自定义策略（validateResolvedAddress 默认 no-op）不应过滤任何 IP。
        SsrfPolicy permissive = uri -> {};
        SsrfPinningDns dns = new SsrfPinningDns(permissive, fixedDelegate("10.0.0.1", "127.0.0.1"));

        assertEquals(2, dns.lookup("internal.example.com").size());
    }
}
