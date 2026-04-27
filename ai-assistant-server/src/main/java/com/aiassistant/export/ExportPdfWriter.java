package com.aiassistant.export;

import com.aiassistant.config.AiAssistantProperties;
import com.aiassistant.model.ExportRequest;
import com.aiassistant.util.UrlFetchSafety;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDType0Font;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.font.Standard14Fonts;
import org.apache.pdfbox.pdmodel.graphics.image.PDImageXObject;
import org.springframework.core.io.DefaultResourceLoader;
import org.springframework.core.io.Resource;

import javax.imageio.ImageIO;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.regex.Matcher;

/**
 * PDF export renderer extracted from AssistantExportService.
 * Handles font loading, page layout, markdown→PDF rendering, and image embedding.
 */
public class ExportPdfWriter {

    private static final ExecutorService IMAGE_POOL =
            Executors.newFixedThreadPool(4, r -> { Thread t = new Thread(r, "ai-pdf-img"); t.setDaemon(true); return t; });
    private static final int MAX_IMAGE_REDIRECTS = 5;

    private final AiAssistantProperties properties;
    private volatile HttpClient httpClient;

    public ExportPdfWriter(AiAssistantProperties properties) {
        this.properties = properties;
    }

    public void write(List<ExportRequest.MessageRow> messages, OutputStream out, boolean dark) throws Exception {
        Map<String, byte[]> imageCache = prefetchImages(messages);
        try {
            write(messages, out, dark, imageCache);
        } finally {
            imageCache.clear();
        }
    }

    private void write(List<ExportRequest.MessageRow> messages, OutputStream out, boolean dark,
                       Map<String, byte[]> imageCache) throws Exception {
        try (PDDocument doc = new PDDocument()) {
            FontCtx font = loadFont(doc);
            PdfLayout L = new PdfLayout(doc, font);
            if (dark) L.enableDarkTheme();
            for (ExportRequest.MessageRow m : messages) {
                String role = m != null && m.getRole() != null ? m.getRole() : "";
                String content = m != null && m.getContent() != null ? m.getContent() : "";
                L.printRoleLine("[" + role + "]");
                appendMarkdown(L, content, imageCache);
                L.gap();
            }
            L.close();
            doc.save(out);
        }
    }

    interface FontCtx {
        void useFont(PDPageContentStream cs, float size) throws Exception;
        void showLine(PDPageContentStream cs, String line) throws Exception;
        float stringWidth(String text, float fontSize) throws IOException;
    }

    static final class PdfLayout {
        private final PDDocument doc;
        private final FontCtx font;
        private final float margin = 48;
        private final float pageW = PDRectangle.A4.getWidth();
        private final float pageH = PDRectangle.A4.getHeight();
        final float textWidth;
        private PDPage page;
        private PDPageContentStream cs;
        private float y;
        final float defaultSize = 11;
        final float defaultLeading = 14;
        private boolean dark = false;

        PdfLayout(PDDocument document, FontCtx fontCtx) throws Exception {
            this.doc = document;
            this.font = fontCtx;
            this.textWidth = pageW - 2 * margin;
            this.page = new PDPage(PDRectangle.A4);
            doc.addPage(page);
            this.cs = new PDPageContentStream(doc, page);
            this.y = pageH - margin;
        }

        void enableDarkTheme() throws Exception {
            this.dark = true;
            paintPageBackground();
        }

        private void paintPageBackground() throws Exception {
            if (!dark) return;
            cs.setNonStrokingColor(30, 41, 59);
            cs.addRect(0, 0, pageW, pageH);
            cs.fill();
            cs.setNonStrokingColor(226, 232, 240);
        }

        void newPage() throws Exception {
            if (cs != null) cs.close();
            page = new PDPage(PDRectangle.A4);
            doc.addPage(page);
            cs = new PDPageContentStream(doc, page);
            paintPageBackground();
            y = pageH - margin;
        }

        void ensureSpace(float need) throws Exception {
            float usable = pageH - 2 * margin;
            if (need > usable) need = usable;
            if (y - need < margin) newPage();
        }

        void printRoleLine(String role) throws Exception {
            printWrapped(role, defaultSize, true);
        }

