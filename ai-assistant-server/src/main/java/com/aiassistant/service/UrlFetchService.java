package com.aiassistant.service;

import static com.aiassistant.util.HtmlTextExtractor.htmlToPlain;

import com.aiassistant.config.AiAssistantProperties;
import com.aiassistant.model.UrlPreviewResponse;
import com.aiassistant.security.DefaultSsrfPolicy;
import com.aiassistant.security.SsrfPolicy;
import java.net.URI;
import java.net.http.HttpClient;
import java.nio.charset.Charset;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * URL 抓取门面：把外网抓取能力按职责拆分到 {@link HttpContentFetcher}（核心 SSRF 安全抓取 + 正文缓存）、 {@link
 * WebSearchService}（网页搜索）与 {@link UrlPreviewService}（链接预览 + 配图打分）。
 *
 * <p>本类保留历史公开 API 并委托给上述服务，保证既有调用方与自动装配无需改动；用户消息 URL 正文增强 {@link #enrichUserMessage} 仍在本门面内编排（复用共享的
 * {@link HttpContentFetcher}）。
 *
 * @see HttpContentFetcher
 * @see WebSearchService
 * @see UrlPreviewService
 * @author houmy01
 */
public class UrlFetchService {

    private static final Logger log = LoggerFactory.getLogger(UrlFetchService.class);

    private static final Pattern URL_IN_TEXT =
            Pattern.compile("https?://[^\\s<>\"()\\[\\]{}]+", Pattern.CASE_INSENSITIVE);

    private static final int MAX_URLS_TO_ENRICH = 3;

    private static final ExecutorService URL_FETCH_POOL =
            Executors.newVirtualThreadPerTaskExecutor();

    private final AiAssistantProperties properties;
    private final HttpContentFetcher fetcher;
    private final WebSearchService webSearchService;
    private final UrlPreviewService urlPreviewService;
    private volatile HeadlessFetcher headlessFetchService;

    public UrlFetchService(AiAssistantProperties properties) {
        this(properties, null, DefaultSsrfPolicy.INSTANCE);
    }

    public UrlFetchService(AiAssistantProperties properties, HttpClient httpClient) {
        this(properties, httpClient, DefaultSsrfPolicy.INSTANCE);
    }

    public UrlFetchService(
            AiAssistantProperties properties, HttpClient httpClient, SsrfPolicy ssrfPolicy) {
        this.properties = properties;
        this.fetcher = new HttpContentFetcher(properties, httpClient, ssrfPolicy);
        this.webSearchService = new WebSearchService(properties, fetcher);
        this.urlPreviewService = new UrlPreviewService(properties, fetcher);
    }

    public void setHeadlessFetchService(HeadlessFetcher headlessFetchService) {
        this.headlessFetchService = headlessFetchService;
        this.urlPreviewService.setHeadlessFetchService(headlessFetchService);
    }

    public UrlPreviewResponse previewUrl(String url) {
        return urlPreviewService.previewUrl(url);
    }

    public String searchWebAsMarkdown(String query) {
        return webSearchService.searchWebAsMarkdown(query);
    }

    public WebSearchResult searchWeb(String query) {
        return webSearchService.searchWeb(query);
    }

    public Map<String, Object> webSearchStats() {
        return webSearchService.webSearchStats();
    }

    public Map<String, Object> probeWebSearchProvider() {
        return webSearchService.probeWebSearchProvider();
    }

    /** 若用户正文中含 http(s) 链接，抓取所有可解析 URL 的正文并附在消息后（有长度上限）。 */
    public String enrichUserMessage(String text) throws Exception {
        if (text == null || !properties.isUrlFetchEnabled()) {
            return text;
        }
        Matcher m = URL_IN_TEXT.matcher(text);
        List<String> urls = new ArrayList<>();
        while (m.find() && urls.size() < MAX_URLS_TO_ENRICH) {
            String url = m.group();
            try {
                URI uri = URI.create(url);
                if (uri.getScheme() != null
                        && List.of("http", "https")
                                .contains(uri.getScheme().toLowerCase(Locale.ROOT))) {
                    urls.add(url);
                }
            } catch (Exception ignored) {
            }
        }
        if (urls.isEmpty()) {
            return text;
        }

        int injectCap = Math.max(0, properties.getUrlFetchMaxCharsInjected());

        List<CompletableFuture<String>> futures =
                urls.stream()
                        .map(
                                url ->
                                        CompletableFuture.supplyAsync(
                                                () -> {
                                                    try {
                                                        URI uri = URI.create(url);
                                                        String cached = fetcher.getCachedText(uri);
                                                        String extracted;
                                                        if (cached != null) {
                                                            extracted = cached;
                                                        } else {
                                                            byte[] raw = fetcher.fetchBytes(uri);
                                                            Charset cs =
                                                                    HttpContentFetcher.sniffCharset(
                                                                            raw, uri);
                                                            String html = new String(raw, cs);
                                                            extracted = htmlToPlain(html);
                                                            if (extracted.length() < 200
                                                                    && headlessFetchService
                                                                            != null) {
                                                                HeadlessFetcher.Result hr =
                                                                        headlessFetchService.fetch(
                                                                                url);
                                                                if (!hr.text().isBlank()) {
                                                                    extracted = hr.text();
                                                                }
                                                            }
                                                            fetcher.putCachedText(uri, extracted);
                                                        }
                                                        if (injectCap > 0
                                                                && extracted.length() > injectCap) {
                                                            extracted =
                                                                    extracted.substring(
                                                                                    0, injectCap)
                                                                            + "\n…[truncated]";
                                                        }
                                                        return "\n\n--- fetched: "
                                                                + url
                                                                + " ---\n"
                                                                + extracted;
                                                    } catch (Exception e) {
                                                        log.debug(
                                                                "Failed to enrich URL {}: {}",
                                                                url,
                                                                e.getMessage());
                                                        return "";
                                                    }
                                                },
                                                URL_FETCH_POOL))
                        .toList();

        StringBuilder sb = new StringBuilder(text);
        for (CompletableFuture<String> f : futures) {
            try {
                String result = f.join();
                if (!result.isEmpty()) sb.append(result);
            } catch (Exception e) {
                log.debug("URL enrichment future failed: {}", e.getMessage());
            }
        }
        return sb.toString();
    }
}
