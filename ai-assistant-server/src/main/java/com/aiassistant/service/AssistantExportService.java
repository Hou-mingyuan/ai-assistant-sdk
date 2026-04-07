package com.aiassistant.service;

import com.aiassistant.config.AiAssistantProperties;

import com.aiassistant.export.ExportHttpUrls;
import com.aiassistant.export.ExportImageSniff;
import com.aiassistant.export.ExportMarkdownPatterns;
import com.aiassistant.export.ExportMarkdownUrls;
import com.aiassistant.export.ExportTextLayout;
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

import java.io.IOException;

import java.io.ByteArrayInputStream;

import java.io.ByteArrayOutputStream;

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

                            .followRedirects(HttpClient.Redirect.NORMAL)

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

        return switch (fmt) {

            case "xlsx" -> new PreparedExport(fmt,

                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",

                    baseName + ".xlsx", List.copyOf(messages));

            case "docx" -> new PreparedExport(fmt,

                    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",

                    baseName + ".docx", List.copyOf(messages));

            default -> new PreparedExport("pdf", "application/pdf", baseName + ".pdf", List.copyOf(messages));

        };

    }

    public void write(PreparedExport prepared, OutputStream out) throws Exception {

        switch (prepared.formatKey()) {

            case "xlsx" -> ExportXlsxWriter.write(prepared.messages(), out);

            case "docx" -> {

                try {

                    EXPORT_IMAGE_CACHE.set(prefetchExportImages(prepared.messages()));

                    writeDocx(prepared.messages(), out);

                } finally {

                    EXPORT_IMAGE_CACHE.remove();

                }

            }

            default -> {

                try {

                    EXPORT_IMAGE_CACHE.set(prefetchExportImages(prepared.messages()));

                    writePdf(prepared.messages(), out);

                } finally {

                    EXPORT_IMAGE_CACHE.remove();

                }

            }

        }

    }

    private void writeDocx(List<ExportRequest.MessageRow> messages, OutputStream out) throws Exception {

        try (XWPFDocument d = new XWPFDocument()) {

            for (ExportRequest.MessageRow m : messages) {

                String role = m != null && m.getRole() != null ? m.getRole() : "";

                String content = m != null && m.getContent() != null ? m.getContent() : "";

                XWPFParagraph rp = d.createParagraph();

                XWPFRun r0 = rp.createRun();

                r0.setBold(true);

                r0.setText("[" + role + "]");

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

    private void writePdf(List<ExportRequest.MessageRow> messages, OutputStream out) throws Exception {

        try (PDDocument doc = new PDDocument()) {

            FontCtx font = loadFont(doc);

            PdfLayout L = new PdfLayout(doc, font);

            for (ExportRequest.MessageRow m : messages) {

                String role = m != null && m.getRole() != null ? m.getRole() : "";

                String content = m != null && m.getContent() != null ? m.getContent() : "";

                L.printRoleLine("[" + role + "]");

                appendMarkdownPdf(L, content);

                L.gap();

            }

            L.close();

            doc.save(out);

        }

    }

    private final class PdfLayout {

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

        PdfLayout(PDDocument document, FontCtx fontCtx) throws Exception {

            this.doc = document;

            this.font = fontCtx;

            this.textWidth = pageW - 2 * margin;

            this.page = new PDPage(PDRectangle.A4);

            doc.addPage(page);

            this.cs = new PDPageContentStream(doc, page);

            this.y = pageH - margin;

        }

        void newPage() throws Exception {

            if (cs != null) {

                cs.close();

            }

            page = new PDPage(PDRectangle.A4);

            doc.addPage(page);

            cs = new PDPageContentStream(doc, page);

            y = pageH - margin;

        }

        void ensureSpace(float needBelowY) throws Exception {

            float need = needBelowY;

            float usable = pageH - 2 * margin;

            if (need > usable) {

                need = usable;

            }

            if (y - need < margin) {

                newPage();

            }

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

            float iw = img.getWidth();

            float ih = img.getHeight();

            float maxW = textWidth;

            float maxH = pageH - 2 * margin - 8f;

            float scale = Math.min(1f, maxW / iw);

            float dw = iw * scale;

            float dh = ih * scale;

            if (dh > maxH) {

                float sh = maxH / dh;

                dw *= sh;

                dh = maxH;

            }

            float gap = 8f;

            ensureSpace(dh + gap);

            float drawBottom = y - gap - dh;

            cs.drawImage(img, margin, drawBottom, dw, dh);

            y = drawBottom - gap;

        }

        void gap() throws Exception {

            y -= defaultLeading * 0.5f;

        }

        void close() throws Exception {

            if (cs != null) {

                cs.close();

            }

        }

    }

    private void appendMarkdownPdf(PdfLayout L, String markdown) throws Exception {

        String text = markdown == null ? "" : markdown.replace("\r\n", "\n").replace('\r', '\n');

        String[] lines = text.split("\n", -1);

        boolean inCode = false;

        StringBuilder codeBuf = new StringBuilder();

        int i = 0;

        while (i < lines.length) {

            String line = lines[i];

            if (inCode) {

                if (line.trim().startsWith("```")) {

                    String body = codeBuf.toString();

                    for (String wl : wrapToLines(body.replace("\t", "    "), L.font, 9, L.textWidth - 24)) {

                        L.printLineRaw(wl, 9f, 11f);

                    }

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

                float sz = switch (level) {

                    case 1 -> 16;

                    case 2 -> 14;

                    case 3 -> 13;

                    default -> 12;

                };

                int lvl = hm.group(1).length();

                float hang = Math.min(56f, lvl * 10f);

                emitPdfLineWithImages(L, hm.group(2), sz, sz + 3, Math.max(120f, L.textWidth - hang));

                i++;

                continue;

            }

            if (line.startsWith(">")) {

                String q = line.replaceFirst("^>\\s?", "");

                emitPdfLineWithImages(L, q, L.defaultSize, L.defaultLeading, L.textWidth - 36f);

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

                emitPdfLineWithImages(L, "• " + listBody, L.defaultSize, L.defaultLeading, L.textWidth - 28f);

                i++;

                continue;

            }

            Matcher loneImg = ExportMarkdownPatterns.MD_IMAGE.matcher(trimmed);

            if (loneImg.matches() && trimmed.indexOf('!') == 0 && trimmed.lastIndexOf(')') == trimmed.length() - 1) {

                pdfImageOrNote(L, loneImg.group(2).trim());

                i++;

                continue;

            }

            emitPdfLineWithImages(L, line, L.defaultSize, L.defaultLeading);

            i++;

        }

        if (inCode) {

            String body = codeBuf.toString();

            for (String wl : wrapToLines(body.replace("\t", "    "), L.font, 9, L.textWidth - 24)) {

                L.printLineRaw(wl, 9f, 11f);

            }

        }

    }

    private void emitPdfLineWithImages(PdfLayout L, String line, float fontSize, float leading) throws Exception {

        emitPdfLineWithImages(L, line, fontSize, leading, L.textWidth);

    }

    private void emitPdfLineWithImages(PdfLayout L, String line, float fontSize, float leading, float maxTextW) throws Exception {

        line = ExportMarkdownUrls.stripInlineMdForPdf(line);

        Matcher m = ExportMarkdownPatterns.MD_IMAGE.matcher(line);

        if (!m.find()) {

            for (String wl : wrapToLines(line, L.font, fontSize, maxTextW)) {

                L.printLineRaw(wl, fontSize, leading);

            }

            return;

        }

        int last = 0;

        do {

            if (m.start() > last) {

                String before = line.substring(last, m.start());

                for (String wl : wrapToLines(before, L.font, fontSize, maxTextW)) {

                    L.printLineRaw(wl, fontSize, leading);

                }

            }

            pdfImageOrNote(L, m.group(2).trim());

            last = m.end();

        } while (m.find());

        if (last < line.length()) {

            String rest = line.substring(last);

            for (String wl : wrapToLines(rest, L.font, fontSize, maxTextW)) {

                L.printLineRaw(wl, fontSize, leading);

            }

        }

    }

    private Map<String, byte[]> prefetchExportImages(List<ExportRequest.MessageRow> messages) {

        if (!properties.isExportEmbedImages()) {

            return Map.of();

        }

        Set<String> urls = new LinkedHashSet<>();

        for (ExportRequest.MessageRow m : messages) {

            ExportMarkdownUrls.collectMarkdownImageUrls(m != null ? m.getContent() : null, urls);

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

    private void pdfImageOrNote(PdfLayout L, String url) throws Exception {

        byte[] bytes = null;

        if (properties.isExportEmbedImages()) {

            bytes = lookupExportImageBytes(url);

            if (bytes == null) {

                bytes = fetchImageBytes(url);

            }

        }

        if (bytes != null && bytes.length > 0) {

            L.drawImage(bytes);

        } else {

            L.printWrapped("[图片] " + url, L.defaultSize, false);

        }

    }

    private byte[] fetchImageBytes(String urlStr) {

        if (!ExportHttpUrls.isAllowedHttpUrl(urlStr)) {

            return null;

        }

        try {

            URI u = URI.create(urlStr.trim());

            if (properties.isUrlFetchSsrfProtection()) {

                UrlFetchSafety.validateHttpUrlForServerSideFetch(u);

            }

        } catch (IllegalArgumentException e) {

            return null;

        }

        int max = Math.max(8192, properties.getExportMaxImageBytes());

        HttpClient client = exportHttpClient();

        HttpRequest req = HttpRequest.newBuilder()

                .uri(URI.create(urlStr.trim()))

                .timeout(Duration.ofSeconds(Math.max(5, properties.getUrlFetchTimeoutSeconds())))

                .header("User-Agent", "Mozilla/5.0 (compatible; AiAssistant-Export/1.0)")

                .header("Accept", "image/avif,image/webp,image/apng,image/*,*/*;q=0.8")

                .GET()

                .build();

        try {

            HttpResponse<InputStream> res = client.send(req, HttpResponse.BodyHandlers.ofInputStream());

            if (res.statusCode() / 100 != 2) {

                return null;

            }

            try (InputStream in = res.body(); ByteArrayOutputStream bos = new ByteArrayOutputStream()) {

                byte[] buf = new byte[8192];

                int n;

                while ((n = in.read(buf)) >= 0) {

                    bos.write(buf, 0, n);

                    if (bos.size() > max) {

                        return null;

                    }

                }

                byte[] data = bos.toByteArray();

                String ct = res.headers().firstValue("Content-Type").orElse("").toLowerCase(Locale.ROOT);

                if (ct.startsWith("image/")) {

                    return data;

                }

                if (ExportImageSniff.sniffPictureType(data) >= 0) {

                    return data;

                }

                if (ct.contains("octet-stream") || ct.isEmpty()) {

                    try (ByteArrayInputStream bin = new ByteArrayInputStream(data)) {

                        if (ImageIO.read(bin) != null) {

                            return data;

                        }

                    } catch (Exception ignored) {

                    }

                }

                return null;

            }

        } catch (Exception e) {

            return null;

        }

    }

    private interface FontCtx {

        void useFont(PDPageContentStream cs, float size) throws Exception;

        void showLine(PDPageContentStream cs, String line) throws Exception;

        /** 当前字号下字符串可视宽度（与 PDF 绘制一致，避免近似换行导致超出页面被裁切） */
        float stringWidth(String text, float fontSize) throws IOException;

    }

    private FontCtx loadFont(PDDocument doc) throws Exception {

        String spec = properties.getExportPdfUnicodeFont();

        if (spec != null && !spec.isBlank()) {

            try (InputStream in = openFontStream(spec)) {

                if (in != null) {

                    PDType0Font t0 = PDType0Font.load(doc, in);

                    return new FontCtx() {

                        @Override

                        public void useFont(PDPageContentStream cs, float size) throws Exception {

                            cs.setFont(t0, size);

                        }

                        @Override

                        public void showLine(PDPageContentStream cs, String line) throws Exception {

                            cs.showText(line);

                        }

                        @Override

                        public float stringWidth(String text, float fontSize) throws IOException {

                            if (text == null || text.isEmpty()) {

                                return 0f;

                            }

                            return t0.getStringWidth(text) / 1000f * fontSize;

                        }

                    };

                }

            }

        }

        PDType1Font helv = new PDType1Font(Standard14Fonts.FontName.HELVETICA);

        return new FontCtx() {

            @Override

            public void useFont(PDPageContentStream cs, float size) throws Exception {

                cs.setFont(helv, size);

            }

            @Override

            public void showLine(PDPageContentStream cs, String line) throws Exception {

                byte[] ascii = line.getBytes(StandardCharsets.US_ASCII);

                String safe = new String(ascii, StandardCharsets.US_ASCII);

                cs.showText(safe);

            }

            @Override

            public float stringWidth(String text, float fontSize) throws IOException {

                if (text == null || text.isEmpty()) {

                    return 0f;

                }

                byte[] ascii = text.getBytes(StandardCharsets.US_ASCII);

                String safe = new String(ascii, StandardCharsets.US_ASCII);

                if (safe.isEmpty()) {

                    return 0f;

                }

                return helv.getStringWidth(safe) / 1000f * fontSize;

            }

        };

    }

    private InputStream openFontStream(String spec) throws Exception {

        if (spec.startsWith("classpath:")) {

            Resource r = new DefaultResourceLoader().getResource(spec);

            if (r.exists()) {

                return r.getInputStream();

            }

        } else if (spec.startsWith("file:")) {

            return new DefaultResourceLoader().getResource(spec).getInputStream();

        } else {

            Path p = Path.of(spec);

            if (Files.isRegularFile(p)) {

                return Files.newInputStream(p);

            }

        }

        return null;

    }

    private List<String> wrapToLines(String text, FontCtx font, float fontSize, float maxW) throws IOException {

        List<String> lines = new ArrayList<>();

        if (text == null || text.isEmpty()) {

            lines.add("");

            return lines;

        }

        for (String para : text.split("\n", -1)) {

            if (para.isEmpty()) {

                lines.add("");

                continue;

            }

            wrapParagraphByMeasurement(font, fontSize, maxW, lines, para);

        }

        return lines;

    }

    /**
     * 按 PDF 字体真实宽度换行（二分查找优化，O(n log n) 替代逐字符 O(n^2)）。
     * 每行通过二分定位最后一个不超出 maxW 的码点偏移。
     */
    private void wrapParagraphByMeasurement(FontCtx font, float fontSize, float maxW, List<String> lines, String para)
            throws IOException {
        int i = 0;
        final int cpLen = para.codePointCount(0, para.length());
        int cpStart = 0;
        while (cpStart < cpLen) {
            int lo = 1;
            int hi = cpLen - cpStart;
            int best = 0;
            while (lo <= hi) {
                int mid = (lo + hi) >>> 1;
                int charEnd = para.offsetByCodePoints(i, mid);
                float w = font.stringWidth(para.substring(i, charEnd), fontSize);
                if (w <= maxW) {
                    best = mid;
                    lo = mid + 1;
                } else {
                    hi = mid - 1;
                }
            }
            if (best == 0) {
                best = 1;
            }
            int charEnd = para.offsetByCodePoints(i, best);
            lines.add(para.substring(i, charEnd));
            i = charEnd;
            cpStart += best;
        }
    }

}

