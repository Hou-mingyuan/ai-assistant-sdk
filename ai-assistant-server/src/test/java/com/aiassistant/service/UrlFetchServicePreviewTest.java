package com.aiassistant.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.aiassistant.config.AiAssistantProperties;
import com.aiassistant.model.UrlPreviewResponse;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.net.Authenticator;
import java.net.CookieHandler;
import java.net.ProxySelector;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpHeaders;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentLinkedDeque;
import java.util.concurrent.Executor;
import javax.net.ssl.SSLContext;
import javax.net.ssl.SSLParameters;
import javax.net.ssl.SSLSession;
import org.junit.jupiter.api.Test;

/** Covers the page-preview, URL enrichment, redirect, charset and image-scoring paths. */
class UrlFetchServicePreviewTest {

    private static AiAssistantProperties props() {
        AiAssistantProperties p = new AiAssistantProperties();
        // keep SSRF off via a no-op policy; properties stay at sane defaults
        return p;
    }

    private static UrlFetchService service(AiAssistantProperties p, HttpClient client) {
        return new UrlFetchService(p, client, uri -> {});
    }

    @Test
    void previewUrl_extractsTitleSummaryAndScoredImages() {
        String html =
                """
                <html><head>
                <meta property="og:title" content="Quarterly LNG Market Report">
                <meta property="og:image" content="https://cdn.example.com/og-hero.jpg">
                <meta name="twitter:image" content="https://cdn.example.com/tw-card.jpg">
                <title>fallback title</title>
                </head><body>
                <header><img class="site-logo" src="/logo.png" alt="logo"></header>
                <nav><img src="/img/nav1.png" width="120" height="40"></nav>
                <article>
                  <h1>Quarterly LNG Market Report</h1>
                  <p>The quarterly LNG market report covers shipping, pricing and demand trends
                     across major terminals and the broader market outlook for the season.</p>
                  <img src="https://cdn.example.com/article-main.jpg" width="800" height="600"
                       alt="Quarterly LNG Market Report chart">
                  <img src="//cdn.example.com/protocol-relative.jpg" width="400" height="300"
                       alt="market trend">
                  <img src="/relative/photo.jpg" width="500" height="400" alt="terminal photo">
                  <img src="data:image/png;base64,AAAA" alt="inline">
                  <img src="https://service.weibo.com/share/share.png" width="300" height="200">
                  <img class="share-btn" src="https://cdn.example.com/share-weibo.png"
                       width="32" height="32">
                  <img src="https://cdn.example.com/favicon.ico" width="16" height="16">
                  <img src="https://cdn.example.com/spacer.gif" width="1" height="1">
                </article>
                </body></html>
                """;
        FakeHttpClient client = new FakeHttpClient().html(200, html);

        UrlPreviewResponse r =
                service(props(), client).previewUrl("https://www.example.com/news/article");

        assertThat(r.isSuccess()).isTrue();
        assertThat(r.getTitle()).isEqualTo("Quarterly LNG Market Report");
        assertThat(r.getSummary()).contains("quarterly LNG market report covers shipping");
        assertThat(r.getImageUrl()).isEqualTo("https://cdn.example.com/og-hero.jpg");
        assertThat(r.getImageUrls())
                .contains(
                        "https://cdn.example.com/og-hero.jpg",
                        "https://cdn.example.com/tw-card.jpg",
                        "https://cdn.example.com/article-main.jpg",
                        "https://cdn.example.com/protocol-relative.jpg",
                        "https://www.example.com/relative/photo.jpg");
        assertThat(r.getImageUrls())
                .noneMatch(u -> u.contains("logo"))
                .noneMatch(u -> u.contains("nav1"))
                .noneMatch(u -> u.startsWith("data:"))
                .noneMatch(u -> u.contains("service.weibo.com"))
                .noneMatch(u -> u.contains("share-weibo"))
                .noneMatch(u -> u.contains("favicon"))
                .noneMatch(u -> u.contains("spacer"));
    }

    @Test
    void previewUrl_blankUrl_fails() {
        UrlPreviewResponse r = service(props(), new FakeHttpClient()).previewUrl("  ");
        assertThat(r.isSuccess()).isFalse();
        assertThat(r.getError()).isEqualTo("url is required");
    }

