package com.aiassistant.service;

import java.time.Instant;
import java.util.List;

/**
 * 一次网页搜索的结果，含 markdown 摘要、来源列表、失败原因与各阶段耗时。
 *
 * <p>原先是 {@link UrlFetchService} 的内部 record，为支持 web 搜索能力按服务拆分（fetch / preview / search），提升为独立顶层类型，供
 * {@link WebSearchService}、{@link UrlFetchService} 门面以及下游 Controller / 响应模型共享引用。
 *
 * @author houmy01
 */
public record WebSearchResult(
        String markdown,
        String provider,
        boolean fallback,
        int resultCount,
        Instant searchedAt,
        List<String> sourceUrls,
        List<SearchSource> sources,
        String failureReason,
        long durationMs,
        long stableProviderDurationMs,
        long fallbackDurationMs) {
    public WebSearchResult(
            String markdown,
            String provider,
            boolean fallback,
            int resultCount,
            Instant searchedAt) {
        this(markdown, provider, fallback, resultCount, searchedAt, List.of());
    }

    public static WebSearchResult empty() {
        return new WebSearchResult("", "", false, 0, null, List.of(), List.of(), "", -1, -1, -1);
    }

    public static WebSearchResult emptyAttempt(String provider, boolean fallback) {
        return emptyAttempt(provider, fallback, "no_results");
    }

    public static WebSearchResult emptyAttempt(
            String provider, boolean fallback, String failureReason) {
        return new WebSearchResult(
                "",
                provider,
                fallback,
                0,
                Instant.now(),
                List.of(),
                List.of(),
                failureReason,
                -1,
                -1,
                -1);
    }

    public WebSearchResult(
            String markdown,
            String provider,
            boolean fallback,
            int resultCount,
            Instant searchedAt,
            List<String> sourceUrls) {
        this(markdown, provider, fallback, resultCount, searchedAt, sourceUrls, List.of());
    }

    public WebSearchResult(
            String markdown,
            String provider,
            boolean fallback,
            int resultCount,
            Instant searchedAt,
            List<String> sourceUrls,
            List<SearchSource> sources) {
        this(
                markdown,
                provider,
                fallback,
                resultCount,
                searchedAt,
                sourceUrls,
                sources,
                "",
                -1,
                -1,
                -1);
    }

    public WebSearchResult withTimings(
            long durationMs, long stableProviderDurationMs, long fallbackDurationMs) {
        return new WebSearchResult(
                markdown,
                provider,
                fallback,
                resultCount,
                searchedAt,
                sourceUrls == null ? List.of() : sourceUrls,
                sources == null ? List.of() : sources,
                failureReason,
                durationMs,
                stableProviderDurationMs,
                fallbackDurationMs);
    }

    public boolean hasAttempt() {
        return provider != null && !provider.isBlank();
    }

    public boolean hasResults() {
        return markdown != null && !markdown.isBlank() && resultCount > 0;
    }
}
