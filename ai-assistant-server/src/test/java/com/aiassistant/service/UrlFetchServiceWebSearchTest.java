package com.aiassistant.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.aiassistant.config.AiAssistantProperties;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.Authenticator;
import java.net.CookieHandler;
import java.net.ProxySelector;
import java.net.URI;
import java.net.URLDecoder;
import java.net.http.HttpClient;
import java.net.http.HttpHeaders;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Queue;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.Executor;
import javax.net.ssl.SSLContext;
import javax.net.ssl.SSLParameters;
import javax.net.ssl.SSLSession;
import org.junit.jupiter.api.Test;

class UrlFetchServiceWebSearchTest {

    @Test
    void searchWebAsMarkdownMarksTavilyAsStablePrimarySource() {
        RecordingHttpClient httpClient =
                new RecordingHttpClient()
                        .queueString(
                                200,
                                """
                                {
                                  "results": [
                                    {
                                      "title": "Stable result",
                                      "url": "https://example.com/stable",
                                      "content": "Fresh indexed summary"
                                    }
                                  ]
                                }
                                """);
        AiAssistantProperties properties = new AiAssistantProperties();
        properties.getUrlFetch().setWebSearchProvider("tavily");
        properties.getUrlFetch().setWebSearchApiKey("tvly-test");
        properties.getUrlFetch().setWebSearchMaxResults(3);

        UrlFetchService.WebSearchResult result =
                new UrlFetchService(properties, httpClient, uri -> {}).searchWeb("AI news");

        assertThat(result.provider()).isEqualTo("Tavily");
        assertThat(result.fallback()).isFalse();
        assertThat(result.resultCount()).isEqualTo(1);
        assertThat(result.markdown())
                .contains("# 联网搜索结果")
                .contains("来源：Tavily")
                .contains("检索时间：")
                .contains("查询：AI news")
                .contains("Stable result")
                .contains("https://example.com/stable")
                .contains("Fresh indexed summary");
        assertThat(result.sourceUrls()).containsExactly("https://example.com/stable");
        assertThat(httpClient.requests()).hasSize(1);
        assertThat(httpClient.requests().get(0).method()).isEqualTo("POST");
    }

    @Test
    void searchWebAsMarkdownFallsBackToDuckDuckGoWhenStableProviderFails() {
        RecordingHttpClient httpClient =
                new RecordingHttpClient()
                        .queueString(500, "{\"error\":\"upstream unavailable\"}")
                        .queueInputStream(
                                200,
                                """
                                <html>
                                  <body>
                                    <a class="result__snippet">Fallback summary</a>
                                    <a class="result__a" href="https://fallback.example/news">
                                      Fallback result
                                    </a>
                                  </body>
                                </html>
                                """);
        AiAssistantProperties properties = new AiAssistantProperties();
        properties.getUrlFetch().setWebSearchProvider("tavily");
        properties.getUrlFetch().setWebSearchApiKey("tvly-test");

        UrlFetchService.WebSearchResult result =
                new UrlFetchService(properties, httpClient, uri -> {}).searchWeb("current topic");

        assertThat(result.provider()).isEqualTo("DuckDuckGo fallback");
        assertThat(result.fallback()).isTrue();
        assertThat(result.resultCount()).isEqualTo(1);
        assertThat(result.markdown())
                .contains("来源：DuckDuckGo fallback")
                .contains("查询：current topic")
                .contains("Fallback result")
                .contains("https://fallback.example/news")
                .contains("Fallback summary");
        assertThat(result.sourceUrls()).containsExactly("https://fallback.example/news");
        assertThat(httpClient.requests()).hasSize(2);
        assertThat(httpClient.requests().get(0).method()).isEqualTo("POST");
        assertThat(httpClient.requests().get(1).method()).isEqualTo("GET");
    }

    @Test
    void searchWebAsMarkdownValidatesConfiguredStableProviderEndpointBeforeRequest() {
        RecordingHttpClient httpClient =
                new RecordingHttpClient()
                        .queueInputStream(
                                200,
                                """
                                <html>
                                  <body>
                                    <a class="result__snippet">Safe fallback summary</a>
                                    <a class="result__a" href="https://fallback.example/safe">
                                      Safe fallback result
                                    </a>
                                  </body>
                                </html>
                                """);
        AiAssistantProperties properties = new AiAssistantProperties();
        properties.getUrlFetch().setWebSearchProvider("tavily");
        properties.getUrlFetch().setWebSearchApiKey("tvly-test");
        properties.getUrlFetch().setWebSearchEndpoint("http://blocked.search/search");

        UrlFetchService.WebSearchResult result =
                new UrlFetchService(
                                properties,
                                httpClient,
                                uri -> {
                                    if ("blocked.search".equals(uri.getHost())) {
                                        throw new IllegalArgumentException("blocked endpoint");
                                    }
                                })
                        .searchWeb("current topic");

        assertThat(result.provider()).isEqualTo("DuckDuckGo fallback");
        assertThat(result.fallback()).isTrue();
        assertThat(result.resultCount()).isEqualTo(1);
        assertThat(result.markdown())
                .contains("来源：DuckDuckGo fallback")
                .contains("Safe fallback result")
                .contains("https://fallback.example/safe")
                .doesNotContain("Should not request blocked endpoint");
        assertThat(httpClient.requests()).hasSize(1);
        assertThat(httpClient.requests().get(0).method()).isEqualTo("GET");
        assertThat(httpClient.requests().get(0).uri().getHost()).isEqualTo("duckduckgo.com");
    }

