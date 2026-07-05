package com.aiassistant.util;

import jakarta.servlet.http.HttpServletRequest;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;

/**
 * Resolves a stable client identifier from the HTTP request. Priority: X-AI-Token header &gt; a
 * trusted client IP derived from X-Forwarded-For &gt; remoteAddr.
 *
 * <p><b>X-Forwarded-For 不再被默认信任。</b> 之前的实现无条件取 XFF 的第一个 IP，而该头由请求方任意可控，攻击者每次换一个
 * 值即可获得全新限流桶，限流形同虚设。现在仅当显式配置了可信代理层数（{@code trustedProxyHops &gt; 0}）时才解析 XFF， 并从右侧（可信侧）按层数定位真实客户端
 * IP；默认 0 则完全以 {@code remoteAddr} 为准。
 */
public final class ClientIdentity {

    private ClientIdentity() {}

    /**
     * 向后兼容入口：等价于 {@link #resolve(HttpServletRequest, int)} 传入 0 个可信代理跳数，即不信任 {@code
     * X-Forwarded-For}。新代码应改用带 {@code trustedProxyHops} 的重载并传入配置值。
     */
    public static String resolve(HttpServletRequest request) {
        return resolve(request, 0);
    }

    /**
     * 解析稳定的客户端标识。优先级：{@code X-AI-Token} 头 &gt; 由 {@code X-Forwarded-For} 推导的可信客户端 IP &gt; {@code
     * remoteAddr}。
     *
     * @param trustedProxyHops 服务前置的可信反向代理层数。为 0 时忽略 {@code X-Forwarded-For}，杜绝伪造绕过； 为 N(&gt;0) 时仅当
     *     XFF 链长度不小于 N 才从右数第 N 个条目取客户端 IP（右侧 N 个条目由可信代理追加， 不可伪造），链长不足 N 视为异常并回退 {@code remoteAddr}。
     */
    public static String resolve(HttpServletRequest request, int trustedProxyHops) {
        String token = request.getHeader("X-AI-Token");
        if (token != null && !token.isBlank()) return "token:" + tokenFingerprint(token);
        if (trustedProxyHops > 0) {
            String clientIp =
                    clientIpFromForwardedFor(
                            request.getHeader("X-Forwarded-For"), trustedProxyHops);
            if (clientIp != null) return "ip:" + clientIp;
        }
        return "ip:" + request.getRemoteAddr();
    }

    /**
     * 从 {@code X-Forwarded-For} 链中按可信代理层数定位真实客户端 IP。XFF 形如 {@code client, proxy1, proxy2}， 最右侧
     * {@code trustedProxyHops} 个条目由可信代理追加、不可伪造，真实客户端位于从右数第 {@code trustedProxyHops} 个，即下标 {@code
     * len - trustedProxyHops}。返回 {@code null} 表示头为空、跳数非正、 链长不足或该位置为空白，交由调用方回退 {@code
     * remoteAddr}。Visible for testing.
     */
    static String clientIpFromForwardedFor(String xForwardedFor, int trustedProxyHops) {
        if (xForwardedFor == null || xForwardedFor.isBlank() || trustedProxyHops <= 0) {
            return null;
        }
        String[] parts = xForwardedFor.split(",");
        int idx = parts.length - trustedProxyHops;
        if (idx < 0) {
            return null;
        }
        String ip = parts[idx].trim();
        return ip.isEmpty() ? null : ip;
    }

    public static String tokenFingerprint(String token) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(token.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash, 0, 16);
        } catch (NoSuchAlgorithmException e) {
            return Integer.toHexString(token.hashCode());
        }
    }
}
