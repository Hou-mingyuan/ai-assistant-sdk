package com.aiassistant.util;

import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.URI;
import java.net.UnknownHostException;
import java.util.Locale;

/** 服务端出站 HTTP 请求的 SSRF 基线校验。在发起请求前对主机名做 DNS 解析并拦截常见内网/元数据目标。 无法防御高级 DNS 重绑定；重定向目标需由调用方逐跳调用本校验。 */
public final class UrlFetchSafety {

    private UrlFetchSafety() {}

    public static void validateHttpUrlForServerSideFetch(URI uri) {
        if (uri == null) {
            throw new IllegalArgumentException("uri is null");
        }
        String scheme = uri.getScheme();
        if (scheme == null
                || (!"http".equalsIgnoreCase(scheme) && !"https".equalsIgnoreCase(scheme))) {
            throw new IllegalArgumentException("only http(s) allowed");
        }
        String host = uri.getHost();
        if (host == null || host.isBlank()) {
            throw new IllegalArgumentException("host required");
        }
        String h = host.toLowerCase(Locale.ROOT);
        if (h.equals("localhost") || h.endsWith(".localhost")) {
            throw new IllegalArgumentException("host not allowed");
        }
        if ("0.0.0.0".equals(h)) {
            throw new IllegalArgumentException("host not allowed");
        }

        InetAddress[] addresses;
        try {
            addresses = InetAddress.getAllByName(host);
        } catch (UnknownHostException e) {
            throw new IllegalArgumentException("unknown host: " + host, e);
        }
        for (InetAddress a : addresses) {
            if (isDisallowedTarget(a)) {
                throw new IllegalArgumentException("address not allowed: " + a.getHostAddress());
            }
        }
    }

    private static boolean isDisallowedTarget(InetAddress a) {
        if (a.isLoopbackAddress()
                || a.isAnyLocalAddress()
                || a.isLinkLocalAddress()
                || a.isMulticastAddress()) {
            return true;
        }
        if (a.isSiteLocalAddress()) {
            return true;
        }
        byte[] b = a.getAddress();
        if (b != null && b.length == 4) {
            return isDisallowedIpv4(b);
        }
        if (a instanceof Inet4Address) {
            return false;
        }
        if (b != null && b.length == 16) {
            byte[] embeddedIpv4 = extractEmbeddedIpv4(b);
            if (embeddedIpv4 != null && isDisallowedIpv4(embeddedIpv4)) {
                return true;
            }
            int hi = (b[0] & 0xff) << 8 | (b[1] & 0xff);
            if ((hi & 0xfe00) == 0xfc00) {
                return true;
            }
            int prefix32 =
                    ((b[0] & 0xff) << 24)
                            | ((b[1] & 0xff) << 16)
                            | ((b[2] & 0xff) << 8)
                            | (b[3] & 0xff);
            if (prefix32 == 0x20010db8) {
                return true;
            }
        }
        return false;
    }

    private static boolean isDisallowedIpv4(byte[] b) {
        int o1 = b[0] & 0xff;
        int o2 = b[1] & 0xff;
        int o3 = b[2] & 0xff;
        int o4 = b[3] & 0xff;
        if (o1 == 0 || o1 == 10 || o1 == 127) {
            return true;
        }
        if (o1 == 100 && o2 >= 64 && o2 <= 127) {
            return true;
        }
        if (o1 == 100 && o2 == 100 && o3 == 100 && o4 == 200) {
            return true;
        }
        if (o1 == 169 && o2 == 254) {
            return true;
        }
        if (o1 == 172 && o2 >= 16 && o2 <= 31) {
            return true;
        }
        if (o1 == 192 && o2 == 168) {
            return true;
        }
        if (o1 == 192 && o2 == 0 && o3 == 0) {
            return true;
        }
        if (o1 == 192 && o2 == 0 && o3 == 2) {
            return true;
        }
        if (o1 == 192 && o2 == 88 && o3 == 99) {
            return true;
        }
        if (o1 == 198 && (o2 == 18 || o2 == 19)) {
            return true;
        }
        if (o1 == 198 && o2 == 51 && o3 == 100) {
            return true;
        }
        if (o1 == 203 && o2 == 0 && o3 == 113) {
            return true;
        }
        return o1 >= 224;
    }

    private static byte[] extractEmbeddedIpv4(byte[] b) {
        boolean firstTenZero = true;
        for (int i = 0; i < 10; i++) {
            if (b[i] != 0) {
                firstTenZero = false;
                break;
            }
        }
        if (firstTenZero && b[10] == (byte) 0xff && b[11] == (byte) 0xff) {
            return new byte[] {b[12], b[13], b[14], b[15]};
        }
        boolean firstTwelveZero = true;
        for (int i = 0; i < 12; i++) {
            if (b[i] != 0) {
                firstTwelveZero = false;
                break;
            }
        }
        if (firstTwelveZero) {
            return new byte[] {b[12], b[13], b[14], b[15]};
        }
        return null;
    }
}
