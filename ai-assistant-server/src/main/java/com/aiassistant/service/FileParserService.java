package com.aiassistant.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.multipart.MultipartFile;

import java.io.*;
import java.util.Arrays;
import java.lang.reflect.Method;
import java.nio.charset.StandardCharsets;
import java.util.stream.Collectors;

public class FileParserService {

    private static final Logger log = LoggerFactory.getLogger(FileParserService.class);

    private static final long MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

    private static final byte[] PDF_MAGIC = {0x25, 0x50, 0x44, 0x46}; // %PDF
    private static final byte[] ZIP_MAGIC = {0x50, 0x4b, 0x03, 0x04};
    private static final byte[] ZIP_MAGIC_EMPTY = {0x50, 0x4b, 0x05, 0x06};
    private static final byte[] OLE_MAGIC = {(byte) 0xD0, (byte) 0xCF, 0x11, (byte) 0xE0};

    public String extractText(MultipartFile file) throws IOException {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("File is empty");
        }
        if (file.getSize() > MAX_FILE_SIZE) {
            throw new IllegalArgumentException("File size exceeds 10MB limit");
        }

        String filename = file.getOriginalFilename();
        if (filename == null) filename = "";
        String ext = filename.contains(".") ? filename.substring(filename.lastIndexOf('.')).toLowerCase() : "";

        assertMagicMatchesExtension(file, ext);

        log.info("Parsing file: {} ({}KB)", filename, file.getSize() / 1024);

