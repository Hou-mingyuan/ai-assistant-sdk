package com.aiassistant.export;

import static org.assertj.core.api.Assertions.assertThat;

import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import javax.imageio.ImageIO;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.junit.jupiter.api.Test;

class ExportImageSniffTest {

    private static byte[] encode(String format, int w, int h, int type) throws Exception {
        BufferedImage img = new BufferedImage(w, h, type);
        ByteArrayOutputStream bos = new ByteArrayOutputStream();
        ImageIO.write(img, format, bos);
        return bos.toByteArray();
    }

    @Test
    void sniffPictureType_nullOrTooShort_returnsMinusOne() {
        assertThat(ExportImageSniff.sniffPictureType(null)).isEqualTo(-1);
        assertThat(ExportImageSniff.sniffPictureType(new byte[] {1, 2, 3})).isEqualTo(-1);
    }

    @Test
    void sniffPictureType_recognizesJpegPngGif() throws Exception {
        assertThat(
                        ExportImageSniff.sniffPictureType(
                                encode("jpg", 8, 8, BufferedImage.TYPE_INT_RGB)))
                .isEqualTo(XWPFDocument.PICTURE_TYPE_JPEG);
        assertThat(
                        ExportImageSniff.sniffPictureType(
                                encode("png", 8, 8, BufferedImage.TYPE_INT_ARGB)))
                .isEqualTo(XWPFDocument.PICTURE_TYPE_PNG);
        assertThat(
                        ExportImageSniff.sniffPictureType(
                                encode("gif", 8, 8, BufferedImage.TYPE_INT_ARGB)))
                .isEqualTo(XWPFDocument.PICTURE_TYPE_GIF);
    }

    @Test
    void sniffPictureType_unknownMagic_returnsMinusOne() {
        byte[] notAnImage = new byte[] {0, 1, 2, 3, 4, 5, 6, 7, 8};
        assertThat(ExportImageSniff.sniffPictureType(notAnImage)).isEqualTo(-1);
    }

    @Test
    void imagePixelSize_readsRealDimensions() throws Exception {
        byte[] png = encode("png", 123, 45, BufferedImage.TYPE_INT_ARGB);
        assertThat(ExportImageSniff.imagePixelSize(png)).containsExactly(123, 45);
    }

    @Test
    void imagePixelSize_invalidBytes_fallsBackToDefault() {
        byte[] garbage = new byte[] {1, 2, 3, 4, 5, 6, 7, 8, 9, 10};
        assertThat(ExportImageSniff.imagePixelSize(garbage)).containsExactly(400, 300);
    }
}
