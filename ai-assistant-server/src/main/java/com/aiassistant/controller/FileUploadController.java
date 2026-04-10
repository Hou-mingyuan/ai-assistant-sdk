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

    private final FileParserService fileParserService;
    private final LlmService llmService;
    private final UsageStats usageStats;

    public FileUploadController(FileParserService fileParserService, LlmService llmService, UsageStats usageStats) {
        this.fileParserService = fileParserService;
        this.llmService = llmService;
        this.usageStats = usageStats;
    }

    @PostMapping("/file/summarize")
    public ResponseEntity<ChatResponse> summarizeFile(
            @RequestParam("file") MultipartFile file) {
        try {
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
