package com.aiassistant.export;

import com.aiassistant.model.ExportRequest;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.VerticalAlignment;
import org.apache.poi.xssf.usermodel.XSSFRow;
import org.apache.poi.xssf.usermodel.XSSFSheet;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;

import java.io.OutputStream;
import java.util.List;

/**
 * 会话导出为 XLSX（两列：role / content）。
 */
public final class ExportXlsxWriter {

    private ExportXlsxWriter() {
    }

    public static void write(List<ExportRequest.MessageRow> messages, OutputStream out) throws Exception {
        try (XSSFWorkbook wb = new XSSFWorkbook()) {
            XSSFSheet sh = wb.createSheet("messages");
            CellStyle wrapStyle = wb.createCellStyle();
            wrapStyle.setWrapText(true);
            wrapStyle.setVerticalAlignment(VerticalAlignment.TOP);
            XSSFRow h = sh.createRow(0);
            h.createCell(0).setCellValue("role");
            h.createCell(1).setCellValue("content");
            int r = 1;
            for (ExportRequest.MessageRow m : messages) {
                XSSFRow row = sh.createRow(r++);
                row.createCell(0).setCellValue(m != null && m.getRole() != null ? m.getRole() : "");
                String content = m != null && m.getContent() != null ? m.getContent() : "";
                var cell = row.createCell(1);
                cell.setCellValue(content);
                cell.setCellStyle(wrapStyle);
                int hardBreaks = content.split("\n", -1).length;
                int estByWidth = (int) Math.ceil(content.length() / 44.0);
                int lines = Math.max(hardBreaks, estByWidth);
                row.setHeightInPoints(Math.min(409f, Math.max(20f, lines * 15f)));
            }
            sh.setColumnWidth(0, 14 * 256);
            sh.setColumnWidth(1, 118 * 256);
            wb.write(out);
        }
    }
}
