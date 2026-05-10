package com.aiassistant.util;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 纯静态 HTML 文本提取工具集，从 {@code UrlFetchService} 中抽离以减小该服务的认知负担，
 * 也便于单测覆盖。
 *
 * <p>所有方法均无状态、线程安全；行为与抽离前完全一致。
 *
 * <ul>
 *   <li>{@link #htmlToPlain(String)} 把整段 HTML 压平为单行纯文本，丢弃 script/style 内联块、
 *       折叠空白；用于把抓取到的页面塞进 LLM 上下文。
 *   <li>{@link #stripTags(String)} 简易去标签，专门用于已经匹配到的小片段（如 &lt;title&gt;）。
 *   <li>{@link #matchGroup(Pattern, String)} 在 HTML 上跑一次正则并返回第 1 个分组，
 *       自动调用 {@link #decodeBasicEntities(String)}。
 *   <li>{@link #firstNonBlank(String...)} 从一组候选中返回第一个非空、非全空白的字符串。
 *   <li>{@link #indexOfIgnoreCase(String, String, int)} 大小写不敏感的子串查找。
 * </ul>
 */
public final class HtmlTextExtractor {

    private HtmlTextExtractor() {
    }

    /** 大小写不敏感地从 {@code from} 起寻找 {@code target}，返回首次出现位置；找不到返回 -1。 */
    public static int indexOfIgnoreCase(String src, String target, int from) {
        if (src == null || target == null) return -1;
        int n = src.length();
        int m = target.length();
        if (m == 0) return Math.max(0, Math.min(from, n));
        for (int i = Math.max(0, from); i <= n - m; i++) {
            if (src.regionMatches(true, i, target, 0, m)) return i;
        }
        return -1;
    }

    /** 把整段 HTML 提取为单行纯文本：剔除 script/style 内联块、丢弃所有标签、解码常见 HTML 实体、折叠空白。 */
    public static String htmlToPlain(String html) {
        if (html == null || html.isEmpty()) return "";
        int len = html.length();
        StringBuilder sb = new StringBuilder(len / 3);
        int i = 0;
        while (i < len) {
            char c = html.charAt(i);
            if (c == '<') {
                boolean isScript = len - i >= 7 && html.regionMatches(true, i, "<script", 0, 7);
                boolean isStyle =
                        !isScript && len - i >= 6 && html.regionMatches(true, i, "<style", 0, 6);
                if (isScript || isStyle) {
                    String endTag = isScript ? "</script>" : "</style>";
                    int close = indexOfIgnoreCase(html, endTag, i);
                    i = close < 0 ? len : close + endTag.length();
                    sb.append(' ');
                    continue;
                }
                int gt = html.indexOf('>', i);
                i = gt < 0 ? len : gt + 1;
                sb.append(' ');
            } else if (c == '&') {
                int semi = html.indexOf(';', i);
                if (semi > i && semi - i <= 8) {
                    String ent = html.substring(i, semi + 1);
                    switch (ent) {
                        case "&nbsp;" -> sb.append(' ');
                        case "&lt;" -> sb.append('<');
                        case "&gt;" -> sb.append('>');
                        case "&amp;" -> sb.append('&');
                        case "&quot;" -> sb.append('"');
                        case "&#39;" -> sb.append('\'');
                        default -> sb.append(ent);
                    }
                    i = semi + 1;
                } else {
                    sb.append(c);
                    i++;
                }
            } else {
                sb.append(c);
                i++;
            }
        }
        return sb.toString().replaceAll("\\s+", " ").trim();
    }

    /** 简易去标签：仅适用于已经裁剪过的小片段（如 og:title、{@literal <title>} 内文）。 */
    public static String stripTags(String s) {
        if (s == null) return "";
        return s.replaceAll("<[^>]+>", " ").replaceAll("\\s+", " ").trim();
    }

    /** 返回参数中第一个非空、非全空白的字符串（已 trim）；若全部空则返回空串。 */
    public static String firstNonBlank(String... parts) {
        if (parts == null) return "";
        for (String p : parts) {
            if (p != null && !p.isBlank()) return p.trim();
        }
        return "";
    }

    /** 在 {@code html} 上跑一次 {@code p}，命中则返回第 1 个捕获组（已解码常见实体），否则返回空串。 */
    public static String matchGroup(Pattern p, String html) {
        if (p == null || html == null) return "";
        Matcher m = p.matcher(html);
        return m.find() ? decodeBasicEntities(m.group(1).trim()) : "";
    }

    /** 解码 og/title 抓取片段中常见的 HTML 实体。 */
    public static String decodeBasicEntities(String s) {
        if (s == null) return "";
        return s.replace("&amp;", "&").replace("&quot;", "\"").replace("&#39;", "'");
    }
}
