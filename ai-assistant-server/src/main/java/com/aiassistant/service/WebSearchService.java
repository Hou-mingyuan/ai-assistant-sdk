package com.aiassistant.service;

import static com.aiassistant.util.HtmlTextExtractor.stripTags;

import com.aiassistant.config.AiAssistantProperties;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * 轻量网页搜索服务：优先稳定供应商（Tavily），失败回退 DuckDuckGo HTML 抓取，结果转成简洁 markdown 供注入 prompt。
 *
 * <p>从原 {@link UrlFetchService} 拆出，底层抓取复用共享的 {@link HttpContentFetcher}（SSRF 安全抓取与 字符集嗅探）。
 *
 * @author houmy01
 */
public class WebSearchService {

    private static final Logger log = LoggerFactory.getLogger(WebSearchService.class);

    private static final Pattern DDG_RESULT_LINK =
            Pattern.compile(
                    "<a[^>]+class=[\"'][^\"']*result__a[^\"']*[\"'][^>]+href=[\"']([^\"']+)[\"'][^>]*>(.*?)</a>",
                    Pattern.CASE_INSENSITIVE | Pattern.DOTALL);
    private static final Pattern DDG_SNIPPET =
            Pattern.compile(
                    "<a[^>]+class=[\"'][^\"']*result__snippet[^\"']*[\"'][^>]*>(.*?)</a>",
                    Pattern.CASE_INSENSITIVE | Pattern.DOTALL);

    private static final int WEB_SEARCH_QUERY_MAX_CHARS = 180;
    private static final int WEB_SEARCH_STABLE_PROVIDER_TIMEOUT_SECONDS = 8;
    private static final ObjectMapper SEARCH_MAPPER = new ObjectMapper();

    private final AiAssistantProperties properties;
    private final HttpContentFetcher fetcher;
    private final ConcurrentHashMap<String, SearchCacheEntry> searchCache =
            new ConcurrentHashMap<>();
    private final AtomicLong webSearchAttempts = new AtomicLong();
    private final AtomicLong webSearchSuccesses = new AtomicLong();
    private final AtomicLong webSearchFallbacks = new AtomicLong();
    private final AtomicLong webSearchNoResults = new AtomicLong();
    private final AtomicLong webSearchProviderFailures = new AtomicLong();
    private final AtomicLong webSearchTotalDurationMs = new AtomicLong();

    public WebSearchService(AiAssistantProperties properties, HttpContentFetcher fetcher) {
        this.properties = properties;
        this.fetcher = fetcher;
    }

    public String searchWebAsMarkdown(String query) {
        return searchWeb(query).markdown();
    }

    public WebSearchResult searchWeb(String query) {
        if (query == null || query.isBlank()) {
            return WebSearchResult.empty();
        }
        long started = System.nanoTime();
        String normalizedQuery = normalizeWebSearchQuery(query);
        if (normalizedQuery.isBlank()) {
            return WebSearchResult.empty();
        }
        String provider =
                properties.getUrlFetch().getWebSearchProvider() == null
                        ? "duckduckgo"
                        : properties
                                .getUrlFetch()
                                .getWebSearchProvider()
                                .trim()
                                .toLowerCase(Locale.ROOT);
        String cacheKey = searchCacheKey(provider, normalizedQuery);
        WebSearchResult cached = getCachedSearch(cacheKey);
        if (cached != null) {
            return cached;
        }
        boolean stableProviderAttempted =
                "tavily".equals(provider) && hasText(properties.getUrlFetch().getWebSearchApiKey());
        long stableDurationMs = -1;
        long fallbackDurationMs = -1;
        WebSearchResult result;
        if (stableProviderAttempted) {
            long stableStarted = System.nanoTime();
            WebSearchResult tavily = searchTavily(normalizedQuery);
            stableDurationMs = elapsedMs(stableStarted);
            if (tavily.hasResults()) {
                tavily =
                        tavily.withTimings(
                                elapsedMs(started), stableDurationMs, fallbackDurationMs);
                recordWebSearchStats(tavily);
                putCachedSearch(cacheKey, tavily);
                return tavily;
            }
        }
        long fallbackStarted = System.nanoTime();
        result = searchDuckDuckGo(normalizedQuery, stableProviderAttempted);
        fallbackDurationMs = elapsedMs(fallbackStarted);
        result = result.withTimings(elapsedMs(started), stableDurationMs, fallbackDurationMs);
        recordWebSearchStats(result);
        putCachedSearch(cacheKey, result);
        return result;
    }

