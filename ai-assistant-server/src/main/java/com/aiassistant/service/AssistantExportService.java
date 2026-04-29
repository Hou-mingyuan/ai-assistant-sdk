package com.aiassistant.service;

import com.aiassistant.config.AiAssistantProperties;
import com.aiassistant.export.ExportHttpUrls;
import com.aiassistant.export.ExportImageSniff;
import com.aiassistant.export.ExportMarkdownPatterns;
import com.aiassistant.export.ExportMarkdownUrls;
import com.aiassistant.export.ExportTextLayout;
import com.aiassistant.export.ExportPdfWriter;
import com.aiassistant.export.ExportXlsxWriter;
import com.aiassistant.export.PreparedExport;
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
import org.apache.poi.util.Units;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.apache.poi.xwpf.usermodel.XWPFParagraph;
import org.apache.poi.xwpf.usermodel.XWPFRun;
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
import java.util.regex.Pattern;

/**
 * Exports chat sessions to XLSX, DOCX, or PDF.
 * <p>Handles Markdown rendering (headings, code blocks, lists, inline bold/code),
 * HTTP image embedding with SSRF protection, and CJK-aware PDF text wrapping.</p>
 */
public class AssistantExportService {

    private static final ExecutorService EXPORT_IMAGE_POOL =
            Executors.newFixedThreadPool(4, r -> { Thread t = new Thread(r, "ai-export-img"); t.setDaemon(true); return t; });
    private static final ThreadLocal<Map<String, byte[]>> EXPORT_IMAGE_CACHE = new ThreadLocal<>();

    private final AiAssistantProperties properties;

    /** 导出拉图复用，避免每张图新建 HttpClient */
    private volatile HttpClient exportHttpClient;

    public AssistantExportService(AiAssistantProperties properties) {
        this.properties = properties;
    }

    private HttpClient exportHttpClient() {
        HttpClient c = exportHttpClient;
        if (c == null) {
            synchronized (this) {
                c = exportHttpClient;
                if (c == null) {
                    c = HttpClient.newBuilder()
                            .followRedirects(HttpClient.Redirect.NEVER)
                            .connectTimeout(Duration.ofSeconds(10))
                            .build();
                    exportHttpClient = c;
                }
            }
        }
        return c;
    }

    public PreparedExport prepare(ExportRequest req) {
        if (req == null || req.getFormat() == null || req.getFormat().isBlank()) {
            throw new IllegalArgumentException("format is required");
        }
        String fmt = req.getFormat().trim().toLowerCase(Locale.ROOT);
        if (!List.of("xlsx", "docx", "pdf").contains(fmt)) {
            throw new IllegalArgumentException("unsupported format: " + req.getFormat());
        }
        List<ExportRequest.MessageRow> messages = req.getMessages();
        if (messages == null || messages.isEmpty()) {
            throw new IllegalArgumentException("messages is required");
        }
        int maxMsgs = Math.max(1, properties.getExportMaxMessages());
        if (messages.size() > maxMsgs) {
            throw new IllegalArgumentException("too many messages (max " + maxMsgs + ")");
        }
        int maxChars = Math.max(1, properties.getExportMaxTotalChars());
        int total = 0;
        for (ExportRequest.MessageRow r : messages) {
            if (r != null && r.getContent() != null) {
                total += r.getContent().length();
            }
            if (r != null && r.getRole() != null) {
                total += r.getRole().length();
            }
        }
        if (total > maxChars) {
            throw new IllegalArgumentException("messages exceed size limit");
        }
        String title = req.getTitle() != null && !req.getTitle().isBlank() ? req.getTitle().trim() : "export";
        String baseName = ExportTextLayout.sanitizeFileStem(title);
        boolean dark = req.isDarkTheme();
        return switch (fmt) {
            case "xlsx" -> new PreparedExport(fmt,
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    baseName + ".xlsx", List.copyOf(messages), dark);
            case "docx" -> new PreparedExport(fmt,
                    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                    baseName + ".docx", List.copyOf(messages), dark);
            default -> new PreparedExport("pdf", "application/pdf", baseName + ".pdf", List.copyOf(messages), dark);
        };
    }

