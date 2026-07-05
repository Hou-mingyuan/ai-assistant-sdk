package com.aiassistant.service;

import com.aiassistant.config.AiAssistantProperties;
import com.aiassistant.security.DefaultSsrfPolicy;
import com.aiassistant.security.SsrfPolicy;
import java.io.InputStream;
import java.net.InetAddress;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * 核心 HTTP 正文抓取器：SSRF 安全的字节抓取（含重定向逐跳校验）、字符集嗅探与 TTL 正文缓存。
 *
 * <p>从原 {@link UrlFetchService} 拆出，作为 {@link WebSearchService}、{@link UrlPreviewService} 与 {@code
 * UrlFetchService} 门面共享的底层抓取能力。SSRF 校验通过注入的 {@link SsrfPolicy} 完成，缺省使用 {@link DefaultSsrfPolicy}。
 *
 * @author houmy01
 */
public class HttpContentFetcher {

    private static final int MAX_REDIRECTS = 5;

    private static final Logger log = LoggerFactory.getLogger(HttpContentFetcher.class);

    private static final Pattern CHARSET_ATTR =
            Pattern.compile("charset=([a-zA-Z0-9._-]+)", Pattern.CASE_INSENSITIVE);

    /** 仅当 classpath 存在 OkHttp 时才走 SSRF pin 路径，避免缺少可选依赖时触发 NoClassDefFoundError。 */
    private static final boolean OKHTTP_PRESENT = isPresent("okhttp3.OkHttpClient");

    private final AiAssistantProperties properties;
    private final HttpClient httpClient;
    private final SsrfPolicy ssrfPolicy;
    private final ConcurrentHashMap<String, CacheEntry> fetchCache = new ConcurrentHashMap<>();
    // R5: warn at most once if IP pinning is enabled but the JVM forbids the Host header.
    private final AtomicBoolean warnedPinUnavailable = new AtomicBoolean(false);

    /**
     * 非空表示对 {@link #fetchBytes(URI)} 启用 OkHttp 的 SSRF pin 抓取（解析一次 + 逐 IP 校验 + pin 连接， 同时保留
     * SNI/证书主机名），关闭 http 与 https 的 DNS 重绑定窗口。仅在「未注入自定义 HttpClient（即生产默认 路径）且 classpath 存在
     * OkHttp」时启用；注入了 HttpClient（测试 / 自定义）时保持原 JDK 抓取路径不变。
     */
    private final RawByteFetcher pinningFetcher;

    public HttpContentFetcher(
            AiAssistantProperties properties, HttpClient httpClient, SsrfPolicy ssrfPolicy) {
        this.properties = properties;
        this.ssrfPolicy = ssrfPolicy != null ? ssrfPolicy : DefaultSsrfPolicy.INSTANCE;
        if (httpClient != null) {
            this.httpClient = httpClient;
            // 注入了客户端（测试 / 自定义）：保持原 JDK 路径不变，不启用 pin。
            this.pinningFetcher = null;
        } else {
            int timeout = Math.max(1, properties.getUrlFetchTimeoutSeconds());
            this.httpClient =
                    HttpClient.newBuilder()
                            .connectTimeout(Duration.ofSeconds(timeout))
                            .followRedirects(HttpClient.Redirect.NEVER)
                            .build();
            // 仅在 OkHttp 存在时实例化（该 new 受 OKHTTP_PRESENT 守卫，缺依赖时这行不执行，不会加载 OkHttp 类）。
            this.pinningFetcher =
                    OKHTTP_PRESENT ? new SsrfPinningHttpFetcher(properties, this.ssrfPolicy) : null;
        }
    }

    private static boolean isPresent(String className) {
        try {
            Class.forName(className, false, HttpContentFetcher.class.getClassLoader());
            return true;
        } catch (Throwable t) {
            return false;
        }
    }

    /** 共享底层 {@link HttpClient}，供需要直接发请求的协作者（如 Tavily 搜索）使用。 */
    public HttpClient httpClient() {
        return httpClient;
    }

