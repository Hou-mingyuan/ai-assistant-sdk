package com.aiassistant.util;

import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.URI;
import java.net.UnknownHostException;
import java.util.Locale;

/**
 * 服务端出站 HTTP 请求的 SSRF 基线校验。在发起请求前对主机名做 DNS 解析并拦截常见内网/元数据目标。
 * 无法防御高级 DNS 重绑定；重定向目标需在调用方另行处理（当前依赖 HttpClient 跟随重定向，仍存在残余风险）。
 */
public final class UrlFetchSafety {

    private UrlFetchSafety() {
    }

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
        if (a.isLoopbackAddress() || a.isAnyLocalAddress() || a.isLinkLocalAddress()) {
            return true;
        }
        if (a.isSiteLocalAddress()) {
            return true;
        }
        byte[] b = a.getAddress();
        if (b != null && b.length == 4) {
            int o1 = b[0] & 0xff;
            int o2 = b[1] & 0xff;
            if (o1 == 0) {
                return true;
            }
            if (o1 == 127) {
                return true;
            }
            if (o1 == 100 && o2 >= 64 && o2 <= 127) {
                return true;
            }
            int o3 = b[2] & 0xff;
            int o4 = b[3] & 0xff;
            if (o1 == 100 && o2 == 100 && o3 == 100 && o4 == 200) {
                return true;
            }
            if (o1 == 169 && o2 == 254) {
                return true;
            }
        }
        if (a instanceof Inet4Address) {
            return false;
        }
        if (b != null && b.length == 16) {
            int hi = (b[0] & 0xff) << 8 | (b[1] & 0xff);
            if ((hi & 0xfe00) == 0xfc00) {
                return true;
            }
        }
        return false;
    }
}