    @Test
    void previewUrl_nonHttpScheme_fails() {
        UrlPreviewResponse r = service(props(), new FakeHttpClient()).previewUrl("ftp://host/x");
        assertThat(r.isSuccess()).isFalse();
        assertThat(r.getError()).contains("only http(s)");
    }

    @Test
    void previewUrl_malformedUri_fails() {
        UrlPreviewResponse r =
                service(props(), new FakeHttpClient()).previewUrl("http://exa mple.com/x");
        assertThat(r.isSuccess()).isFalse();
        assertThat(r.getError()).isEqualTo("invalid url");
    }

    @Test
    void previewUrl_followsRedirectThenParses() {
        FakeHttpClient client =
                new FakeHttpClient()
                        .redirect(301, "https://www.example.com/final")
                        .html(
                                200,
                                "<html><head><title>Final Page</title></head><body>ok</body></html>");

        UrlPreviewResponse r = service(props(), client).previewUrl("https://www.example.com/start");

        assertThat(r.isSuccess()).isTrue();
        assertThat(r.getTitle()).isEqualTo("Final Page");
        assertThat(client.requestCount()).isEqualTo(2);
    }

    @Test
    void previewUrl_httpErrorStatus_failsWithMessage() {
        FakeHttpClient client = new FakeHttpClient().html(404, "not found");

        UrlPreviewResponse r =
                service(props(), client).previewUrl("https://www.example.com/missing");

        assertThat(r.isSuccess()).isFalse();
        assertThat(r.getError()).contains("HTTP 404");
    }

    @Test
    void previewUrl_emptyBodyWithoutHeadless_returnsEmptyOk() {
        FakeHttpClient client = new FakeHttpClient().empty(200);

        UrlPreviewResponse r = service(props(), client).previewUrl("https://www.example.com/empty");

        assertThat(r.isSuccess()).isTrue();
        assertThat(r.getTitle()).isEmpty();
        assertThat(r.getImageUrls()).isEmpty();
    }

    @Test
    void previewUrl_emptyBody_usesHeadlessFallback() {
        FakeHttpClient client = new FakeHttpClient().empty(200);
        UrlFetchService svc = service(props(), client);
        svc.setHeadlessFetchService(
                url ->
                        new HeadlessFetcher.Result(
                                "Headless Title",
                                "headless extracted text",
                                List.of("https://cdn.example.com/headless.jpg")));

        UrlPreviewResponse r = svc.previewUrl("https://www.example.com/spa");

        assertThat(r.isSuccess()).isTrue();
        assertThat(r.getTitle()).isEqualTo("Headless Title");
        assertThat(r.getSummary()).isEqualTo("headless extracted text");
        assertThat(r.getImageUrl()).isEqualTo("https://cdn.example.com/headless.jpg");
    }

    @Test
    void previewUrl_sniffsCharsetFromMetaTag() {
        String chineseTitle = "能源市场快报";
        String html =
                "<html><head>"
                        + "<meta http-equiv=\"Content-Type\" content=\"text/html; charset=gbk\">"
                        + "<title>"
                        + chineseTitle
                        + "</title></head><body>正文内容用于摘要展示，篇幅足够长以避免无头回退逻辑触发。</body></html>";
        byte[] gbk = html.getBytes(Charset.forName("GBK"));
        FakeHttpClient client = new FakeHttpClient().bytes(200, gbk);

        UrlPreviewResponse r = service(props(), client).previewUrl("https://www.example.com/gbk");

        assertThat(r.isSuccess()).isTrue();
        assertThat(r.getTitle()).isEqualTo(chineseTitle);
    }

    @Test
    void previewUrl_truncatesLongSummaryWithEllipsis() {
        AiAssistantProperties p = props();
        p.setUrlPreviewMaxSummaryChars(50); // effective cap floors at 100
        String longText = "L".repeat(400);
        FakeHttpClient client =
                new FakeHttpClient().html(200, "<html><body><p>" + longText + "</p></body></html>");

        UrlPreviewResponse r = service(p, client).previewUrl("https://www.example.com/long");

        assertThat(r.isSuccess()).isTrue();
        assertThat(r.getSummary()).endsWith("…");
        assertThat(r.getSummary().length()).isLessThanOrEqualTo(102);
    }