        void printWrapped(String text, float fontSize, boolean bold) throws Exception {
            for (String line : wrapToLines(text, font, fontSize, textWidth)) {
                ensureSpace(defaultLeading);
                cs.beginText();
                font.useFont(cs, fontSize);
                cs.newLineAtOffset(margin, y);
                font.showLine(cs, line);
                cs.endText();
                y -= defaultLeading;
            }
        }

        void printLineRaw(String line, float fontSize, float leading) throws Exception {
            ensureSpace(leading);
            cs.beginText();
            font.useFont(cs, fontSize);
            cs.newLineAtOffset(margin, y);
            font.showLine(cs, line);
            cs.endText();
            y -= leading;
        }

        void drawImage(byte[] bytes) throws Exception {
            PDImageXObject img = PDImageXObject.createFromByteArray(doc, bytes, "im");
            float iw = img.getWidth(), ih = img.getHeight();
            float maxW = textWidth, maxH = pageH - 2 * margin - 8f;
            float scale = Math.min(1f, maxW / iw);
            float dw = iw * scale, dh = ih * scale;
            if (dh > maxH) { float sh = maxH / dh; dw *= sh; dh = maxH; }
            float gap = 8f;
            ensureSpace(dh + gap);
            float drawBottom = y - gap - dh;
            cs.drawImage(img, margin, drawBottom, dw, dh);
            y = drawBottom - gap;
        }

        void gap() { y -= defaultLeading * 0.5f; }

        void close() throws Exception {
            if (cs != null) cs.close();
        }
    }

    // ── Font loading ────────────────────────────────────────────────

    private FontCtx loadFont(PDDocument doc) throws Exception {
        String spec = properties.getExportPdfUnicodeFont();
        if (spec != null && !spec.isBlank()) {
            try (InputStream in = openFontStream(spec)) {
                if (in != null) {
                    PDType0Font t0 = PDType0Font.load(doc, in);
                    return new FontCtx() {
                        public void useFont(PDPageContentStream cs, float size) throws Exception { cs.setFont(t0, size); }
                        public void showLine(PDPageContentStream cs, String line) throws Exception { cs.showText(line); }
                        public float stringWidth(String text, float fontSize) throws IOException {
                            return (text == null || text.isEmpty()) ? 0f : t0.getStringWidth(text) / 1000f * fontSize;
                        }
                    };
                }
            }
        }
        PDType1Font helv = new PDType1Font(Standard14Fonts.FontName.HELVETICA);
        return new FontCtx() {
            public void useFont(PDPageContentStream cs, float size) throws Exception { cs.setFont(helv, size); }
            public void showLine(PDPageContentStream cs, String line) throws Exception {
                cs.showText(new String(line.getBytes(StandardCharsets.US_ASCII), StandardCharsets.US_ASCII));
            }
            public float stringWidth(String text, float fontSize) throws IOException {
                if (text == null || text.isEmpty()) return 0f;
                String safe = new String(text.getBytes(StandardCharsets.US_ASCII), StandardCharsets.US_ASCII);
                return safe.isEmpty() ? 0f : helv.getStringWidth(safe) / 1000f * fontSize;
            }
        };
    }

    private InputStream openFontStream(String spec) throws Exception {
        if (spec.startsWith("classpath:")) {
            Resource r = new DefaultResourceLoader().getResource(spec);
            if (r.exists()) return r.getInputStream();
        } else if (spec.startsWith("file:")) {
            return new DefaultResourceLoader().getResource(spec).getInputStream();
        } else {
            Path p = Path.of(spec);
            if (Files.isRegularFile(p)) return Files.newInputStream(p);
        }
        return null;
    }

    // ── Text wrapping ───────────────────────────────────────────────

    static List<String> wrapToLines(String text, FontCtx font, float fontSize, float maxW) throws IOException {
        List<String> lines = new ArrayList<>();
        if (text == null || text.isEmpty()) { lines.add(""); return lines; }
        for (String para : text.split("\n", -1)) {
            if (para.isEmpty()) { lines.add(""); continue; }
            wrapParagraph(font, fontSize, maxW, lines, para);
        }
        return lines;
    }

