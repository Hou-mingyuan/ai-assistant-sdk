package com.aiassistant.export;

import java.util.Set;
import java.util.regex.Matcher;

/**
 * 从 Markdown 中收集图片 URL，以及 PDF 用的行内标记剥离。
 */
public final class ExportMarkdownUrls {

    private ExportMarkdownUrls() {
    }

    public static void collectMarkdownImageUrls(String text, Set<String> dest) {
        collectMarkdownImageUrls(text, dest, Integer.MAX_VALUE);
    }

    public static void collectMarkdownImageUrls(String text, Set<String> dest, int maxUrls) {
        if (text == null || text.isEmpty()) {
            return;
        }
        if (dest == null || maxUrls <= 0 || dest.size() >= maxUrls) {
            return;
        }
        Matcher m = ExportMarkdownPatterns.MD_IMAGE.matcher(text);
        while (m.find() && dest.size() < maxUrls) {
            String u = m.group(2).trim();
            if (!u.isEmpty()) {
                dest.add(u);
            }
        }
    }

    public static String stripInlineMdForPdf(String s) {
        if (s == null || s.isEmpty()) {
            return "";
        }
        String t = ExportMarkdownPatterns.MD_INLINE_BOLD.matcher(s).replaceAll("$1");
        return ExportMarkdownPatterns.MD_INLINE_CODE.matcher(t).replaceAll("$1");
    }
}
