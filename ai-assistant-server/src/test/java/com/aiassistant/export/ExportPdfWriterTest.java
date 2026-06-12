package com.aiassistant.export;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.aiassistant.config.AiAssistantProperties;
import com.aiassistant.model.ExportRequest;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.lang.reflect.Field;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpHeaders;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayDeque;
import java.util.Arrays;
import java.util.Deque;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;
import javax.imageio.ImageIO;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.junit.jupiter.api.Test;

class ExportPdfWriterTest {

    private static AiAssistantProperties propsNoEmbed() {
        AiAssistantProperties p = new AiAssistantProperties();
        p.setExportEmbedImages(false);
        return p;
    }

    private static ExportRequest.MessageRow row(String role, String content) {
        ExportRequest.MessageRow m = new ExportRequest.MessageRow();
        m.setRole(role);
        m.setContent(content);
        return m;
    }

    private static byte[] pngBytes(int w, int h) throws Exception {
        BufferedImage img = new BufferedImage(w, h, BufferedImage.TYPE_INT_RGB);
        ByteArrayOutputStream bos = new ByteArrayOutputStream();
        ImageIO.write(img, "png", bos);
        return bos.toByteArray();
    }

    private static void assertIsPdf(byte[] bytes) {
        assertThat(bytes).isNotEmpty();
        assertThat(new String(Arrays.copyOf(bytes, 5), StandardCharsets.US_ASCII))
                .isEqualTo("%PDF-");
    }

    private static final String RICH_MARKDOWN =
            """
            # Heading One
            ## Heading Two
            ### Heading Three
            #### Heading Four
            > a blockquote line with some content
            - bullet item one
            * star item two
            1. ordered item three

            normal paragraph with **bold text** and `inline code` segments
            inline image ![pic](https://imgs.example.com/inline.png) then trailing words
            ![lone](https://imgs.example.com/lone.png)
            这是一段需要按码位换行的中文文本用于触发逐字宽度二分查找的换行逻辑覆盖更多分支与路径展示效果

            ```java
            System.out.println("fenced code block line");
            int sum = 1 + 2 + 3 + 4 + 5 + 6 + 7 + 8 + 9 + 10;
            ```
            """;

    @Test
    void rendersRichMarkdown_lightTheme() throws Exception {
        ByteArrayOutputStream out = new ByteArrayOutputStream();

        new ExportPdfWriter(propsNoEmbed())
                .write(List.of(row("user", RICH_MARKDOWN), row(null, null)), out, false);

        assertIsPdf(out.toByteArray());
    }

    @Test
    void rendersRichMarkdown_darkTheme() throws Exception {
        ByteArrayOutputStream out = new ByteArrayOutputStream();

        new ExportPdfWriter(propsNoEmbed())
                .write(List.of(row("assistant", RICH_MARKDOWN)), out, true);

        assertIsPdf(out.toByteArray());
    }

    @Test
    void rendersUnterminatedCodeFence() throws Exception {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        String md = "intro line\n```\ncode without closing fence\nmore code";

        new ExportPdfWriter(propsNoEmbed()).write(List.of(row("user", md)), out, false);

        assertIsPdf(out.toByteArray());
    }

    @Test
    void longContentSpansMultiplePages() throws Exception {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < 200; i++) {
            sb.append("Line number ").append(i).append(" of a very tall document\n");
        }
        ByteArrayOutputStream out = new ByteArrayOutputStream();

        new ExportPdfWriter(propsNoEmbed()).write(List.of(row("user", sb.toString())), out, false);

