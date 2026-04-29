package com.aiassistant.export;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.LinkedHashSet;
import java.util.Set;
import org.junit.jupiter.api.Test;

class ExportMarkdownUrlsTest {

    @Test
    void collectsMarkdownImageUrlsUntilLimit() {
        Set<String> urls = new LinkedHashSet<>();

        ExportMarkdownUrls.collectMarkdownImageUrls(
                "![](https://example.com/1.png) ![](https://example.com/2.png) ![](https://example.com/3.png)",
                urls,
                2);

        assertEquals(Set.of("https://example.com/1.png", "https://example.com/2.png"), urls);
    }

    @Test
    void zeroLimitSkipsCollection() {
        Set<String> urls = new LinkedHashSet<>();

        ExportMarkdownUrls.collectMarkdownImageUrls("![](https://example.com/1.png)", urls, 0);

        assertTrue(urls.isEmpty());
    }
}
