package com.aiassistant.export;

import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.Test;

class ExportTextLayoutTest {

    @Test
    void sanitizeFileStemRemovesDangerousChars() {
        assertEquals("report_2024", ExportTextLayout.sanitizeFileStem("report/2024"));
        assertEquals("file_name", ExportTextLayout.sanitizeFileStem("file:name"));
        assertEquals("export", ExportTextLayout.sanitizeFileStem(""));
    }

    @Test
    void sanitizeFileStemTruncatesLongName() {
        String long_ = "a".repeat(200);
        assertEquals(120, ExportTextLayout.sanitizeFileStem(long_).length());
    }

    @Test
    void hardWrapLongPhysicalLinesBreaks() {
        String input = "a".repeat(100);
        String wrapped = ExportTextLayout.hardWrapLongPhysicalLines(input, 30);
        String[] lines = wrapped.split("\n");
        for (String line : lines) {
            assertTrue(line.length() <= 30, "line too long: " + line.length());
        }
    }

    @Test
    void hardWrapPreservesShortLines() {
        String input = "short line\nanother short";
        assertEquals(input + "\n", ExportTextLayout.hardWrapLongPhysicalLines(input, 80));
    }

    @Test
    void hardWrapPreservesMdImagesWraps() {
        String img = "![alt](https://example.com/very-long-image-url.png?param=1234567890)";
        String input = "text " + img + " more text";
        String result = ExportTextLayout.hardWrapLongPhysicalLinesPreserveMdImages(input, 30);
        assertTrue(result.contains(img), "image syntax should not be broken");
    }
}