    @Test
    void searchWebReturnsAttemptMetadataWhenFallbackFindsNoResults() {
        RecordingHttpClient httpClient =
                new RecordingHttpClient()
                        .queueString(500, "{\"error\":\"upstream unavailable\"}")
                        .queueInputStream(200, "<html><body>No usable search results</body></html>");
        AiAssistantProperties properties = new AiAssistantProperties();
        properties.getUrlFetch().setWebSearchProvider("tavily");
        properties.getUrlFetch().setWebSearchApiKey("tvly-test");

        UrlFetchService.WebSearchResult result =
                new UrlFetchService(properties, httpClient, uri -> {}).searchWeb("rare topic");

        assertThat(result.hasAttempt()).isTrue();
        assertThat(result.hasResults()).isFalse();
        assertThat(result.provider()).isEqualTo("DuckDuckGo fallback");
        assertThat(result.fallback()).isTrue();
        assertThat(result.resultCount()).isZero();
        assertThat(result.markdown()).isEmpty();
    }

    @Test
    void searchWebReusesCachedResultForRepeatedQuery() {
        RecordingHttpClient httpClient =
                new RecordingHttpClient()
                        .queueInputStream(
                                200,
                                """
                                <html>
                                  <body>
                                    <a class="result__snippet">Cached summary</a>
                                    <a class="result__a" href="https://cached.example/news">
                                      Cached result
                                    </a>
                                  </body>
                                </html>
                                """);
        AiAssistantProperties properties = new AiAssistantProperties();
        properties.getUrlFetch().setWebSearchProvider("duckduckgo");
        properties.getUrlFetch().setCacheTtlSeconds(60);

        UrlFetchService service = new UrlFetchService(properties, httpClient, uri -> {});
        UrlFetchService.WebSearchResult first = service.searchWeb("repeat query");
        UrlFetchService.WebSearchResult second = service.searchWeb("repeat query");

        assertThat(second.markdown()).isEqualTo(first.markdown());
        assertThat(second.sourceUrls()).containsExactly("https://cached.example/news");
        assertThat(httpClient.requests()).hasSize(1);
    }

    @Test
    void searchWebNormalizesOverlongQueryBeforeCallingProvider() {
        RecordingHttpClient httpClient =
                new RecordingHttpClient()
                        .queueInputStream(
                                200,
                                """
                                <html>
                                  <body>
                                    <a class="result__snippet">Normalized summary</a>
                                    <a class="result__a" href="https://normalized.example/news">
                                      Normalized result
                                    </a>
                                  </body>
                                </html>
                                """);
        AiAssistantProperties properties = new AiAssistantProperties();
        properties.getUrlFetch().setWebSearchProvider("duckduckgo");
        properties.getUrlFetch().setCacheTtlSeconds(0);
        String longQuery =
                ("LNG market update with many pasted details and repeated context ".repeat(8))
                        + "TAIL_SHOULD_NOT_APPEAR";

        UrlFetchService.WebSearchResult result =
                new UrlFetchService(properties, httpClient, uri -> {}).searchWeb(longQuery);

        String rawQuery = httpClient.requests().get(0).uri().getRawQuery();
        String decodedQuery =
                URLDecoder.decode(rawQuery.substring("q=".length()), StandardCharsets.UTF_8);
        assertThat(decodedQuery.length()).isLessThanOrEqualTo(180);
        assertThat(decodedQuery).doesNotContain("TAIL_SHOULD_NOT_APPEAR");
        assertThat(result.markdown()).doesNotContain("TAIL_SHOULD_NOT_APPEAR");
    }

    @Test
    void searchWebDeduplicatesSourcesAndAsksModelToCiteResultNumbers() {
        RecordingHttpClient httpClient =
                new RecordingHttpClient()
                        .queueInputStream(
                                200,
                                """
                                <html>
                                  <body>
                                    <a class="result__snippet">First summary</a>
                                    <a class="result__snippet">Duplicate summary</a>
                                    <a class="result__a" href="https://dup.example/news?id=1">
                                      First result
                                    </a>
                                    <a class="result__a" href="https://dup.example/news?id=1">
                                      Duplicate result
                                    </a>
                                  </body>
                                </html>
                                """);
        AiAssistantProperties properties = new AiAssistantProperties();
        properties.getUrlFetch().setWebSearchProvider("duckduckgo");
        properties.getUrlFetch().setCacheTtlSeconds(0);

        UrlFetchService.WebSearchResult result =
                new UrlFetchService(properties, httpClient, uri -> {}).searchWeb("duplicate query");

        assertThat(result.resultCount()).isEqualTo(1);
        assertThat(result.sourceUrls()).containsExactly("https://dup.example/news?id=1");
        assertThat(result.markdown()).contains("回答中如使用搜索信息，请用 [1] 这样的编号引用来源。");
    }

