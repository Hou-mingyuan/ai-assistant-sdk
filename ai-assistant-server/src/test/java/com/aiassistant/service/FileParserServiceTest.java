package com.aiassistant.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.aiassistant.config.AiAssistantProperties;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

class FileParserServiceTest {

    @Test
    void rejectsPdfWhenMagicDoesNotMatchExtension() {
        FileParserService parser = new FileParserService();
        MockMultipartFile file =
                new MockMultipartFile(
                        "file", "report.pdf", "application/pdf", "not-pdf".getBytes());

        IllegalArgumentException error =
                assertThrows(IllegalArgumentException.class, () -> parser.extractText(file));

        assertTrue(error.getMessage().contains("valid PDF"));
    }

    @Test
    void rejectsOoxmlWhenMagicDoesNotMatchExtension() {
        FileParserService parser = new FileParserService();
        MockMultipartFile file =
                new MockMultipartFile(
                        "file",
                        "report.docx",
                        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                        "not-zip".getBytes());

        IllegalArgumentException error =
                assertThrows(IllegalArgumentException.class, () -> parser.extractText(file));

        assertTrue(error.getMessage().contains("ZIP-based Office"));
    }

    @Test
    void extractTextTruncatesTextFilesAtConfiguredLimit() throws Exception {
        AiAssistantProperties properties = new AiAssistantProperties();
        properties.setFileMaxExtractedChars(5);
        FileParserService parser = new FileParserService(properties);
        MockMultipartFile file =
                new MockMultipartFile(
                        "file",
                        "notes.txt",
                        "text/plain",
                        "hello world".getBytes(StandardCharsets.UTF_8));

        String text = parser.extractText(file);

        assertEquals("hello", text);
    }

    @Test
    void extractTextCanDisableExtractedTextLimit() throws Exception {
        AiAssistantProperties properties = new AiAssistantProperties();
        properties.setFileMaxExtractedChars(0);
        FileParserService parser = new FileParserService(properties);
        MockMultipartFile file =
                new MockMultipartFile(
                        "file",
                        "notes.txt",
                        "text/plain",
                        "hello world".getBytes(StandardCharsets.UTF_8));

        String text = parser.extractText(file);

        assertEquals("hello world", text);
    }
}
