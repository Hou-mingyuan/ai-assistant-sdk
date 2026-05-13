package com.aiassistant.util;

import com.aiassistant.security.DefaultSsrfPolicy;
import com.aiassistant.security.SsrfPolicy;
import java.net.URI;

/**
 * 服务端出站 HTTP 请求的 SSRF 基线校验门面。
 *
 * <p>历史上本类直接持有 SSRF 校验逻辑。从本次重构起逻辑下沉到 {@link com.aiassistant.security.DefaultSsrfPolicy}，本类作为 thin
 * facade 委派调用，保持向后兼容。
 *
 * <p>新代码请优先注入 {@link com.aiassistant.security.SsrfPolicy} 接口，便于宿主以 Spring {@code @Bean}
 * 形式替换为更严格策略（如域名白名单、自定义 DNS、SOCKS 代理）。
 *
 * <p>注意：此校验不防御高级 DNS 重绑定；重定向目标需由调用方逐跳调用本校验。
 */
public final class UrlFetchSafety {

    private UrlFetchSafety() {}

    /**
     * 沿用历史 API：使用进程默认 {@link DefaultSsrfPolicy} 校验给定 URI。
     *
     * @see SsrfPolicy#validate(URI)
     */
    public static void validateHttpUrlForServerSideFetch(URI uri) {
        DefaultSsrfPolicy.INSTANCE.validate(uri);
    }
}
