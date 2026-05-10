package com.aiassistant.security;

import java.net.URI;

/**
 * 服务端出站 HTTP 请求的 SSRF 校验策略。
 *
 * <p>调用方在每次发起出站请求之前（包括 3xx 重定向后的每一跳）调用 {@link #validate(URI)} 校验目标 URI；
 * 不通过校验时实现应抛出 {@link IllegalArgumentException}，由调用方决定如何向上抛出或转换为业务错误。
 *
 * <p>默认实现 {@link DefaultSsrfPolicy} 提供基线策略：仅放行 http(s)、阻断 localhost / 0.0.0.0 / 私有
 * 网段 / 链路本地 / 多播 / 元数据地址。需要更严格策略（例如域名白名单、自定义 DNS、SOCKS 代理）时，宿主可
 * 在 Spring 容器中暴露自定义 {@code SsrfPolicy} Bean 替换默认实现。
 *
 * <p>本接口不防御高级 DNS 重绑定（TOCTOU）：如需要请在 HttpClient 层（如 socket factory / connect 钩子）
 * 增加二次校验。
 */
@FunctionalInterface
public interface SsrfPolicy {

    /**
     * 校验给定 URI 是否允许发起出站请求。不允许时抛 {@link IllegalArgumentException}。
     *
     * @param uri 目标 URI；可能由调用方从原始 URL 或 3xx Location 头解析得到
     */
    void validate(URI uri);
}
