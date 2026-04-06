package com.aiassistant.export;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;

/**
 * 导出文件名与长行折行（docx / 代码块等）。
 */
public final class ExportTextLayout {

    private ExportTextLayout() {
    }

    public static String sanitizeFileStem(String title) {
        String s = title.replaceAll("[\\\\/:*?\"<>|]+", "_").trim();
        if (s.isBlank()) {
            return "export";
        }
        return s.length() > 120 ? s.substring(0, 120) : s;
    }

    /**
     * 不依赖 OOXML 全量 schema：对超长物理行插入换行。
     */
    public static String hardWrapLongPhysicalLines(String input, int maxLen) {
        if (input == null) {
            return "";
        }
        maxLen = Math.max(24, maxLen);
        String normalized = input.replace("\r\n", "\n");
        StringBuilder out = new StringBuilder(normalized.length() + 64);
        for (String rawLine : normalized.split("\n", -1)) {
            if (rawLine.length() <= maxLen) {
                out.append(rawLine).append('\n');
                continue;
            }
            int start = 0;
            while (start < rawLine.length()) {
                int end = Math.min(rawLine.length(), start + maxLen);
                if (end > start && end < rawLine.length() && Character.isHighSurrogate(rawLine.charAt(end - 1))) {
                    end--;
                }
                if (end <= start) {
                    end = Math.min(rawLine.length(), start + maxLen);
                }
                out.append(rawLine, start, end).append('\n');
                start = end;
            }
        }
        return out.toString();
    }

    /**
     * 硬换行前保护 Markdown 图片语法，避免截断 {@code ![](...)}。
     */
    public static String hardWrapLongPhysicalLinesPreserveMdImages(String input, int maxLen) {
        if (input == null) {
            return "";
        }
        if (input.isEmpty()) {
            return input;
        }
        Matcher m = ExportMarkdownPatterns.MD_IMAGE.matcher(input);
        StringBuffer sb = new StringBuffer();
        List<String> tokens = new ArrayList<>();
        int i = 0;
        while (m.find()) {
            String ph = "\uE000" + i + "\uE001";
            tokens.add(m.group(0));
            m.appendReplacement(sb, Matcher.quoteReplacement(ph));
            i++;
        }
        m.appendTail(sb);
        String wrapped = hardWrapLongPhysicalLines(sb.toString(), maxLen);
        String result = wrapped;
        for (int t = 0; t < tokens.size(); t++) {
            result = result.replace("\uE000" + t + "\uE001", tokens.get(t));
        }
        return result;
    }
}
