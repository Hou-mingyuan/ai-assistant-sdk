package com.aiassistant.export;

import com.aiassistant.model.ExportRequest;
import java.util.List;

/** 导出前已校验、可写入流的材料（格式、媒体类型、文件名、消息快照）。 */
public record PreparedExport(
        String formatKey,
        String mediaType,
        String filename,
        List<ExportRequest.MessageRow> messages,
        boolean darkTheme) {}