    /** 共享 SSRF 策略，供协作者在直接发请求前校验目标。 */
    public SsrfPolicy ssrfPolicy() {
        return ssrfPolicy;
    }

    public byte[] fetchBytes(URI uri) throws Exception {
        if (properties.isUrlFetchSsrfProtection()) {
            if (pinningFetcher != null) {
                // OkHttp SSRF-pinning 路径：解析一次 + 逐 IP 校验 + pin 连接（保留 SNI/证书主机名），
                // 关闭 http 与 https 的 DNS 重绑定（TOCTOU）窗口。
                return pinningFetcher.fetch(uri);
            }
            ssrfPolicy.validate(uri);
        }
        int max = Math.max(1024, properties.getUrlFetchMaxBytes());
        URI current = uri;
        for (int hop = 0; hop <= MAX_REDIRECTS; hop++) {
            HttpRequest req = buildRequest(current);
            HttpResponse<InputStream> res =
                    httpClient.send(req, HttpResponse.BodyHandlers.ofInputStream());
            int code = res.statusCode();
            if (code >= 301 && code <= 308 && code != 304) {
                res.body().close();
                String location = res.headers().firstValue("Location").orElse(null);
                if (location == null || location.isBlank()) {
                    throw new IllegalStateException(
                            "Redirect " + code + " without Location header");
                }
                current = current.resolve(location);
                if (properties.isUrlFetchSsrfProtection()) {
                    ssrfPolicy.validate(current);
                }
                continue;
            }
            if (code < 200 || code >= 300) {
                res.body().close();
                throw new IllegalStateException("HTTP " + code);
            }
            try (InputStream bodyStream = res.body()) {
                return bodyStream.readNBytes(max);
            }
        }
        throw new IllegalStateException("Too many redirects (max " + MAX_REDIRECTS + ")");
    }

    /**
     * Builds the GET request for one hop. When {@code url-fetch.pin-resolved-ip} is enabled and the
     * target is plaintext {@code http}, the connection is pinned to the resolved IP literal so the
     * {@link HttpClient} does not re-resolve the hostname (closing the DNS-rebinding TOCTOU window,
     * which matters most for {@code http} cloud-metadata endpoints). The exact pinned IP is
     * re-validated through {@link SsrfPolicy} before use, so we only ever connect to an address
     * that passed the policy. {@code https} is never pinned because that breaks SNI / certificate
     * hostname verification. If the JVM forbids the {@code Host} header (the default unless {@code
     * -Djdk.httpclient.allowRestrictedHeaders=host} is set), pinning is skipped and the request
     * falls back to the normal hostname-based form.
     */
    private HttpRequest buildRequest(URI current) {
        Duration timeout = Duration.ofSeconds(Math.max(1, properties.getUrlFetchTimeoutSeconds()));
        if (properties.isUrlFetchPinResolvedIp()
                && "http".equalsIgnoreCase(current.getScheme())
                && current.getHost() != null
                && !current.getHost().isBlank()) {
            try {
                String ip = firstResolvedIp(current.getHost());
                URI pinned = pinHttpUriToIp(current, ip);
                if (pinned != null && !pinned.equals(current)) {
                    if (properties.isUrlFetchSsrfProtection()) {
                        // Validate the literal IP we will actually connect to (no further DNS).
                        ssrfPolicy.validate(pinned);
                    }
                    String hostHeader =
                            current.getHost()
                                    + (current.getPort() != -1 ? ":" + current.getPort() : "");
                    return HttpRequest.newBuilder(pinned)
                            .timeout(timeout)
                            .header("User-Agent", "AiAssistantUrlFetch/1.0")
                            .header("Host", hostHeader)
                            .GET()
                            .build();
                }
            } catch (IllegalArgumentException restrictedHeaderOrPolicy) {
                // Either the JVM rejected the Host header, or the pinned IP failed SSRF
                // re-validation. Warn once for the header case and fall back to a non-pinned
                // request; a policy failure will be re-raised by the outer validate() below.
                if (warnedPinUnavailable.compareAndSet(false, true)) {
                    log.warn(
                            "url-fetch.pin-resolved-ip is enabled but pinning was skipped ({}). "
                                    + "To pin http connections, start the JVM with "
                                    + "-Djdk.httpclient.allowRestrictedHeaders=host.",
                            restrictedHeaderOrPolicy.getMessage());
                }
            } catch (Exception resolutionFailed) {
                // DNS failure etc. -- fall back to the normal request which will surface the error.
                if (warnedPinUnavailable.compareAndSet(false, true)) {
                    log.warn(
                            "url-fetch.pin-resolved-ip resolution failed, using non-pinned request: {}",
                            resolutionFailed.getMessage());
                }
            }
        }
        return HttpRequest.newBuilder(current)
                .timeout(timeout)
                .header("User-Agent", "AiAssistantUrlFetch/1.0")
                .GET()
                .build();
    }