        try (PDDocument doc = Loader.loadPDF(out.toByteArray())) {
            assertThat(doc.getNumberOfPages()).isGreaterThan(1);
        }
    }

    @Test
    void embedsImageFetchedThroughHttpClient() throws Exception {
        AiAssistantProperties p = new AiAssistantProperties();
        p.setExportEmbedImages(true);
        p.setUrlFetchSsrfProtection(false);
        ExportPdfWriter writer = new ExportPdfWriter(p);
        ImageHttpClient client =
                new ImageHttpClient().pngOk("https://imgs.example.com/a.png", pngBytes(40, 30));
        injectClient(writer, client);

        ByteArrayOutputStream out = new ByteArrayOutputStream();
        writer.write(List.of(row("user", "![pic](https://imgs.example.com/a.png)")), out, false);

        assertIsPdf(out.toByteArray());
        assertThat(client.sends()).isGreaterThanOrEqualTo(1);
        try (PDDocument doc = Loader.loadPDF(out.toByteArray())) {
            assertThat(doc.getNumberOfPages()).isGreaterThanOrEqualTo(1);
        }
    }

    @Test
    void followsImageRedirectBeforeEmbedding() throws Exception {
        AiAssistantProperties p = new AiAssistantProperties();
        p.setExportEmbedImages(true);
        p.setUrlFetchSsrfProtection(false);
        ExportPdfWriter writer = new ExportPdfWriter(p);
        ImageHttpClient client =
                new ImageHttpClient()
                        .redirectTo(
                                "https://imgs.example.com/redir.png",
                                "https://imgs.example.com/final.png")
                        .pngOk("https://imgs.example.com/final.png", pngBytes(50, 20));
        injectClient(writer, client);

        ByteArrayOutputStream out = new ByteArrayOutputStream();
        writer.write(
                List.of(row("user", "![pic](https://imgs.example.com/redir.png)")), out, false);

        assertIsPdf(out.toByteArray());
        assertThat(client.sends()).isGreaterThanOrEqualTo(2);
    }

    @Test
    void disallowedImageUrlFallsBackToTextNote() throws Exception {
        AiAssistantProperties p = new AiAssistantProperties();
        p.setExportEmbedImages(true);
        p.setUrlFetchSsrfProtection(false);
        ByteArrayOutputStream out = new ByteArrayOutputStream();

        new ExportPdfWriter(p)
                .write(List.of(row("user", "![x](ftp://imgs.example.com/x.png)")), out, false);

        assertIsPdf(out.toByteArray());
    }

    @Test
    void ssrfBlockedImageUrlFallsBackToTextNote() throws Exception {
        AiAssistantProperties p = new AiAssistantProperties();
        p.setExportEmbedImages(true);
        p.setUrlFetchSsrfProtection(true);
        ByteArrayOutputStream out = new ByteArrayOutputStream();

        new ExportPdfWriter(p)
                .write(List.of(row("user", "![x](http://127.0.0.1/secret.png)")), out, false);

        assertIsPdf(out.toByteArray());
    }

    @Test
    void invalidUnicodeFontFileCausesFailure() throws Exception {
        ExportPdfWriter.clearFontCache();
        Path bogus = Files.createTempFile("bogus-font", ".ttf");
        bogus.toFile().deleteOnExit();
        Files.write(bogus, "this is not a real font file".getBytes(StandardCharsets.UTF_8));
        AiAssistantProperties p = new AiAssistantProperties();
        p.setExportEmbedImages(false);
        p.setExportPdfUnicodeFont(bogus.toString());

        assertThatThrownBy(
                        () ->
                                new ExportPdfWriter(p)
                                        .write(
                                                List.of(row("user", "hello")),
                                                new ByteArrayOutputStream(),
                                                false))
                .isInstanceOf(Exception.class);
        ExportPdfWriter.clearFontCache();
    }

    @Test
    void preparedExportRecordExposesFields() {
        PreparedExport pe =
                new PreparedExport(
                        "pdf", "application/pdf", "chat.pdf", List.of(row("user", "hi")), true);

        assertThat(pe.formatKey()).isEqualTo("pdf");
        assertThat(pe.mediaType()).isEqualTo("application/pdf");
        assertThat(pe.filename()).isEqualTo("chat.pdf");
        assertThat(pe.darkTheme()).isTrue();
        assertThat(pe.messages()).hasSize(1);
    }

    private static void injectClient(ExportPdfWriter writer, HttpClient client) throws Exception {
        Field f = ExportPdfWriter.class.getDeclaredField("httpClient");
        f.setAccessible(true);
        f.set(writer, client);
    }

    // ── Fake HttpClient keyed by request URI, returning InputStream image bodies ──

    private static final class ImageHttpClient extends HttpClient {
        private final Map<String, Deque<Resp>> byUri = new ConcurrentHashMap<>();
        private final AtomicInteger sends = new AtomicInteger();

        ImageHttpClient pngOk(String uri, byte[] png) {
            put(uri, new Resp(200, png, Map.of("Content-Type", List.of("image/png"))));
            return this;
        }

        ImageHttpClient redirectTo(String uri, String location) {
            put(uri, new Resp(301, new byte[0], Map.of("Location", List.of(location))));
            return this;
        }

        private void put(String uri, Resp r) {
            byUri.computeIfAbsent(uri, k -> new ArrayDeque<>()).add(r);
        }

        int sends() {
            return sends.get();
        }

        @Override
        @SuppressWarnings("unchecked")
        public <T> HttpResponse<T> send(
                HttpRequest request, HttpResponse.BodyHandler<T> responseBodyHandler)
                throws IOException {
            sends.incrementAndGet();
            String key = request.uri().toString();
            Deque<Resp> deque = byUri.get(key);
            Resp r;
            synchronized (this) {
                r = deque == null ? null : deque.poll();
            }
            if (r == null) {
                throw new IOException("No queued response for " + key);
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
        public Optional<java.net.CookieHandler> cookieHandler() {
            return Optional.empty();
        }

        @Override
        public Optional<java.time.Duration> connectTimeout() {
            return Optional.empty();
        }

        @Override
        public Redirect followRedirects() {
            return Redirect.NEVER;
        }

        @Override
        public Optional<java.net.ProxySelector> proxy() {
            return Optional.empty();
        }

        @Override
        public javax.net.ssl.SSLContext sslContext() {
            try {
                return javax.net.ssl.SSLContext.getDefault();
            } catch (Exception e) {
                throw new IllegalStateException(e);
            }
        }

        @Override
        public javax.net.ssl.SSLParameters sslParameters() {
            return new javax.net.ssl.SSLParameters();
        }

        @Override
        public Optional<java.net.Authenticator> authenticator() {
            return Optional.empty();
        }

        @Override
        public Version version() {
            return Version.HTTP_1_1;
        }

        @Override
        public Optional<java.util.concurrent.Executor> executor() {
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
        public Optional<javax.net.ssl.SSLSession> sslSession() {
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
