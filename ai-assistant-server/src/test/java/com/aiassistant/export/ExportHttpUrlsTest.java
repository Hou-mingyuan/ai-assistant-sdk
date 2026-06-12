package com.aiassistant.export;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class ExportHttpUrlsTest {

    @Test
    void allowsHttpAndHttps() {
        assertThat(ExportHttpUrls.isAllowedHttpUrl("http://example.com/a.png")).isTrue();
        assertThat(ExportHttpUrls.isAllowedHttpUrl("HTTPS://example.com/a.png")).isTrue();
        assertThat(ExportHttpUrls.isAllowedHttpUrl("  https://example.com/x  ")).isTrue();
    }

    @Test
    void rejectsNullBlankAndNonHttpSchemes() {
        assertThat(ExportHttpUrls.isAllowedHttpUrl(null)).isFalse();
        assertThat(ExportHttpUrls.isAllowedHttpUrl("   ")).isFalse();
        assertThat(ExportHttpUrls.isAllowedHttpUrl("ftp://example.com/a.png")).isFalse();
        assertThat(ExportHttpUrls.isAllowedHttpUrl("data:image/png;base64,AAAA")).isFalse();
        assertThat(ExportHttpUrls.isAllowedHttpUrl("/relative/path.png")).isFalse();
    }

    @Test
    void rejectsMalformedUri() {
        assertThat(ExportHttpUrls.isAllowedHttpUrl("http://exa mple.com")).isFalse();
    }
}