        try {
            String text = switch (ext) {
                case ".txt", ".md", ".csv", ".log", ".json", ".xml", ".html", ".yml", ".yaml" -> readAsText(file);
                case ".pdf" -> readPdf(file);
                case ".docx" -> readDocx(file);
                case ".doc" -> readDoc(file);
                case ".xlsx" -> readXlsx(file);
                case ".xls" -> readXls(file);
                default -> throw new IllegalArgumentException(
                        "Unsupported file type: " + ext + ". Supported: txt, md, csv, pdf, docx, doc, xlsx, xls, json, xml, html, yml");
            };
            log.info("Extracted {} characters from {}", text.length(), filename);
            return text;
        } catch (IllegalArgumentException | IllegalStateException e) {
            throw e;
        } catch (Exception e) {
            log.error("Failed to extract text from file: {}", filename, e);
            throw new RuntimeException("Failed to read file: " + e.getMessage(), e);
        }
    }

    /**
     * 对二进制 Office / PDF 做魔数校验，缓解「改扩展名触发重型解析」的滥用。
     */
    private void assertMagicMatchesExtension(MultipartFile file, String ext) throws IOException {
        switch (ext) {
            case ".pdf" -> readMagicAndRequire(file, PDF_MAGIC, "File is not a valid PDF");
            case ".docx", ".xlsx" -> readMagicZip(file);
            case ".doc", ".xls" -> readMagicAndRequire(file, OLE_MAGIC, "File is not a valid legacy Office document");
            default -> { }
        }
    }

    private static void readMagicZip(MultipartFile file) throws IOException {
        byte[] head = readHead(file, 4);
        if (startsWith(head, ZIP_MAGIC) || startsWith(head, ZIP_MAGIC_EMPTY)) {
            return;
        }
        throw new IllegalArgumentException("File is not a valid ZIP-based Office document (docx/xlsx)");
    }

    private static void readMagicAndRequire(MultipartFile file, byte[] magic, String message) throws IOException {
        byte[] head = readHead(file, magic.length);
        if (!startsWith(head, magic)) {
            throw new IllegalArgumentException(message);
        }
    }

    private static byte[] readHead(MultipartFile file, int n) throws IOException {
        try (InputStream raw = file.getInputStream();
             BufferedInputStream in = new BufferedInputStream(raw)) {
            byte[] b = new byte[n];
            int r = in.readNBytes(b, 0, n);
            if (r < n) {
                Arrays.fill(b, r, n, (byte) 0);
            }
            return b;
        }
    }

    private static boolean startsWith(byte[] data, byte[] prefix) {
        if (data.length < prefix.length) {
            return false;
        }
        for (int i = 0; i < prefix.length; i++) {
            if (data[i] != prefix[i]) {
                return false;
            }
        }
        return true;
    }

    private String readAsText(MultipartFile file) throws Exception {
        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(file.getInputStream(), StandardCharsets.UTF_8))) {
            return reader.lines().collect(Collectors.joining("\n"));
        }
    }

    private String readPdf(MultipartFile file) throws Exception {
        Object doc = null;
        try {
            Class<?> loaderClass = Class.forName("org.apache.pdfbox.Loader");
            Class<?> pdDocClass = Class.forName("org.apache.pdfbox.pdmodel.PDDocument");
            Class<?> stripperClass = Class.forName("org.apache.pdfbox.text.PDFTextStripper");

            doc = loaderClass.getMethod("loadPDF", byte[].class).invoke(null, (Object) file.getBytes());
            Object stripper = stripperClass.getDeclaredConstructor().newInstance();
            return (String) stripperClass.getMethod("getText", pdDocClass).invoke(stripper, doc);
        } catch (ClassNotFoundException e) {
            throw new IllegalStateException("PDF parsing requires pdfbox dependency. Add org.apache.pdfbox:pdfbox:3.0.2 to your project.");
        } finally {
            closeQuietly(doc);
        }
    }

    private String readDocx(MultipartFile file) throws Exception {
        Object extractor = null;
        try {
            Class<?> xwpfClass = Class.forName("org.apache.poi.xwpf.usermodel.XWPFDocument");
            Class<?> extractorClass = Class.forName("org.apache.poi.xwpf.extractor.XWPFWordExtractor");

            Object doc = xwpfClass.getDeclaredConstructor(InputStream.class).newInstance(file.getInputStream());
            extractor = extractorClass.getDeclaredConstructor(xwpfClass).newInstance(doc);
            return (String) extractorClass.getMethod("getText").invoke(extractor);
        } catch (ClassNotFoundException e) {
            throw new IllegalStateException("DOCX parsing requires poi-ooxml dependency. Add org.apache.poi:poi-ooxml:5.2.5 to your project.");
        } finally {
            closeQuietly(extractor);
        }
    }

    private String readDoc(MultipartFile file) throws Exception {
        Object extractor = null;
        try {
            Class<?> hwpfClass = Class.forName("org.apache.poi.hwpf.HWPFDocument");
            Class<?> extractorClass = Class.forName("org.apache.poi.hwpf.extractor.WordExtractor");

            Object doc = hwpfClass.getDeclaredConstructor(InputStream.class).newInstance(file.getInputStream());
            extractor = extractorClass.getDeclaredConstructor(hwpfClass).newInstance(doc);
            return (String) extractorClass.getMethod("getText").invoke(extractor);
        } catch (ClassNotFoundException e) {
            throw new IllegalStateException("DOC parsing requires poi-scratchpad dependency. Add org.apache.poi:poi-scratchpad:5.2.5 to your project.");
        } finally {
            closeQuietly(extractor);
        }
    }

    private String readXlsx(MultipartFile file) throws Exception {
        try {
            Class<?> xssfClass = Class.forName("org.apache.poi.xssf.usermodel.XSSFWorkbook");
            return readWorkbook(xssfClass, file);
        } catch (ClassNotFoundException e) {
            throw new IllegalStateException("XLSX parsing requires poi-ooxml dependency. Add org.apache.poi:poi-ooxml:5.2.5 to your project.");
        }
    }

    private String readXls(MultipartFile file) throws Exception {
        try {
            Class<?> hssfClass = Class.forName("org.apache.poi.hssf.usermodel.HSSFWorkbook");
            return readWorkbook(hssfClass, file);
        } catch (ClassNotFoundException e) {
            throw new IllegalStateException("XLS parsing requires poi dependency. Add org.apache.poi:poi:5.2.5 to your project.");
        }
    }

    private String readWorkbook(Class<?> workbookClass, MultipartFile file) throws Exception {
        Class<?> workbookInterface = Class.forName("org.apache.poi.ss.usermodel.Workbook");
        Class<?> sheetInterface = Class.forName("org.apache.poi.ss.usermodel.Sheet");
        Class<?> cellInterface = Class.forName("org.apache.poi.ss.usermodel.Cell");
        Class<?> formatterClass = Class.forName("org.apache.poi.ss.usermodel.DataFormatter");

        Object workbook = workbookClass.getDeclaredConstructor(InputStream.class).newInstance(file.getInputStream());
        try {
            Object formatter = formatterClass.getDeclaredConstructor().newInstance();
            StringBuilder sb = new StringBuilder();
            int sheetCount = (int) workbookInterface.getMethod("getNumberOfSheets").invoke(workbook);

            for (int s = 0; s < sheetCount; s++) {
                Object sheet = workbookInterface.getMethod("getSheetAt", int.class).invoke(workbook, s);
                String sheetName = (String) sheetInterface.getMethod("getSheetName").invoke(sheet);
                sb.append("--- Sheet: ").append(sheetName).append(" ---\n");

                for (Object row : (Iterable<?>) sheet) {
                    StringBuilder rowStr = new StringBuilder();
                    for (Object cell : (Iterable<?>) row) {
                        if (rowStr.length() > 0) rowStr.append("\t");
                        String val = (String) formatterClass.getMethod("formatCellValue", cellInterface)
                                .invoke(formatter, cell);
                        rowStr.append(val);
                    }
                    sb.append(rowStr).append("\n");
                }
            }
            return sb.toString();
        } finally {
            closeQuietly(workbook);
        }
    }

    private void closeQuietly(Object closeable) {
        if (closeable == null) return;
        try {
            Method closeMethod = closeable.getClass().getMethod("close");
            closeMethod.invoke(closeable);
        } catch (Exception ignored) {
        }
    }
}
