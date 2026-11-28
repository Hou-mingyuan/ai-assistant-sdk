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
import org.springframework.web.multipart.MultipartFile;

class FileUploadControllerTest {

    @Test
    void summarizeRejectsEmptyFile() {
        FileParserService parser = mock(FileParserService.class);
        LlmService llm = mock(LlmService.class);
        FileUploadController controller = new FileUploadController(parser, llm, new UsageStats());
        MockMultipartFile file =
                new MockMultipartFile("file", "notes.txt", "text/plain", new byte[0]);

        var response = controller.summarizeFile(file);

        assertEquals(400, response.getStatusCode().value());
        assertTrue(response.getBody().getError().contains("empty"));
        verifyNoInteractions(parser, llm);
    }

    @Test
    void summarizeRejectsFileLargerThanTenMegabytes() {
        FileParserService parser = mock(FileParserService.class);
        LlmService llm = mock(LlmService.class);
        FileUploadController controller = new FileUploadController(parser, llm, new UsageStats());
        MultipartFile file = mock(MultipartFile.class);
        when(file.isEmpty()).thenReturn(false);
        when(file.getSize()).thenReturn(10L * 1024 * 1024 + 1);

        var response = controller.summarizeFile(file);

        assertEquals(400, response.getStatusCode().value());
        assertTrue(response.getBody().getError().contains("10MB"));
        verifyNoInteractions(parser, llm);
    }

    @Test
    void summarizeRejectsContentTypeExtensionMismatch() {
        FileParserService parser = mock(FileParserService.class);
        LlmService llm = mock(LlmService.class);
        FileUploadController controller = new FileUploadController(parser, llm, new UsageStats());
        MockMultipartFile file =
                new MockMultipartFile(
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
        MockMultipartFile file =
                new MockMultipartFile("file", "run.exe", "application/pdf", "%PDF".getBytes());

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
        MockMultipartFile file =
                new MockMultipartFile(
                        "file", "notes.txt", "text/plain; charset=utf-8", "hello".getBytes());
        when(parser.extractText(any())).thenReturn("hello");
        when(llm.summarize("hello", null)).thenReturn("summary");

        var response = controller.summarizeFile(file);

        assertEquals(200, response.getStatusCode().value());
        assertEquals("summary", response.getBody().getResult());
    }

    @Test
    void summarizeAnswersQuestionWhenQuestionParamProvided() throws Exception {
        FileParserService parser = mock(FileParserService.class);
        LlmService llm = mock(LlmService.class);
        FileUploadController controller = new FileUploadController(parser, llm, new UsageStats());
        MockMultipartFile file =
                new MockMultipartFile(
                        "file",
                        "contract.txt",
                        "text/plain; charset=utf-8",
                        "penalty=500".getBytes());
        when(parser.extractText(any())).thenReturn("penalty=500");
        when(llm.chat(any(), any(), any(), any(), (String) any()))
                .thenReturn("The penalty is 500.");

        var response = controller.summarizeFile(file, "What is the penalty?", "gpt-4o-mini");

        assertEquals(200, response.getStatusCode().value());
        assertEquals("The penalty is 500.", response.getBody().getResult());
    }
}
