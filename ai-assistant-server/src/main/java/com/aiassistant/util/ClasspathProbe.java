package com.aiassistant.util;

/**
 * 轻量 classpath 探测工具：判断某个可选依赖的类是否存在，用于在缺少可选依赖时安全地跳过相关代码路径， 避免触发 {@code NoClassDefFoundError}。
 *
 * @author houmy01
 */
public final class ClasspathProbe {

    private ClasspathProbe() {}

    /**
     * 判断给定全限定类名在当前 classpath 是否可加载（不触发类初始化）。
     *
     * @param className 全限定类名，例如 {@code okhttp3.OkHttpClient}
     * @return 存在返回 true，否则 false
     */
    public static boolean isPresent(String className) {
        try {
            Class.forName(className, false, ClasspathProbe.class.getClassLoader());
            return true;
        } catch (Throwable t) {
            return false;
        }
    }
}