    private static void wrapParagraph(FontCtx font, float fontSize, float maxW, List<String> lines, String para)
            throws IOException {
        int i = 0;
        final int cpLen = para.codePointCount(0, para.length());
        int cpStart = 0;
        while (cpStart < cpLen) {
            int lo = 1, hi = cpLen - cpStart, best = 0;
            while (lo <= hi) {
                int mid = (lo + hi) >>> 1;
                int charEnd = para.offsetByCodePoints(i, mid);
                float w = font.stringWidth(para.substring(i, charEnd), fontSize);
                if (w <= maxW) { best = mid; lo = mid + 1; } else { hi = mid - 1; }
            }
            if (best == 0) best = 1;
            int charEnd = para.offsetByCodePoints(i, best);
            lines.add(para.substring(i, charEnd));
            i = charEnd;
            cpStart += best;
        }
    }

    // ── Markdown → PDF ──────────────────────────────────────────────

    private void appendMarkdown(PdfLayout L, String markdown, Map<String, byte[]> imageCache) throws Exception {
        String text = markdown == null ? "" : markdown.replace("\r\n", "\n").replace('\r', '\n');
        String[] lines = text.split("\n", -1);
        boolean inCode = false;
        StringBuilder codeBuf = new StringBuilder();
        for (String line : lines) {
            if (inCode) {
                if (line.trim().startsWith("```")) {
                    for (String wl : wrapToLines(codeBuf.toString().replace("\t", "    "), L.font, 9, L.textWidth - 24))
                        L.printLineRaw(wl, 9f, 11f);
                    codeBuf.setLength(0);
                    inCode = false;
                } else {
                    if (!codeBuf.isEmpty()) codeBuf.append('\n');
                    codeBuf.append(line);
                }
                continue;
            }
            if (line.trim().startsWith("```")) { inCode = true; continue; }
            String trimmed = line.trim();
            if (trimmed.isEmpty()) continue;

            Matcher hm = ExportMarkdownPatterns.MD_HEADING.matcher(line);
            if (hm.matches()) {
                int level = hm.group(1).length();
                float sz = switch (level) { case 1 -> 16; case 2 -> 14; case 3 -> 13; default -> 12; };
                float hang = Math.min(56f, level * 10f);
                emitLineWithImages(L, hm.group(2), sz, sz + 3, Math.max(120f, L.textWidth - hang), imageCache);
                continue;
            }
            if (line.startsWith(">")) {
                emitLineWithImages(L, line.replaceFirst("^>\\s?", ""), L.defaultSize, L.defaultLeading, L.textWidth - 36f, imageCache);
                continue;
            }
            String listBody = null;
            if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) listBody = trimmed.substring(2);
            else { Matcher om = ExportMarkdownPatterns.MD_OL.matcher(trimmed); if (om.matches()) listBody = om.group(2); }
            if (listBody != null) {
                emitLineWithImages(L, "\u2022 " + listBody, L.defaultSize, L.defaultLeading, L.textWidth - 28f, imageCache);
                continue;
            }
            Matcher loneImg = ExportMarkdownPatterns.MD_IMAGE.matcher(trimmed);
            if (loneImg.matches() && trimmed.indexOf('!') == 0 && trimmed.lastIndexOf(')') == trimmed.length() - 1) {
                imageOrNote(L, loneImg.group(2).trim(), imageCache);
                continue;
            }
            emitLineWithImages(L, line, L.defaultSize, L.defaultLeading, L.textWidth, imageCache);
        }
        if (inCode) {
            for (String wl : wrapToLines(codeBuf.toString().replace("\t", "    "), L.font, 9, L.textWidth - 24))
                L.printLineRaw(wl, 9f, 11f);
        }
    }

    private void emitLineWithImages(PdfLayout L, String line, float fontSize, float leading,
                                     float maxTextW, Map<String, byte[]> imageCache) throws Exception {
        line = ExportMarkdownUrls.stripInlineMdForPdf(line);
        Matcher m = ExportMarkdownPatterns.MD_IMAGE.matcher(line);
        if (!m.find()) {
            for (String wl : wrapToLines(line, L.font, fontSize, maxTextW)) L.printLineRaw(wl, fontSize, leading);
            return;
        }
        int last = 0;
        do {
            if (m.start() > last) {
                for (String wl : wrapToLines(line.substring(last, m.start()), L.font, fontSize, maxTextW))
                    L.printLineRaw(wl, fontSize, leading);
            }
            imageOrNote(L, m.group(2).trim(), imageCache);
            last = m.end();
        } while (m.find());
        if (last < line.length()) {
            for (String wl : wrapToLines(line.substring(last), L.font, fontSize, maxTextW))
                L.printLineRaw(wl, fontSize, leading);
        }
    }

    // ── Image handling ──────────────────────────────────────────────

    private Map<String, byte[]> prefetchImages(List<ExportRequest.MessageRow> messages) {
        if (!properties.isExportEmbedImages()) return Map.of();
        Set<String> urls = new LinkedHashSet<>();
        for (ExportRequest.MessageRow m : messages)
            ExportMarkdownUrls.collectMarkdownImageUrls(m != null ? m.getContent() : null, urls);
        if (urls.isEmpty()) return Map.of();
        ConcurrentHashMap<String, byte[]> out = new ConcurrentHashMap<>();
        List<CompletableFuture<Void>> futures = new ArrayList<>();
        for (String u : urls)
            futures.add(CompletableFuture.runAsync(() -> { byte[] b = fetchImageBytes(u); if (b != null && b.length > 0) out.put(u, b); }, IMAGE_POOL));
        CompletableFuture.allOf(futures.toArray(new CompletableFuture[0])).join();
        return out;
    }

    private void imageOrNote(PdfLayout L, String url, Map<String, byte[]> imageCache) throws Exception {
        byte[] bytes = null;
        if (properties.isExportEmbedImages()) {
            bytes = imageCache.get(url);
            if (bytes == null) bytes = fetchImageBytes(url);
        }
        if (bytes != null && bytes.length > 0) L.drawImage(bytes);
        else L.printWrapped("[Image] " + url, L.defaultSize, false);
    }

    private HttpClient httpClient() {
        if (httpClient == null) {
            synchronized (this) {
                if (httpClient == null) httpClient = HttpClient.newBuilder().followRedirects(HttpClient.Redirect.NEVER).build();
            }
        }
        return httpClient;
    }

    private byte[] fetchImageBytes(String urlStr) {
        if (!ExportHttpUrls.isAllowedHttpUrl(urlStr)) return null;
        URI current;
        try {
            current = URI.create(urlStr.trim());
            if (properties.isUrlFetchSsrfProtection()) UrlFetchSafety.validateHttpUrlForServerSideFetch(current);
        } catch (IllegalArgumentException e) { return null; }
        int max = Math.max(8192, properties.getExportMaxImageBytes());
        Duration timeout = Duration.ofSeconds(Math.max(5, properties.getUrlFetchTimeoutSeconds()));
        try {
            for (int hop = 0; hop <= MAX_IMAGE_REDIRECTS; hop++) {
                HttpRequest req = HttpRequest.newBuilder().uri(current).timeout(timeout)
                        .header("User-Agent", "Mozilla/5.0 (compatible; AiAssistant-Export/1.0)")
                        .header("Accept", "image/*,*/*;q=0.8").GET().build();
                HttpResponse<InputStream> res = httpClient().send(req, HttpResponse.BodyHandlers.ofInputStream());
                int code = res.statusCode();
                if (code >= 301 && code <= 308 && code != 304) {
                    res.body().close();
                    String location = res.headers().firstValue("Location").orElse(null);
                    if (location == null || location.isBlank()) return null;
                    current = current.resolve(location);
                    if (properties.isUrlFetchSsrfProtection()) UrlFetchSafety.validateHttpUrlForServerSideFetch(current);
                    continue;
                }
                if (code / 100 != 2) { res.body().close(); return null; }
                return readImageResponse(res, max);
            }
        } catch (Exception e) { return null; }
        return null;
    }

    private byte[] readImageResponse(HttpResponse<InputStream> res, int max) throws IOException {
        try (InputStream in = res.body(); ByteArrayOutputStream bos = new ByteArrayOutputStream()) {
            byte[] buf = new byte[8192];
            int n;
            while ((n = in.read(buf)) >= 0) { bos.write(buf, 0, n); if (bos.size() > max) return null; }
            byte[] data = bos.toByteArray();
            String ct = res.headers().firstValue("Content-Type").orElse("").toLowerCase(Locale.ROOT);
            if (ct.startsWith("image/")) return data;
            if (ExportImageSniff.sniffPictureType(data) >= 0) return data;
            if (ct.contains("octet-stream") || ct.isEmpty()) {
                try (ByteArrayInputStream bin = new ByteArrayInputStream(data)) { if (ImageIO.read(bin) != null) return data; }
                catch (Exception ignored) {}
            }
            return null;
        }
    }
}
