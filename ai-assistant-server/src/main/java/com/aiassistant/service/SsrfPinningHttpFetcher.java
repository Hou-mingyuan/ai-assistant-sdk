package com.aiassistant.service;

import com.aiassistant.config.AiAssistantProperties;
import com.aiassistant.security.SsrfPolicy;
import java.io.InputStream;
import java.net.URI;
import java.time.Duration;
import okhttp3.Dns;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;
import okhttp3.ResponseBody;

/**
 * 基于 OkHttp 的 {@link RawByteFetcher}：使用 {@link SsrfPinningDns} 在「解析一次 + 逐 IP 校验 + pin 连接」的
 * 同时保留原始主机名做 TLS SNI / 证书校验，从而对 http 与 https 都关闭 DNS 重绑定（TOCTOU）窗口。
 *
 * <p>重定向由本类手动处理（OkHttp 关闭自动跟随），每一跳都先用 {@link SsrfPolicy#validate(URI)} 做主机级校验，连接时 再由 {@link
 * SsrfPinningDns} 做解析地址级校验。正文读取有字节上限。
 *
 * <p>本类引用 OkHttp 类型，仅在 classpath 存在 OkHttp 时由 {@link HttpContentFetcher} 实例化。
 *
 * @author houmy01
 */
final class SsrfPinningHttpFetcher implements RawByteFetcher {

    private static final int MAX_REDIRECTS = 5;

    private final AiAssistantProperties properties;
    private final SsrfPolicy ssrfPolicy;
    private final OkHttpClient client;

    SsrfPinningHttpFetcher(AiAssistantProperties properties, SsrfPolicy ssrfPolicy) {
        this(properties, ssrfPolicy, new SsrfPinningDns(ssrfPolicy));
    }

    /** 测试入口：注入自定义 {@link Dns}（例如允许回环的解析器）以便对接 MockWebServer 验证抓取与重定向逻辑。 */
    SsrfPinningHttpFetcher(AiAssistantProperties properties, SsrfPolicy ssrfPolicy, Dns dns) {
        this.properties = properties;
        this.ssrfPolicy = ssrfPolicy;
        int timeout = Math.max(1, properties.getUrlFetchTimeoutSeconds());
        this.client =
                new OkHttpClient.Builder()
                        .dns(dns)
                        .followRedirects(false)
                        .followSslRedirects(false)
                        .connectTimeout(Duration.ofSeconds(timeout))
                        .readTimeout(Duration.ofSeconds(timeout))
                        .callTimeout(Duration.ofSeconds(timeout))
                        .build();
    }

    @Override
    public byte[] fetch(URI uri) throws Exception {
        ssrfPolicy.validate(uri);
        int max = Math.max(1024, properties.getUrlFetchMaxBytes());
        URI current = uri;
        for (int hop = 0; hop <= MAX_REDIRECTS; hop++) {
            Request request =
                    new Request.Builder()
                            .url(current.toString())
                            .header("User-Agent", "AiAssistantUrlFetch/1.0")
                            .get()
                            .build();
            try (Response response = client.newCall(request).execute()) {
                int code = response.code();
                if (code >= 301 && code <= 308 && code != 304) {
                    String location = response.header("Location");
                    if (location == null || location.isBlank()) {
                        throw new IllegalStateException(
                                "Redirect " + code + " without Location header");
                    }
                    current = current.resolve(location);
                    ssrfPolicy.validate(current);
                    continue;
                }
                if (code < 200 || code >= 300) {
                    throw new IllegalStateException("HTTP " + code);
                }
                ResponseBody body = response.body();
                if (body == null) {
                    return new byte[0];
                }
                try (InputStream in = body.byteStream()) {
                    return in.readNBytes(max);
                }
            }
        }
        throw new IllegalStateException("Too many redirects (max " + MAX_REDIRECTS + ")");
    }
}
