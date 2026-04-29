package com.aiassistant.controller;

import com.aiassistant.export.PreparedExport;
import com.aiassistant.model.ExportRequest;
import com.aiassistant.service.AssistantExportService;
import jakarta.validation.Valid;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;

@RestController
@RequestMapping("${ai-assistant.context-path:/ai-assistant}")
public class AssistantExportController {

    private final AssistantExportService exportService;

    public AssistantExportController(AssistantExportService exportService) {
        this.exportService = exportService;
    }

    @PostMapping("/export")
    public ResponseEntity<?> export(@Valid @RequestBody ExportRequest body) {
        PreparedExport p;
        try {
            p = exportService.prepare(body);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .contentType(MediaType.TEXT_PLAIN)
                    .body(e.getMessage());
        }
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.parseMediaType(p.mediaType()));
        addRFC5987Attachment(headers, p.filename());
        StreamingResponseBody stream =
                out -> {
                    try {
                        exportService.write(p, out);
                    } catch (Exception e) {
                        throw new RuntimeException("Export write failed: " + e.getMessage(), e);
                    }
                };
        return new ResponseEntity<>(stream, headers, HttpStatus.OK);
    }

    /**
     * 同时提供 ASCII {@code filename} 与 RFC 5987 {@code filename*}，避免 Windows/Chrome 把 RFC2047
     * 风格编码误当成整段文件名（另存为出现 {@code =_UTF-8_Q_...}）。
     */
    static void addRFC5987Attachment(HttpHeaders headers, String filename) {
        if (filename == null || filename.isBlank()) {
            filename = "export.bin";
        }
        int s = Math.max(filename.lastIndexOf('/'), filename.lastIndexOf('\\'));
        if (s >= 0) {
            filename = filename.substring(s + 1);
        }
        String ascii = filename.replaceAll("[^\\x20-\\x7E]", "_");
        if (ascii.isBlank()) {
            ascii = "export.bin";
        }
        ascii = ascii.replace("\"", "");
        String star = URLEncoder.encode(filename, StandardCharsets.UTF_8).replace("+", "%20");
        headers.set(
                HttpHeaders.CONTENT_DISPOSITION,
                "attachment; filename=\"" + ascii + "\"; filename*=UTF-8''" + star);
    }
}
