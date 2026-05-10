package com.aiassistant.security;

import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.URI;
import java.net.UnknownHostException;
import java.util.Locale;

/**
 * {@link SsrfPolicy} 的基线实现。
 *
 * <p>策略：
 *
 * <ul>
 *   <li>仅放行 {@code http} / {@code https}；
 *   <li>阻断 {@code localhost}、{@code 0.0.0.0} 等显式回环主机名；
 *   <li>解析 host 的所有 A/AAAA 记录；任一地址命中以下列表则拒绝：
 *       <ul>
 *         <li>回环（127/8、::1）；
 *         <li>any-local（0.0.0.0、::）；
 *         <li>链路本地（169.254/16、fe80::/10）；
 *         <li>多播（224/4、ff00::/8）；
 *         <li>RFC1918 私有地址（10/8、172.16/12、192.168/16）；
 *         <li>共享地址（100.64/10）以及其内部 100.100.100.200 的元数据地址；
 *         <li>RFC2544 / TEST-NET / Documentation / Reserved 网段；
 *         <li>IPv6 ULA（fc00::/7）和 Documentation 前缀（2001:db8::/32）；
 *         <li>IPv4-mapped / IPv4-compatible IPv6 内嵌的 v4 地址命中以上规则也拒绝。
 *       </ul>
 * </ul>
 *
 * <p>此实现是 stateless 且线程安全的；可作为默认 Spring Bean 注册，也可通过 {@link #INSTANCE} 获取单例
 * 在 static 上下文复用。
 *
 * <p>不防御 DNS 重绑定（TOCTOU）。如需 hardening，可在 HttpClient 层做二次 IP 校验。
 */
public final class DefaultSsrfPolicy implements SsrfPolicy {

    /** 进程内可复用的单例。状态无关，线程安全。 */
    public static final DefaultSsrfPolicy INSTANCE = new DefaultSsrfPolicy();

    public DefaultSsrfPolicy() {}

    @Override
    public void validate(URI uri) {
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
