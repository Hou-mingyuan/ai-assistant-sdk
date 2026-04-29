package com.aiassistant.service;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.aiassistant.config.AiAssistantProperties;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

class FileParserServiceTest {

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
