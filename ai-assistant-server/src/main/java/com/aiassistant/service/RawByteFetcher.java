package com.aiassistant.service;

import java.net.URI;

/**
 * 极简的字节抓取抽象，用于把可选的 OkHttp（SSRF pin）实现与 {@link HttpContentFetcher} 解耦。
 *
 * <p>本接口不引用任何 OkHttp 类型，因此 {@link HttpContentFetcher} 可以安全地以本接口类型持有实现引用；只有在 classpath 存在 OkHttp
 * 且确实启用 pin 时，才会去加载引用 OkHttp 的实现类，避免缺少可选依赖时触发 {@code NoClassDefFoundError}。
 *
 * @author houmy01
 */
interface RawByteFetcher {

    /**
     * 抓取目标 URI 的正文字节（已做 SSRF 校验、重定向逐跳校验与大小上限）。
     *
     * @param uri 目标地址
     * @return 正文字节
     * @throws Exception 抓取失败、超出重定向上限或被 SSRF 策略拒绝
     */
    byte[] fetch(URI uri) throws Exception;
}