    public void write(PreparedExport prepared, OutputStream out) throws Exception {
        switch (prepared.formatKey()) {
            case "xlsx" -> ExportXlsxWriter.write(prepared.messages(), out, prepared.darkTheme());
            case "docx" -> {
                try {
                    EXPORT_IMAGE_CACHE.set(prefetchExportImages(prepared.messages()));
                    writeDocx(prepared.messages(), out, prepared.darkTheme());
                } finally {
                    EXPORT_IMAGE_CACHE.remove();
                }
            }
            default -> {
                try {
                    EXPORT_IMAGE_CACHE.set(prefetchExportImages(prepared.messages()));
                    writePdf(prepared.messages(), out, prepared.darkTheme());
                } finally {
                    EXPORT_IMAGE_CACHE.remove();
                }
            }
        }
    }

    private void writeDocx(List<ExportRequest.MessageRow> messages, OutputStream out, boolean dark) throws Exception {
        try (XWPFDocument d = new XWPFDocument()) {
            for (ExportRequest.MessageRow m : messages) {
                String role = m != null && m.getRole() != null ? m.getRole() : "";
                String content = m != null && m.getContent() != null ? m.getContent() : "";
                XWPFParagraph rp = d.createParagraph();
                XWPFRun r0 = rp.createRun();
                r0.setBold(true);
                r0.setText("[" + role + "]");
                if (dark) r0.setColor("6366F1");
                appendMarkdownDocx(d, ExportTextLayout.hardWrapLongPhysicalLinesPreserveMdImages(content, 54));
                d.createParagraph();
            }
            d.write(out);
        }
    }

