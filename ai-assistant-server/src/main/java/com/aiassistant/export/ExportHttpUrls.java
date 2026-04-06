package com.aiassistant.export;

import java.net.URI;

/**
 * 导出拉图等场景下对 http(s) URL 的基线校验。
 */
public final class ExportHttpUrls {

    private ExportHttpUrls() {
    }

    public static boolean isAllowedHttpUrl(String url) {
        if (url == null || url.isBlank()) {
            return false;
        }
        try {
            URI u = URI.create(url.trim());
            String s = u.getScheme();
            return "http".equalsIgnoreCase(s) || "https".equalsIgnoreCase(s);
        } catch (Exception e) {
            return false;
        }
    }
}