    private WebSearchResult searchDuckDuckGo(String query, boolean fallbackFromStableProvider) {
        String provider = fallbackFromStableProvider ? "DuckDuckGo fallback" : "DuckDuckGo";
        try {
            String encoded = URLEncoder.encode(query.trim(), StandardCharsets.UTF_8);
            URI uri = URI.create("https://duckduckgo.com/html/?q=" + encoded);
            byte[] body = fetcher.fetchBytes(uri);
            if (body.length == 0) {
                return WebSearchResult.emptyAttempt(provider, fallbackFromStableProvider);
            }
            String html = new String(body, HttpContentFetcher.sniffCharset(body, uri));
            int maxResults =
                    Math.max(1, Math.min(10, properties.getUrlFetch().getWebSearchMaxResults()));
            List<SearchHit> hits = parseDuckDuckGoResults(html, maxResults);
            if (hits.isEmpty()) {
                return WebSearchResult.emptyAttempt(
                        provider, fallbackFromStableProvider, "no_results");
            }
            StringBuilder sb = newSearchMarkdown(provider, query);
            for (int i = 0; i < hits.size(); i++) {
                SearchHit hit = hits.get(i);
                sb.append('\n')
                        .append(i + 1)
                        .append(". ")
                        .append(hit.title())
                        .append('\n')
                        .append("   URL: ")
                        .append(hit.url())
                        .append('\n');
                sb.append("   质量：").append(hit.qualityLabel()).append('\n');
                if (!hit.snippet().isBlank()) {
                    sb.append("   摘要: ").append(hit.snippet()).append('\n');
                }
            }
            return new WebSearchResult(
                    sb.toString(),
                    provider,
                    fallbackFromStableProvider,
                    hits.size(),
                    Instant.now(),
                    hits.stream().map(SearchHit::url).toList(),
                    hits.stream().map(SearchHit::toSource).toList());
        } catch (Exception e) {
            log.debug("Web search failed for query '{}': {}", query, e.getMessage());
            return WebSearchResult.emptyAttempt(
                    provider, fallbackFromStableProvider, "provider_failed");
        }
    }

    private String normalizeWebSearchQuery(String query) {
        if (query == null) {
            return "";
        }
        String normalized = query.trim().replaceAll("\\s+", " ");
        if (normalized.length() <= WEB_SEARCH_QUERY_MAX_CHARS) {
            return normalized;
        }
        return normalized.substring(0, WEB_SEARCH_QUERY_MAX_CHARS).trim();
    }