    @Test
    void enrichUserMessage_appendsFetchedContentForUrls() throws Exception {
        FakeHttpClient client =
                new FakeHttpClient()
                        .html(200, "<html><body><p>ALPHA CONTENT BODY</p></body></html>");

        String enriched =
                service(props(), client)
                        .enrichUserMessage("please read https://www.example.com/a thanks");

        assertThat(enriched).startsWith("please read https://www.example.com/a thanks");
        assertThat(enriched).contains("--- fetched: https://www.example.com/a ---");
        assertThat(enriched).contains("ALPHA CONTENT BODY");
    }

    @Test
    void enrichUserMessage_disabled_returnsOriginal() throws Exception {
        AiAssistantProperties p = props();
        p.setUrlFetchEnabled(false);

        String text = "see https://www.example.com/a";
        assertThat(service(p, new FakeHttpClient()).enrichUserMessage(text)).isEqualTo(text);
    }

    @Test
    void enrichUserMessage_noUrls_returnsOriginal() throws Exception {
        String text = "no links here at all";
        assertThat(service(props(), new FakeHttpClient()).enrichUserMessage(text)).isEqualTo(text);
    }

    @Test
    void enrichUserMessage_null_returnsNull() throws Exception {
        assertThat(service(props(), new FakeHttpClient()).enrichUserMessage(null)).isNull();
    }

    @Test
    void enrichUserMessage_truncatesInjectedContent() throws Exception {
        AiAssistantProperties p = props();
        p.setUrlFetchMaxCharsInjected(10);
        FakeHttpClient client =
                new FakeHttpClient()
                        .html(200, "<html><body><p>" + "Z".repeat(200) + "</p></body></html>");

        String enriched = service(p, client).enrichUserMessage("read https://www.example.com/big");

        assertThat(enriched).contains("…[truncated]");
    }

    @Test
    void enrichUserMessage_usesCacheOnSecondCall() throws Exception {
        FakeHttpClient client =
                new FakeHttpClient().html(200, "<html><body><p>CACHED CONTENT</p></body></html>");
        UrlFetchService svc = service(props(), client);

        String first = svc.enrichUserMessage("read https://www.example.com/cached");
        String second = svc.enrichUserMessage("read https://www.example.com/cached");

        assertThat(first).contains("CACHED CONTENT");
        assertThat(second).contains("CACHED CONTENT");
        assertThat(client.requestCount()).isEqualTo(1);
    }

    // ── Minimal fake HttpClient returning InputStream bodies with optional headers ──

    private static final class FakeHttpClient extends HttpClient {
        private final ConcurrentLinkedDeque<Resp> responses = new ConcurrentLinkedDeque<>();
        private final List<URI> requested = Collections.synchronizedList(new ArrayList<>());

        FakeHttpClient html(int status, String body) {
            responses.add(new Resp(status, body.getBytes(StandardCharsets.UTF_8), Map.of()));
            return this;
        }

        FakeHttpClient bytes(int status, byte[] body) {
            responses.add(new Resp(status, body, Map.of()));
            return this;
        }

        FakeHttpClient empty(int status) {
            responses.add(new Resp(status, new byte[0], Map.of()));
            return this;
        }

        FakeHttpClient redirect(int status, String location) {
            responses.add(new Resp(status, new byte[0], Map.of("Location", List.of(location))));
            return this;
        }

        int requestCount() {
            return requested.size();
        }

        @Override
        @SuppressWarnings("unchecked")
        public <T> HttpResponse<T> send(
                HttpRequest request, HttpResponse.BodyHandler<T> responseBodyHandler)
                throws IOException {
            requested.add(request.uri());
            Resp r = responses.poll();
            if (r == null) {
                throw new IOException("No queued response for " + request.uri());
            }
            return (HttpResponse<T>)
                    new SimpleResponse<>(
                            request, r.status(), new ByteArrayInputStream(r.body()), r.headers());
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
    }

    private record Resp(int status, byte[] body, Map<String, List<String>> headers) {}

    private record SimpleResponse<T>(
            HttpRequest request, int statusCode, T body, Map<String, List<String>> headerMap)
            implements HttpResponse<T> {

        @Override
        public Optional<HttpResponse<T>> previousResponse() {
            return Optional.empty();
        }

        @Override
        public HttpHeaders headers() {
            return HttpHeaders.of(headerMap, (name, value) -> true);
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
