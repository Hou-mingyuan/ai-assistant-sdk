package com.aiassistant.controller;

import com.aiassistant.model.ChatResponse;
import com.aiassistant.service.FileParserService;
import com.aiassistant.service.LlmService;
import com.aiassistant.stats.UsageStats;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

/**
 * 文件上传端点：接收 PDF/Word/Excel/CSV 等文件，提取纯文本后调用 LLM 进行摘要或翻译。
 * 文件大小上限由 {@link FileParserService} 内 10MB 硬限控制。
 */
@RestController
@RequestMapping("${ai-assistant.context-path:/ai-assistant}")
public class FileUploadController {

    private static final Logger log = LoggerFactory.getLogger(FileUploadController.class);
    private static final long MAX_FILE_SIZE = 10 * 1024 * 1024;

    private static final java.util.Map<String, java.util.Set<String>> ALLOWED_TYPES_BY_EXTENSION = java.util.Map.of(
            ".pdf", java.util.Set.of("application/pdf"),
            ".docx", java.util.Set.of("application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
            ".xlsx", java.util.Set.of("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
            ".doc", java.util.Set.of("application/msword"),
            ".xls", java.util.Set.of("application/vnd.ms-excel"),
            ".csv", java.util.Set.of("text/csv", "text/plain", "application/vnd.ms-excel"),
            ".txt", java.util.Set.of("text/plain"),
            ".md", java.util.Set.of("text/markdown", "text/plain", "application/octet-stream")
    );

    private final FileParserService fileParserService;
    private final LlmService llmService;
    private final UsageStats usageStats;

    public FileUploadController(FileParserService fileParserService, LlmService llmService, UsageStats usageStats) {
        this.fileParserService = fileParserService;
        this.llmService = llmService;
        this.usageStats = usageStats;
    }

    private String validateFileType(MultipartFile file) {
        if (file == null || file.isEmpty()) return "File is empty";
        if (file.getSize() > MAX_FILE_SIZE) return "File size exceeds 10MB limit";

        String name = file.getOriginalFilename();
        String ext = extensionOf(name);
        java.util.Set<String> allowedTypes = ALLOWED_TYPES_BY_EXTENSION.get(ext);
        if (allowedTypes == null) {
            return "Unsupported file extension. Allowed: pdf, docx, xlsx, doc, xls, csv, txt, md";
        }

        String contentType = normalizeContentType(file.getContentType());
        if (contentType != null && !allowedTypes.contains(contentType)) {
            return "File content type does not match extension";
        }
        return null;
    }

    private String extensionOf(String name) {
        if (name == null || name.isBlank()) {
            return "";
        }
        int dot = name.lastIndexOf('.');
        return dot >= 0 ? name.substring(dot).toLowerCase(java.util.Locale.ROOT) : "";
    }

    private String normalizeContentType(String contentType) {
        if (contentType == null || contentType.isBlank()) {
            return null;
        }
        int semicolon = contentType.indexOf(';');
        String normalized = semicolon >= 0 ? contentType.substring(0, semicolon) : contentType;
        normalized = normalized.trim().toLowerCase(java.util.Locale.ROOT);
        return normalized.isBlank() ? null : normalized;
    }

    @PostMapping("/file/summarize")
    public ResponseEntity<ChatResponse> summarizeFile(
            @RequestParam("file") MultipartFile file) {
        try {
            String typeError = validateFileType(file);
            if (typeError != null) return ResponseEntity.badRequest().body(ChatResponse.fail(typeError));
            String text = fileParserService.extractText(file);
            String result = llmService.summarize(text);
            usageStats.recordCall("file_summarize");
            return ResponseEntity.ok(ChatResponse.ok(result));
        } catch (IllegalArgumentException e) {
            usageStats.recordError();
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(ChatResponse.fail(e.getMessage()));
        } catch (Exception e) {
            usageStats.recordError();
            log.warn("File summarize failed", e);
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(ChatResponse.fail("File processing failed. Check server logs for details."));
        }
    }

    @PostMapping("/file/translate")
    public ResponseEntity<ChatResponse> translateFile(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "targetLang", defaultValue = "zh") String targetLang) {
        try {
            String typeError = validateFileType(file);
            if (typeError != null) return ResponseEntity.badRequest().body(ChatResponse.fail(typeError));
            String text = fileParserService.extractText(file);
            String result = llmService.translate(text, targetLang);
            usageStats.recordCall("file_translate");
            return ResponseEntity.ok(ChatResponse.ok(result));
        } catch (IllegalArgumentException e) {
            usageStats.recordError();
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(ChatResponse.fail(e.getMessage()));
        } catch (Exception e) {
            usageStats.recordError();
            log.warn("File translate failed", e);
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(ChatResponse.fail("File processing failed. Check server logs for details."));
        }
    }
}