    @Test
    void searchWebCapsTavilyTimeoutToKeepFallbackResponsive() {
        RecordingHttpClient httpClient =
                new RecordingHttpClient()
                        .queueString(
                                200,
                                """
                                {
                                  "results": [
                                    {
                                      "title": "Stable result",
                                      "url": "https://example.com/stable",
                                      "content": "Fresh indexed summary"
                                    }
                                  ]
                                }
                                """);
        AiAssistantProperties properties = new AiAssistantProperties();
        properties.getUrlFetch().setWebSearchProvider("tavily");
        properties.getUrlFetch().setWebSearchApiKey("tvly-test");
        properties.getUrlFetch().setTimeoutSeconds(15);

        new UrlFetchService(properties, httpClient, uri -> {}).searchWeb("AI news");

        assertThat(httpClient.requests().get(0).timeout()).contains(Duration.ofSeconds(8));
    }

    private static final class RecordingHttpClient extends HttpClient {
        private final Queue<ResponseSpec> responses = new ArrayDeque<>();
        private final List<HttpRequest> requests = new ArrayList<>();

        RecordingHttpClient queueString(int statusCode, String body) {
            responses.add(new ResponseSpec(statusCode, body));
            return this;
        }

        RecordingHttpClient queueInputStream(int statusCode, String body) {
            responses.add(
                    new ResponseSpec(
                            statusCode,
                            new ByteArrayInputStream(body.getBytes(StandardCharsets.UTF_8))));
            return this;
        }

        List<HttpRequest> requests() {
            return requests;
        }

        @Override
        public Optional<CookieHandler> cookieHandler() {
            return Optional.empty();
        }

        @Override
        public Optional<Duration> connectTimeout() {
            return Optional.empty();
        }

        @Override
        public Redirect followRedirects() {
            return Redirect.NEVER;
        }

        @Override
        public Optional<ProxySelector> proxy() {
            return Optional.empty();
        }

        @Override
        public SSLContext sslContext() {
            try {
                return SSLContext.getDefault();
            } catch (Exception e) {
                throw new IllegalStateException(e);
            }
        }

        @Override
        public SSLParameters sslParameters() {
            return new SSLParameters();
        }

        @Override
        public Optional<Authenticator> authenticator() {
            return Optional.empty();
        }

        @Override
        public Version version() {
            return Version.HTTP_1_1;
        }

        @Override
        public Optional<Executor> executor() {
            return Optional.empty();
        }

        @Override
        @SuppressWarnings("unchecked")
        public <T> HttpResponse<T> send(
                HttpRequest request, HttpResponse.BodyHandler<T> responseBodyHandler)
                throws IOException {
            requests.add(request);
            ResponseSpec spec = responses.poll();
            if (spec == null) {
                throw new IOException("No queued response for " + request.uri());
            }
            return new SimpleHttpResponse<>(request, spec.statusCode(), (T) spec.body());
        }

        @Override
        public <T> CompletableFuture<HttpResponse<T>> sendAsync(
                HttpRequest request, HttpResponse.BodyHandler<T> responseBodyHandler) {
            try {
                return CompletableFuture.completedFuture(send(request, responseBodyHandler));
            } catch (IOException e) {
                return CompletableFuture.failedFuture(e);
            }
        }

        @Override
        public <T> CompletableFuture<HttpResponse<T>> sendAsync(
                HttpRequest request,
                HttpResponse.BodyHandler<T> responseBodyHandler,
                HttpResponse.PushPromiseHandler<T> pushPromiseHandler) {
            return sendAsync(request, responseBodyHandler);
        }
    }

    private record ResponseSpec(int statusCode, Object body) {}

    private record SimpleHttpResponse<T>(HttpRequest request, int statusCode, T body)
            implements HttpResponse<T> {

        @Override
        public Optional<HttpResponse<T>> previousResponse() {
            return Optional.empty();
        }

        @Override
        public HttpHeaders headers() {
            return HttpHeaders.of(Map.of(), (name, value) -> true);
        }

        @Override
        public Optional<SSLSession> sslSession() {
            return Optional.empty();
        }

        @Override
        public URI uri() {
            return request.uri();
        }

        @Override
        public HttpClient.Version version() {
            return HttpClient.Version.HTTP_1_1;
        }
    }
}
