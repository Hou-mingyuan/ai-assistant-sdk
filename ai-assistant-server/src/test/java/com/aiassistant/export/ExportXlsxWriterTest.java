package com.aiassistant.export;

import static org.assertj.core.api.Assertions.assertThat;

import com.aiassistant.model.ExportRequest;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.util.ArrayList;
import java.util.List;
import org.apache.poi.xssf.usermodel.XSSFRow;
import org.apache.poi.xssf.usermodel.XSSFSheet;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.Test;

class ExportXlsxWriterTest {

    private static ExportRequest.MessageRow row(String role, String content) {
        ExportRequest.MessageRow m = new ExportRequest.MessageRow();
        m.setRole(role);
        m.setContent(content);
        return m;
    }

    @Test
    void writesHeaderAndRows_lightTheme() throws Exception {
        List<ExportRequest.MessageRow> messages =
                List.of(
                        row("user", "hello"),
                        row("assistant", "line one\nline two\n" + "x".repeat(120)));
        ByteArrayOutputStream out = new ByteArrayOutputStream();

        ExportXlsxWriter.write(messages, out);

        try (XSSFWorkbook wb = new XSSFWorkbook(new ByteArrayInputStream(out.toByteArray()))) {
            XSSFSheet sheet = wb.getSheet("messages");
            assertThat(sheet).isNotNull();
            assertThat(sheet.getRow(0).getCell(0).getStringCellValue()).isEqualTo("role");
            assertThat(sheet.getRow(0).getCell(1).getStringCellValue()).isEqualTo("content");
            assertThat(sheet.getRow(1).getCell(0).getStringCellValue()).isEqualTo("user");
            assertThat(sheet.getRow(1).getCell(1).getStringCellValue()).isEqualTo("hello");
            XSSFRow longRow = sheet.getRow(2);
            assertThat(longRow.getCell(0).getStringCellValue()).isEqualTo("assistant");
        }
    }

    @Test
    void writesDarkThemeWithNullFieldsAndNullRow() throws Exception {
        List<ExportRequest.MessageRow> messages = new ArrayList<>();
        messages.add(row(null, null));
        messages.add(null);
        messages.add(row("user", "ok"));
        ByteArrayOutputStream out = new ByteArrayOutputStream();

        ExportXlsxWriter.write(messages, out, true);

        try (XSSFWorkbook wb = new XSSFWorkbook(new ByteArrayInputStream(out.toByteArray()))) {
            XSSFSheet sheet = wb.getSheet("messages");
            assertThat(sheet.getRow(1).getCell(0).getStringCellValue()).isEmpty();
            assertThat(sheet.getRow(1).getCell(1).getStringCellValue()).isEmpty();
            assertThat(sheet.getRow(2).getCell(0).getStringCellValue()).isEmpty();
            assertThat(sheet.getRow(3).getCell(0).getStringCellValue()).isEqualTo("user");
        }
    }
}