    /**
     * Resolves the host and returns the first address as a literal, stripping any IPv6 scope id.
     */
    private static String firstResolvedIp(String host) throws Exception {
        InetAddress[] addresses = InetAddress.getAllByName(host);
        if (addresses.length == 0) {
            throw new IllegalStateException("no address for host: " + host);
        }
        String ip = addresses[0].getHostAddress();
        int scope = ip.indexOf('%');
        return scope >= 0 ? ip.substring(0, scope) : ip;
    }

    /**
     * Rewrites an {@code http} URI so the authority is the given IP literal (IPv6 bracketed), while
     * preserving port, path and query. Returns the original URI unchanged for non-http schemes or
     * when inputs are blank, so HTTPS is never pinned (SNI/cert safety). Pure and unit-testable.
     */
    static URI pinHttpUriToIp(URI uri, String ipLiteral) {
        if (uri == null || ipLiteral == null || ipLiteral.isBlank()) {
            return uri;
        }
        if (!"http".equalsIgnoreCase(uri.getScheme())) {
            return uri;
        }
        String authorityHost = ipLiteral.indexOf(':') >= 0 ? "[" + ipLiteral + "]" : ipLiteral;
        StringBuilder sb = new StringBuilder("http://").append(authorityHost);
        if (uri.getPort() != -1) {
            sb.append(':').append(uri.getPort());
        }
        String rawPath = uri.getRawPath();
        sb.append(rawPath == null || rawPath.isEmpty() ? "/" : rawPath);
        if (uri.getRawQuery() != null) {
            sb.append('?').append(uri.getRawQuery());
        }
        return URI.create(sb.toString());
    }

    public static Charset sniffCharset(byte[] body, URI uri) {
        String head = new String(body, 0, Math.min(body.length, 8192), StandardCharsets.ISO_8859_1);
        Matcher cm = CHARSET_ATTR.matcher(head);
        if (cm.find()) {
            try {
                return Charset.forName(cm.group(1).trim());
            } catch (Exception ignored) {
            }
        }
        return StandardCharsets.UTF_8;
    }

    public String getCachedText(URI uri) {
        int ttl = properties.getUrlFetchCacheTtlSeconds();
        if (ttl <= 0) {
            return null;
        }
        String key = uri.toString();
        CacheEntry e = fetchCache.get(key);
        if (e == null) {
            return null;
        }
        if (Instant.now().isAfter(e.expires)) {
            fetchCache.remove(key);
            return null;
        }
        return e.text;
    }

    public synchronized void putCachedText(URI uri, String text) {
        int ttl = properties.getUrlFetchCacheTtlSeconds();
        if (ttl <= 0) {
            return;
        }
        int maxEntries = Math.max(4, properties.getUrlFetchCacheMaxEntries());
        if (fetchCache.size() >= maxEntries) {
            Instant now = Instant.now();
            fetchCache.entrySet().removeIf(e -> now.isAfter(e.getValue().expires));
        }
        if (fetchCache.size() >= maxEntries) {
            var it = fetchCache.entrySet().iterator();
            if (it.hasNext()) {
                it.next();
                it.remove();
            }
        }
        fetchCache.put(uri.toString(), new CacheEntry(text, Instant.now().plusSeconds(ttl)));
    }

    private record CacheEntry(String text, Instant expires) {}
}
