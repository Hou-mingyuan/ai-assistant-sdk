package com.aiassistant.export;

import com.aiassistant.model.ExportRequest;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.FillPatternType;
import org.apache.poi.ss.usermodel.VerticalAlignment;
import org.apache.poi.xssf.usermodel.XSSFCellStyle;
import org.apache.poi.xssf.usermodel.XSSFColor;
import org.apache.poi.xssf.usermodel.XSSFFont;
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
        write(messages, out, false);
    }

    public static void write(List<ExportRequest.MessageRow> messages, OutputStream out, boolean dark) throws Exception {
        try (XSSFWorkbook wb = new XSSFWorkbook()) {
            XSSFSheet sh = wb.createSheet("messages");

            XSSFCellStyle wrapStyle = wb.createCellStyle();
            wrapStyle.setWrapText(true);
            wrapStyle.setVerticalAlignment(VerticalAlignment.TOP);

            if (dark) {
                XSSFFont font = wb.createFont();
                font.setColor(new XSSFColor(new byte[]{(byte) 226, (byte) 232, (byte) 240}, null));
                wrapStyle.setFont(font);
                wrapStyle.setFillForegroundColor(new XSSFColor(new byte[]{30, 41, 59}, null));
                wrapStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            }

            XSSFRow h = sh.createRow(0);
            h.createCell(0).setCellValue("role");
            h.createCell(1).setCellValue("content");
            if (dark) {
                XSSFCellStyle headerStyle = wb.createCellStyle();
                XSSFFont hf = wb.createFont();
                hf.setBold(true);
                hf.setColor(new XSSFColor(new byte[]{(byte) 165, (byte) 180, (byte) 252}, null));
                headerStyle.setFont(hf);
                headerStyle.setFillForegroundColor(new XSSFColor(new byte[]{15, 23, 42}, null));
                headerStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);
                h.getCell(0).setCellStyle(headerStyle);
                h.getCell(1).setCellStyle(headerStyle);
            }

            int r = 1;
            for (ExportRequest.MessageRow m : messages) {
                XSSFRow row = sh.createRow(r++);
                var roleCell = row.createCell(0);
                roleCell.setCellValue(m != null && m.getRole() != null ? m.getRole() : "");
                if (dark) roleCell.setCellStyle(wrapStyle);
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
