package com.aiassistant.export;

import java.util.regex.Pattern;

/** 导出用 Markdown 解析的正则（与 {@link com.aiassistant.service.AssistantExportService} 共用）。 */
public final class ExportMarkdownPatterns {

    public static final Pattern MD_IMAGE =
            Pattern.compile("!\\[([^\\]]{0,500})\\]\\(([^)\\s]{1,2000})\\)");
    public static final Pattern MD_HEADING = Pattern.compile("^(#{1,6})\\s+(.*)$");
    public static final Pattern MD_OL = Pattern.compile("^(\\d+)\\.\\s+(.*)$");
    public static final Pattern MD_INLINE_BOLD = Pattern.compile("\\*\\*(.+?)\\*\\*");
    public static final Pattern MD_INLINE_CODE = Pattern.compile("`([^`]+)`");

    private ExportMarkdownPatterns() {}
}
