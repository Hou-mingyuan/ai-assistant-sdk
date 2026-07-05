package com.aiassistant.service;

import com.aiassistant.security.SsrfPolicy;
import java.net.InetAddress;
import java.net.UnknownHostException;
import java.util.ArrayList;
import java.util.List;
import okhttp3.Dns;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * SSRF 安全的 OkHttp {@link Dns}：把主机名解析一次，对每个解析结果调用 {@link
 * SsrfPolicy#validateResolvedAddress(InetAddress)} 校验，仅返回通过校验的地址，并禁止 OkHttp 再次解析。
 *
 * <p>OkHttp 会连接本 {@code Dns} 返回的某个 IP，同时仍以原始主机名做 TLS SNI 与证书校验。因此本类把「解析」与「连接」 合并到同一次已校验的地址上，关闭了
 * {@code SsrfPolicy.validate(URI)} 与实际连接之间的 DNS 重绑定（TOCTOU）窗口—— 这一点正是 {@code
 * java.net.http.HttpClient} 在 https 下无法做到的（pin 到 IP 会破坏 SNI/证书校验）。
 *
 * @author houmy01
 */
public final class SsrfPinningDns implements Dns {

    private static final Logger log = LoggerFactory.getLogger(SsrfPinningDns.class);

    private final SsrfPolicy ssrfPolicy;
    private final Dns delegate;

    public SsrfPinningDns(SsrfPolicy ssrfPolicy) {
        this(ssrfPolicy, Dns.SYSTEM);
    }

    /** 测试入口：注入可控的底层解析器，无需真实 DNS 即可验证 IP 过滤逻辑。 */
    SsrfPinningDns(SsrfPolicy ssrfPolicy, Dns delegate) {
        this.ssrfPolicy = ssrfPolicy;
        this.delegate = delegate;
    }

    @Override
    public List<InetAddress> lookup(String hostname) throws UnknownHostException {
        List<InetAddress> resolved = delegate.lookup(hostname);
        List<InetAddress> safe = new ArrayList<>(resolved.size());
        for (InetAddress address : resolved) {
            try {
                ssrfPolicy.validateResolvedAddress(address);
                safe.add(address);
            } catch (RuntimeException blocked) {
                log.debug(
                        "SSRF pinning dropped resolved address {} for host {}: {}",
                        address.getHostAddress(),
                        hostname,
                        blocked.getMessage());
            }
        }
        if (safe.isEmpty()) {
            throw new UnknownHostException(
                    "SSRF policy blocked all resolved addresses for host: " + hostname);
        }
        return safe;
    }
}
