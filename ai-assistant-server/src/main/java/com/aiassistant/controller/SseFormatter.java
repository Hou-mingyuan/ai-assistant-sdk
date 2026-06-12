package com.aiassistant.controller;

/**
 * SSE 数据帧格式化工具：把一段内容封装成符合 SSE 规范的 {@code data:} 值。
 *
 * <p>Spring 的 SSE writer 会把返回的字符串写成 {@code data:<内容>}，冒号后**不加**分隔空格。但 SSE 规范规定消费端（含浏览器原生 {@code
 * EventSource}、本项目 Java 客户端、以及规范的前端解析器）会把 {@code data:} 之后的**第一个**前导空格当作字段分隔符剥掉。因此当流式 token
 * 自带前导空格（如 {@code " id="}、{@code " import"}、{@code " class="}）时，若服务端不补一个分隔空格，这个空格会被 消费端误剥，导致相邻
 * token 粘连（{@code <artifactid=}、{@code importReact}），既破坏 {@code <artifact ...>}
 * 标签识别，也破坏英文/代码内容（中文无空格，故此前一直未暴露）。
 *
 * <p>本工具在每条 {@code data:} 行前补一个分隔空格：规范消费端剥掉这一个空格后即可原样还原内容。 多行内容会被 writer 拆成多条 {@code data:}
 * 行，故对每个换行后的新行也补一个分隔空格，保证逐行还原。
 *
 * @author houmy01
 */
final class SseFormatter {

    private SseFormatter() {}

    /**
     * 为 SSE {@code data:} 帧补齐规范分隔空格。
     *
     * @param chunk 原始内容（可能自带前导空格或换行）
     * @return 补齐分隔空格后的内容；{@code null} 或空串原样返回
     */
    static String specData(String chunk) {
        if (chunk == null || chunk.isEmpty()) {
            return chunk;
        }
        return " " + chunk.replace("\n", "\n ");
    }
}
