package com.aiassistant.service;

import com.aiassistant.config.AiAssistantProperties;
import com.aiassistant.security.DefaultSsrfPolicy;
import com.aiassistant.security.SsrfPolicy;
import java.io.InputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

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

    private static final Pattern CHARSET_ATTR =
            Pattern.compile("charset=([a-zA-Z0-9._-]+)", Pattern.CASE_INSENSITIVE);

    private final AiAssistantProperties properties;
    private final HttpClient httpClient;
    private final SsrfPolicy ssrfPolicy;
    private final ConcurrentHashMap<String, CacheEntry> fetchCache = new ConcurrentHashMap<>();

    public HttpContentFetcher(
            AiAssistantProperties properties, HttpClient httpClient, SsrfPolicy ssrfPolicy) {
        this.properties = properties;
        this.ssrfPolicy = ssrfPolicy != null ? ssrfPolicy : DefaultSsrfPolicy.INSTANCE;
        if (httpClient != null) {
            this.httpClient = httpClient;
        } else {
            int timeout = Math.max(1, properties.getUrlFetchTimeoutSeconds());
            this.httpClient =
                    HttpClient.newBuilder()
                            .connectTimeout(Duration.ofSeconds(timeout))
                            .followRedirects(HttpClient.Redirect.NEVER)
                            .build();
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
            ssrfPolicy.validate(uri);
        }
        int max = Math.max(1024, properties.getUrlFetchMaxBytes());
        URI current = uri;
        for (int hop = 0; hop <= MAX_REDIRECTS; hop++) {
            HttpRequest req =
                    HttpRequest.newBuilder(current)
                            .timeout(
                                    Duration.ofSeconds(
                                            Math.max(1, properties.getUrlFetchTimeoutSeconds())))
                            .header("User-Agent", "AiAssistantUrlFetch/1.0")
                            .GET()
                            .build();
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
