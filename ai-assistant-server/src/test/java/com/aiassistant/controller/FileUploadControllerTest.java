package com.aiassistant.controller;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.aiassistant.service.FileParserService;
import com.aiassistant.service.LlmService;
import com.aiassistant.stats.UsageStats;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

class FileUploadControllerTest {

    @Test
    void summarizeRejectsContentTypeExtensionMismatch() {
        FileParserService parser = mock(FileParserService.class);
        LlmService llm = mock(LlmService.class);
        FileUploadController controller = new FileUploadController(parser, llm, new UsageStats());
        MockMultipartFile file = new MockMultipartFile(
                "file", "report.pdf", "application/x-msdownload", "%PDF".getBytes());

        var response = controller.summarizeFile(file);

        assertEquals(400, response.getStatusCode().value());
        assertTrue(response.getBody().getError().contains("content type"));
        verifyNoInteractions(parser, llm);
    }

    @Test
    void summarizeRejectsUnsupportedExtension() {
        FileParserService parser = mock(FileParserService.class);
        LlmService llm = mock(LlmService.class);
        FileUploadController controller = new FileUploadController(parser, llm, new UsageStats());
        MockMultipartFile file = new MockMultipartFile(
                "file", "run.exe", "application/pdf", "%PDF".getBytes());

        var response = controller.summarizeFile(file);

        assertEquals(400, response.getStatusCode().value());
        assertTrue(response.getBody().getError().contains("Unsupported file extension"));
        verifyNoInteractions(parser, llm);
    }

    @Test
    void summarizeAcceptsMatchingTextFile() throws Exception {
        FileParserService parser = mock(FileParserService.class);
        LlmService llm = mock(LlmService.class);
        FileUploadController controller = new FileUploadController(parser, llm, new UsageStats());
        MockMultipartFile file = new MockMultipartFile(
                "file", "notes.txt", "text/plain; charset=utf-8", "hello".getBytes());
        when(parser.extractText(any())).thenReturn("hello");
        when(llm.summarize("hello")).thenReturn("summary");

        var response = controller.summarizeFile(file);

        assertEquals(200, response.getStatusCode().value());
        assertEquals("summary", response.getBody().getResult());
    }
}