    private void appendMarkdownDocx(XWPFDocument d, String markdown) throws Exception {
        String text = markdown == null ? "" : markdown.replace("\r\n", "\n");
        String[] lines = text.split("\n", -1);
        boolean inCode = false;
        StringBuilder codeBuf = new StringBuilder();
        int i = 0;
        while (i < lines.length) {
            String line = lines[i];
            if (inCode) {
                if (line.trim().startsWith("```")) {
                    flushCodeBlockDocx(d, codeBuf.toString());
                    codeBuf.setLength(0);
                    inCode = false;
                } else {
                    if (!codeBuf.isEmpty()) {
                        codeBuf.append('\n');
                    }
                    codeBuf.append(line);
                }
                i++;
                continue;
            }
            if (line.trim().startsWith("```")) {
                inCode = true;
                i++;
                continue;
            }
            String trimmed = line.trim();
            if (trimmed.isEmpty()) {
                i++;
                continue;
            }
            Matcher hm = ExportMarkdownPatterns.MD_HEADING.matcher(line);
            if (hm.matches()) {
                int level = hm.group(1).length();
                XWPFParagraph p = d.createParagraph();
                appendInlineImagesDocx(d, p, hm.group(2), level);
                i++;
                continue;
            }
            if (line.startsWith(">")) {
                String q = line.replaceFirst("^>\\s?", "");
                XWPFParagraph p = d.createParagraph();
                p.setIndentationLeft(360);
                appendInlineImagesDocx(d, p, q, -1);
                i++;
                continue;
            }
            String listBody = null;
            if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
                listBody = trimmed.substring(2);
            } else {
                Matcher om = ExportMarkdownPatterns.MD_OL.matcher(trimmed);
                if (om.matches()) {
                    listBody = om.group(2);
                }
            }
            if (listBody != null) {
                XWPFParagraph p = d.createParagraph();
                XWPFRun r = p.createRun();
                r.setText("• ");
                appendInlineImagesDocx(d, p, listBody, 0);
                i++;
                continue;
            }
            Matcher loneImg = ExportMarkdownPatterns.MD_IMAGE.matcher(trimmed);
            if (loneImg.matches() && trimmed.indexOf('!') == 0 && trimmed.lastIndexOf(')') == trimmed.length() - 1) {
                XWPFParagraph picP = d.createParagraph();
                embedOrFallbackDocx(d, picP, loneImg.group(2).trim());
                i++;
                continue;
            }
            XWPFParagraph p = d.createParagraph();
            appendInlineImagesDocx(d, p, line, 0);
            i++;
        }
        if (inCode) {
            flushCodeBlockDocx(d, codeBuf.toString());
        }
    }

    /**
     * @param textStyle 0 正文；-1 引用斜体；1–6 对应 Markdown 标题级别（字号+粗体）
     */
    private static void applyDocxTextStyle(XWPFRun r, int textStyle) {
        if (textStyle == -1) {
            r.setItalic(true);
        }
        if (textStyle >= 1 && textStyle <= 6) {
            r.setBold(true);
            r.setFontSize(switch (textStyle) {
                case 1 -> 20;
                case 2 -> 18;
                case 3 -> 16;
                default -> 14;
            });
        }
    }

    private void flushCodeBlockDocx(XWPFDocument d, String code) throws Exception {
        XWPFParagraph p = d.createParagraph();
        p.setIndentationLeft(280);
        XWPFRun r = p.createRun();
        r.setFontFamily("Courier New");
        r.setFontSize(9);
        String body = ExportTextLayout.hardWrapLongPhysicalLines(code.replace("\t", "    "), 96).trim();
        r.setText(body.isEmpty() ? " " : body);
    }

    /** Word：内联 **粗体**、`代码`，与前端 Markdown 观感接近 */
    private void appendRichDocxInParagraph(XWPFParagraph p, String text, int textStyle) throws Exception {
        if (text == null || text.isEmpty()) {
            return;
        }
        int pos = 0;
        final String s = text;
        while (pos < s.length()) {
            Matcher mb = ExportMarkdownPatterns.MD_INLINE_BOLD.matcher(s);
            mb.region(pos, s.length());
            int bi = Integer.MAX_VALUE;
            int bj = -1;
            String boldInner = null;
            if (mb.find()) {
                bi = mb.start();
                bj = mb.end();
                boldInner = mb.group(1);
            }
            Matcher mc = ExportMarkdownPatterns.MD_INLINE_CODE.matcher(s);
            mc.region(pos, s.length());
            int ci = Integer.MAX_VALUE;
            int cj = -1;
            String codeInner = null;
            if (mc.find()) {
                ci = mc.start();
                cj = mc.end();
                codeInner = mc.group(1);
            }
            if (bi == Integer.MAX_VALUE && ci == Integer.MAX_VALUE) {
                XWPFRun r = p.createRun();
                applyDocxTextStyle(r, textStyle);
                r.setText(s.substring(pos));
                break;
            }
            if (bi <= ci) {
                if (bi > pos) {
                    XWPFRun r = p.createRun();
                    applyDocxTextStyle(r, textStyle);
                    r.setText(s.substring(pos, bi));
                }
                XWPFRun r = p.createRun();
                applyDocxTextStyle(r, textStyle);
                r.setBold(true);
                r.setText(boldInner == null ? "" : boldInner);
                pos = bj;
            } else {
                if (ci > pos) {
                    XWPFRun r = p.createRun();
                    applyDocxTextStyle(r, textStyle);
                    r.setText(s.substring(pos, ci));
                }
                XWPFRun r = p.createRun();
                r.setFontFamily("Courier New");
                r.setFontSize(9);
                r.setText(codeInner == null ? "" : codeInner);
                pos = cj;
            }
        }
    }

    private void appendInlineImagesDocx(XWPFDocument d, XWPFParagraph p, String line, int textStyle) throws Exception {
        Matcher m = ExportMarkdownPatterns.MD_IMAGE.matcher(line);
        int last = 0;
        if (!m.find()) {
            appendRichDocxInParagraph(p, line, textStyle);
            return;
        }
        do {
            if (m.start() > last) {
                appendRichDocxInParagraph(p, line.substring(last, m.start()), textStyle);
            }
            embedOrFallbackDocx(d, p, m.group(2).trim());
            last = m.end();
        } while (m.find());
        if (last < line.length()) {
            appendRichDocxInParagraph(p, line.substring(last), textStyle);
        }
    }

    /** 图片插在调用方段落内，避免与正文脱节 */
    private void embedOrFallbackDocx(XWPFDocument d, XWPFParagraph p, String url) throws Exception {
        byte[] bytes = null;
        if (properties.isExportEmbedImages()) {
            bytes = lookupExportImageBytes(url);
            if (bytes == null) {
                bytes = fetchImageBytes(url);
            }
        }
        if (bytes == null || bytes.length == 0) {
            XWPFRun fr = p.createRun();
            fr.setItalic(true);
            fr.setText(" [图片未嵌入: " + url + "] ");
            return;
        }
        int type = ExportImageSniff.sniffPictureType(bytes);
        if (type < 0) {
            XWPFRun fr = p.createRun();
            fr.setItalic(true);
            fr.setText(" [图片无法插入: " + url + "] ");
            return;
        }
        int[] dim = ExportImageSniff.imagePixelSize(bytes);
        int maxPx = 480;
        double sc = dim[0] > 0 ? Math.min(1.0, maxPx / (double) dim[0]) : 1.0;
        int wEmu = Units.pixelToEMU(Math.max(1, (int) Math.round(dim[0] * sc)));
        int hEmu = Units.pixelToEMU(Math.max(1, (int) Math.round(dim[1] * sc)));
        XWPFRun ir = p.createRun();
        try (ByteArrayInputStream in = new ByteArrayInputStream(bytes)) {
            ir.addPicture(in, type, "img", wEmu, hEmu);
        }
    }

    private void writePdf(List<ExportRequest.MessageRow> messages, OutputStream out, boolean dark) throws Exception {
        new ExportPdfWriter(properties).write(messages, out, dark);
    }

    private Map<String, byte[]> prefetchExportImages(List<ExportRequest.MessageRow> messages) {
        if (!properties.isExportEmbedImages()) {
            return Map.of();
        }
        Set<String> urls = new LinkedHashSet<>();
        int maxImageUrls = properties.getExportMaxImageUrls();
        if (maxImageUrls <= 0) {
            return Map.of();
        }
        for (ExportRequest.MessageRow m : messages) {
            ExportMarkdownUrls.collectMarkdownImageUrls(m != null ? m.getContent() : null, urls, maxImageUrls);
            if (urls.size() >= maxImageUrls) {
                break;
            }
        }
        if (urls.isEmpty()) {
            return Map.of();
        }
        ConcurrentHashMap<String, byte[]> out = new ConcurrentHashMap<>();
        List<CompletableFuture<Void>> futures = new ArrayList<>();
        for (String u : urls) {
            futures.add(CompletableFuture.runAsync(() -> {
                byte[] b = fetchImageBytes(u);
                if (b != null && b.length > 0) {
                    out.put(u, b);
                }
            }, EXPORT_IMAGE_POOL));
        }
        CompletableFuture.allOf(futures.toArray(new CompletableFuture[0])).join();
        return out;
    }

    private byte[] lookupExportImageBytes(String url) {
        Map<String, byte[]> cache = EXPORT_IMAGE_CACHE.get();
        if (cache == null) {
            return null;
        }
        return cache.get(url);
    }

    private static final int MAX_IMAGE_REDIRECTS = 5;

    private byte[] fetchImageBytes(String urlStr) {
        if (!ExportHttpUrls.isAllowedHttpUrl(urlStr)) {
            return null;
        }
        URI current;
        try {
            current = URI.create(urlStr.trim());
            if (properties.isUrlFetchSsrfProtection()) {
                UrlFetchSafety.validateHttpUrlForServerSideFetch(current);
            }
        } catch (IllegalArgumentException e) {
            return null;
        }
        int max = Math.max(8192, properties.getExportMaxImageBytes());
        HttpClient client = exportHttpClient();
        Duration timeout = Duration.ofSeconds(Math.max(5, properties.getUrlFetchTimeoutSeconds()));
        try {
            for (int hop = 0; hop <= MAX_IMAGE_REDIRECTS; hop++) {
                HttpRequest req = HttpRequest.newBuilder()
                        .uri(current)
                        .timeout(timeout)
                        .header("User-Agent", "Mozilla/5.0 (compatible; AiAssistant-Export/1.0)")
                        .header("Accept", "image/avif,image/webp,image/apng,image/*,*/*;q=0.8")
                        .GET()
                        .build();
                HttpResponse<InputStream> res = client.send(req, HttpResponse.BodyHandlers.ofInputStream());
                int code = res.statusCode();
                if (code >= 301 && code <= 308 && code != 304) {
                    String location = res.headers().firstValue("Location").orElse(null);
                    if (location == null || location.isBlank()) return null;
                    current = current.resolve(location);
                    if (properties.isUrlFetchSsrfProtection()) {
                        UrlFetchSafety.validateHttpUrlForServerSideFetch(current);
                    }
                    continue;
                }
                if (code / 100 != 2) return null;
                return readImageResponse(res, max);
            }
        } catch (Exception e) {
            return null;
        }
        return null;
    }

    private byte[] readImageResponse(HttpResponse<InputStream> res, int max) throws IOException {
        try (InputStream in = res.body(); ByteArrayOutputStream bos = new ByteArrayOutputStream()) {
            byte[] buf = new byte[8192];
            int n;
            while ((n = in.read(buf)) >= 0) {
                bos.write(buf, 0, n);
                if (bos.size() > max) return null;
            }
            byte[] data = bos.toByteArray();
            String ct = res.headers().firstValue("Content-Type").orElse("").toLowerCase(Locale.ROOT);
            if (ct.startsWith("image/")) return data;
            if (ExportImageSniff.sniffPictureType(data) >= 0) return data;
            if (ct.contains("octet-stream") || ct.isEmpty()) {
                try (ByteArrayInputStream bin = new ByteArrayInputStream(data)) {
                    if (ImageIO.read(bin) != null) return data;
                } catch (Exception ignored) {}
            }
            return null;
        }
    }

}