    private WebSearchResult searchTavily(String query) {
        try {
            String endpoint =
                    hasText(properties.getUrlFetch().getWebSearchEndpoint())
                            ? properties.getUrlFetch().getWebSearchEndpoint()
                            : "https://api.tavily.com/search";
            URI endpointUri = URI.create(endpoint);
            if (properties.isUrlFetchSsrfProtection()) {
                fetcher.ssrfPolicy().validate(endpointUri);
            }
            int maxResults =
                    Math.max(1, Math.min(10, properties.getUrlFetch().getWebSearchMaxResults()));
            String body =
                    SEARCH_MAPPER.writeValueAsString(
                            Map.of(
                                    "api_key",
                                    properties.getUrlFetch().getWebSearchApiKey(),
                                    "query",
                                    query.trim(),
                                    "search_depth",
                                    "basic",
                                    "max_results",
                                    maxResults));
            HttpRequest request =
                    HttpRequest.newBuilder(endpointUri)
                            .timeout(
                                    Duration.ofSeconds(
                                            Math.min(
                                                    WEB_SEARCH_STABLE_PROVIDER_TIMEOUT_SECONDS,
                                                    Math.max(
                                                            1,
                                                            properties
                                                                    .getUrlFetchTimeoutSeconds()))))
                            .header("Content-Type", "application/json")
                            .header("User-Agent", "AiAssistantWebSearch/1.0")
                            .POST(HttpRequest.BodyPublishers.ofString(body, StandardCharsets.UTF_8))
                            .build();
            HttpResponse<String> response =
                    fetcher.httpClient().send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                throw new IllegalStateException("HTTP " + response.statusCode());
            }
            JsonNode root = SEARCH_MAPPER.readTree(response.body());
            JsonNode results = root.path("results");
            if (!results.isArray() || results.isEmpty()) {
                return WebSearchResult.emptyAttempt("Tavily", false);
            }
            StringBuilder sb = newSearchMarkdown("Tavily", query);
            int index = 1;
            List<String> sourceUrls = new ArrayList<>();
            List<SearchSource> sources = new ArrayList<>();
            Set<String> seenUrls = new LinkedHashSet<>();
            for (JsonNode item : results) {
                String title = item.path("title").asText("");
                String url = item.path("url").asText("");
                String content = item.path("content").asText("");
                content = safeSearchSnippet(content);
                String publishedDate = item.path("published_date").asText("");
                if (!hasText(title) || !hasText(url)) continue;
                if (!seenUrls.add(canonicalSearchSourceKey(url))) continue;
                if (!isSearchSourceDomainAllowed(url)) continue;
                SearchQuality quality = scoreSearchSource(title, url, content);
                sourceUrls.add(url);
                sb.append('\n').append(index++).append(". ").append(title).append('\n');
                sb.append("   URL: ").append(url).append('\n');
                sb.append("   质量：").append(quality.label()).append('\n');
                if (hasText(publishedDate)) sb.append("   时间: ").append(publishedDate).append('\n');
                if (hasText(content)) sb.append("   摘要: ").append(content).append('\n');
                sources.add(
                        new SearchSource(title, url, content, quality.score(), quality.label()));
                if (index > maxResults) break;
            }
            int resultCount = index - 1;
            return resultCount == 0
                    ? WebSearchResult.emptyAttempt("Tavily", false, "no_results")
                    : new WebSearchResult(
                            sb.toString(),
                            "Tavily",
                            false,
                            resultCount,
                            Instant.now(),
                            sourceUrls,
                            sources);
        } catch (Exception e) {
            log.debug("Tavily web search failed for query '{}': {}", query, e.getMessage());
            return WebSearchResult.emptyAttempt("Tavily", false, "provider_failed");
        }
    }

    private StringBuilder newSearchMarkdown(String provider, String query) {
        StringBuilder sb = new StringBuilder("# 联网搜索结果\n");
        sb.append("来源：").append(provider).append('\n');
        sb.append("检索时间：").append(Instant.now()).append('\n');
        sb.append("查询：").append(query.trim()).append('\n');
        sb.append("引用要求：回答中如使用搜索信息，请用 [1] 这样的编号引用来源。\n");
        return sb;
    }

    private List<SearchHit> parseDuckDuckGoResults(String html, int limit) {
        List<String> snippets = new ArrayList<>();
        Matcher sm = DDG_SNIPPET.matcher(html);
        while (sm.find() && snippets.size() < limit) {
            snippets.add(stripTags(sm.group(1)).trim());
        }
        List<SearchHit> hits = new ArrayList<>();
        Set<String> seenUrls = new LinkedHashSet<>();
        Matcher lm = DDG_RESULT_LINK.matcher(html);
        while (lm.find() && hits.size() < limit) {
            String url = normalizeDuckDuckGoUrl(stripTags(lm.group(1)).trim());
            String title = stripTags(lm.group(2)).trim();
            if (url.isBlank() || title.isBlank()) continue;
            if (!seenUrls.add(canonicalSearchSourceKey(url))) continue;
            if (!isSearchSourceDomainAllowed(url)) continue;
            String snippet =
                    hits.size() < snippets.size()
                            ? safeSearchSnippet(snippets.get(hits.size()))
                            : "";
            SearchQuality quality = scoreSearchSource(title, url, snippet);
            hits.add(new SearchHit(title, url, snippet, quality.score(), quality.label()));
        }
        hits.sort(Comparator.comparingInt(SearchHit::qualityScore).reversed());
        return hits;
    }

    private String normalizeDuckDuckGoUrl(String raw) {
        try {
            URI uri = URI.create(raw);
            String query = uri.getRawQuery();
            if (query != null) {
                for (String part : query.split("&")) {
                    if (part.startsWith("uddg=")) {
                        return java.net.URLDecoder.decode(
                                part.substring("uddg=".length()), StandardCharsets.UTF_8);
                    }
                }
            }
        } catch (Exception ignored) {
        }
        return raw;
    }

    private boolean hasText(String value) {
        return value != null && !value.isBlank();
    }

    public Map<String, Object> webSearchStats() {
        long attempts = webSearchAttempts.get();
        long totalMs = webSearchTotalDurationMs.get();
        return Map.of(
                "attempts", attempts,
                "successes", webSearchSuccesses.get(),
                "fallbacks", webSearchFallbacks.get(),
                "noResults", webSearchNoResults.get(),
                "providerFailures", webSearchProviderFailures.get(),
                "averageDurationMs", attempts == 0 ? 0 : totalMs / attempts);
    }

    public Map<String, Object> probeWebSearchProvider() {
        String provider = properties.getUrlFetch().getWebSearchProvider();
        String normalizedProvider =
                provider == null || provider.isBlank()
                        ? "duckduckgo"
                        : provider.trim().toLowerCase(Locale.ROOT);
        boolean configured =
                !"tavily".equals(normalizedProvider)
                        || hasText(properties.getUrlFetch().getWebSearchApiKey());
        if (!configured) {
            return Map.of(
                    "provider",
                    normalizedProvider,
                    "configured",
                    false,
                    "status",
                    "missing_key",
                    "resultCount",
                    0);
        }
        WebSearchResult result = searchWeb("AI assistant connectivity check");
        String status =
                result.hasResults()
                        ? "ok"
                        : hasText(result.failureReason()) ? result.failureReason() : "no_results";
        return Map.of(
                "provider",
                normalizedProvider,
                "configured",
                true,
                "status",
                status,
                "resultCount",
                result.resultCount(),
                "durationMs",
                Math.max(0, result.durationMs()));
    }

    private void recordWebSearchStats(WebSearchResult result) {
        if (result == null || !result.hasAttempt()) {
            return;
        }
        webSearchAttempts.incrementAndGet();
        if (result.hasResults()) {
            webSearchSuccesses.incrementAndGet();
        }
        if (result.fallback()) {
            webSearchFallbacks.incrementAndGet();
        }
        if ("no_results".equals(result.failureReason())) {
            webSearchNoResults.incrementAndGet();
        } else if ("provider_failed".equals(result.failureReason())) {
            webSearchProviderFailures.incrementAndGet();
        }
        if (result.durationMs() >= 0) {
            webSearchTotalDurationMs.addAndGet(result.durationMs());
        }
    }

    private static String safeSearchSnippet(String raw) {
        if (raw == null || raw.isBlank()) {
            return "";
        }
        String redacted =
                raw.replaceAll(
                        "(?i)(api[_-]?key|token|secret|password)\\s*[:=]\\s*[^\\s,;]+",
                        "$1=[redacted]");
        return redacted.length() > 240 ? redacted.substring(0, 240).trim() + "…" : redacted;
    }

    private static long elapsedMs(long startedNanos) {
        return Math.max(0, Duration.ofNanos(System.nanoTime() - startedNanos).toMillis());
    }

    private static SearchQuality scoreSearchSource(String title, String url, String snippet) {
        int score = 50;
        String label = "general";
        String text =
                ((title == null ? "" : title)
                                + " "
                                + (url == null ? "" : url)
                                + " "
                                + (snippet == null ? "" : snippet))
                        .toLowerCase(Locale.ROOT);
        String host = "";
        String path = "";
        try {
            URI uri = URI.create(url);
            host = uri.getHost() == null ? "" : uri.getHost().toLowerCase(Locale.ROOT);
            path = uri.getPath() == null ? "" : uri.getPath().toLowerCase(Locale.ROOT);
        } catch (Exception ignored) {
        }
        if (host.startsWith("docs.") || path.contains("/docs") || path.contains("/api")) {
            score += 45;
            label = "docs";
        } else if (host.endsWith(".gov") || host.endsWith(".edu") || text.contains("official")) {
            score += 35;
            label = "official";
        } else if (host.contains("news") || path.contains("/news") || text.contains("news")) {
            score += 25;
            label = "news";
        }
        if (text.contains("reference") || text.contains("documentation")) {
            score += 18;
            if ("general".equals(label)) label = "docs";
        }
        if (text.contains("blog") || text.contains("repost") || text.contains("forum")) {
            score -= 12;
        }
        return new SearchQuality(score, label);
    }

    private boolean isSearchSourceDomainAllowed(String url) {
        String host = "";
        try {
            URI uri = URI.create(url);
            host = uri.getHost() == null ? "" : uri.getHost().toLowerCase(Locale.ROOT);
        } catch (Exception ignored) {
        }
        if (host.isBlank()) {
            return false;
        }
        List<String> blocked =
                parseDomainList(properties.getUrlFetch().getWebSearchBlockedDomains());
        if (blocked.stream().anyMatch(host::endsWith)) {
            return false;
        }
        List<String> allowed =
                parseDomainList(properties.getUrlFetch().getWebSearchAllowedDomains());
        return allowed.isEmpty() || allowed.stream().anyMatch(host::endsWith);
    }

    private static String canonicalSearchSourceKey(String url) {
        try {
            URI uri = URI.create(url);
            String host = uri.getHost() == null ? "" : uri.getHost().toLowerCase(Locale.ROOT);
            String path = uri.getPath() == null ? "" : uri.getPath();
            String query = uri.getRawQuery();
            String stableQuery = "";
            if (query != null) {
                stableQuery =
                        java.util.Arrays.stream(query.split("&"))
                                .filter(part -> !part.toLowerCase(Locale.ROOT).startsWith("utm_"))
                                .sorted()
                                .collect(java.util.stream.Collectors.joining("&"));
            }
            return host + path + (stableQuery.isBlank() ? "" : "?" + stableQuery);
        } catch (Exception ignored) {
            return url == null ? "" : url;
        }
    }

    private static List<String> parseDomainList(String raw) {
        if (raw == null || raw.isBlank()) {
            return List.of();
        }
        return java.util.Arrays.stream(raw.split(","))
                .map(part -> part.trim().toLowerCase(Locale.ROOT))
                .filter(part -> !part.isBlank())
                .toList();
    }

    private String searchCacheKey(String provider, String query) {
        return String.join(
                "|",
                provider == null ? "" : provider,
                String.valueOf(properties.getUrlFetch().getWebSearchMaxResults()),
                properties.getUrlFetch().getWebSearchEndpoint() == null
                        ? ""
                        : properties.getUrlFetch().getWebSearchEndpoint(),
                query);
    }

    private WebSearchResult getCachedSearch(String key) {
        int ttl = properties.getUrlFetchCacheTtlSeconds();
        if (ttl <= 0) {
            return null;
        }
        SearchCacheEntry entry = searchCache.get(key);
        if (entry == null) {
            return null;
        }
        if (Instant.now().isAfter(entry.expires())) {
            searchCache.remove(key);
            return null;
        }
        return entry.result();
    }

    private synchronized void putCachedSearch(String key, WebSearchResult result) {
        int ttl = properties.getUrlFetchCacheTtlSeconds();
        if (ttl <= 0 || result == null || !result.hasAttempt()) {
            return;
        }
        int maxEntries = Math.max(4, properties.getUrlFetchCacheMaxEntries());
        if (searchCache.size() >= maxEntries) {
            Instant now = Instant.now();
            searchCache.entrySet().removeIf(e -> now.isAfter(e.getValue().expires()));
        }
        if (searchCache.size() >= maxEntries) {
            var it = searchCache.entrySet().iterator();
            if (it.hasNext()) {
                it.next();
                it.remove();
            }
        }
        searchCache.put(key, new SearchCacheEntry(result, Instant.now().plusSeconds(ttl)));
    }

    private record SearchQuality(int score, String label) {}

    private record SearchHit(
            String title, String url, String snippet, int qualityScore, String qualityLabel) {
        SearchSource toSource() {
            return new SearchSource(title, url, snippet, qualityScore, qualityLabel);
        }
    }

    private record SearchCacheEntry(WebSearchResult result, Instant expires) {}
}
