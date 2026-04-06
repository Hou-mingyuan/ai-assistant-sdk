package com.aiassistant.export;

import org.apache.poi.xwpf.usermodel.XWPFDocument;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;

/**
 * 导出嵌入图片时的魔数识别与尺寸探测。
 */
public final class ExportImageSniff {

    private ExportImageSniff() {
    }

    public static int sniffPictureType(byte[] b) {
        if (b == null || b.length < 8) {
            return -1;
        }
        if (b[0] == (byte) 0xFF && b[1] == (byte) 0xD8 && b[2] == (byte) 0xFF) {
            return XWPFDocument.PICTURE_TYPE_JPEG;
        }
        if (b.length >= 8
                && b[0] == (byte) 0x89 && b[1] == 0x50 && b[2] == 0x4E && b[3] == 0x47
                && b[4] == 0x0D && b[5] == 0x0A && b[6] == 0x1A && b[7] == 0x0A) {
            return XWPFDocument.PICTURE_TYPE_PNG;
        }
        if (b.length >= 6 && b[0] == 'G' && b[1] == 'I' && b[2] == 'F' && b[3] == '8'
                && (b[4] == '7' || b[4] == '9') && b[5] == 'a') {
            return XWPFDocument.PICTURE_TYPE_GIF;
        }
        return -1;
    }

    public static int[] imagePixelSize(byte[] bytes) {
        try (ByteArrayInputStream in = new ByteArrayInputStream(bytes)) {
            BufferedImage bi = ImageIO.read(in);
            if (bi != null) {
                return new int[]{bi.getWidth(), bi.getHeight()};
            }
        } catch (Exception ignored) {
        }
        return new int[]{400, 300};
    }
}
