package com.aiassistant.service;

import com.aiassistant.config.AiAssistantProperties;
import com.aiassistant.util.UrlFetchSafety;
import com.microsoft.playwright.*;
import com.microsoft.playwright.options.LoadState;
import com.microsoft.playwright.options.WaitUntilState;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import jakarta.annotation.PreDestroy;
import java.net.URI;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.Semaphore;

/**
 * Uses Playwright headless Chromium to render JS-heavy pages (e.g. Taobao, Tmall)
 * and extract text/images that plain HTTP cannot reach.
 */
public class HeadlessFetchService implements HeadlessFetcher {

    private static final Logger log = LoggerFactory.getLogger(HeadlessFetchService.class);
    private static final int MAX_CONCURRENT = 3;

    private final AiAssistantProperties properties;
    private final Semaphore semaphore = new Semaphore(MAX_CONCURRENT);
    private volatile Playwright playwright;
    private volatile Browser browser;
    private final Object lock = new Object();

    public HeadlessFetchService(AiAssistantProperties properties) {
        this.properties = properties;
    }

    /**
     * 在独立线程中预装 Chromium 并启动浏览器，避免首个用户请求阻塞 HTTP 线程数分钟。
     * 应在 {@link org.springframework.boot.context.event.ApplicationReadyEvent} 后调用。
     */
    public void warmupInBackground() {
        Thread t = new Thread(() -> {
            try {
                log.info("Headless warmup: downloading Chromium / launching browser in background (may take several minutes on first run)...");
                ensureBrowser();
                log.info("Headless warmup: ready");
            } catch (Exception e) {
                log.warn("Headless warmup failed: {}", e.getMessage());
            }
        }, "ai-assistant-headless-warmup");
        t.setDaemon(true);
        t.start();
    }

    @Override
    public Result fetch(String url) {
        if (!semaphore.tryAcquire()) {
            log.warn("Headless fetch rejected (max {} concurrent), url: {}", MAX_CONCURRENT, url);
            return new Result("", "", List.of());
        }
        try {
            return doFetch(url);
        } finally {
            semaphore.release();
        }
    }

    private Result doFetch(String url) {
        try {
            if (url == null || !(url.startsWith("http://") || url.startsWith("https://"))) {
                log.warn("Headless fetch rejected: only http/https allowed, got: {}",
                        url != null && url.length() > 80 ? url.substring(0, 80) + "…" : url);
                return new Result("", "", List.of());
            }
            validateHeadlessUrl(url);
            ensureBrowser();
            int timeout = (int) Math.min((long) properties.getHeadlessFetchTimeoutSeconds() * 1000, Integer.MAX_VALUE);
            BrowserContext ctx = browser.newContext(new Browser.NewContextOptions()
                    .setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                            + "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36")
                    .setViewportSize(1280, 900)
                    .setLocale("zh-CN"));
            try {
                installSafetyRoute(ctx);
                Page page = ctx.newPage();
                page.setDefaultTimeout(timeout);
                Response response = page.navigate(url, new Page.NavigateOptions()
                        .setWaitUntil(WaitUntilState.DOMCONTENTLOADED)
                        .setTimeout(timeout));
                if (response != null) {
                    validateHeadlessUrl(response.url());
                }
                validateHeadlessUrl(page.url());
                try {
                    page.waitForLoadState(LoadState.NETWORKIDLE,
                            new Page.WaitForLoadStateOptions().setTimeout(5000));
                } catch (TimeoutError ignored) {
                    // networkidle timeout is acceptable — DOM is already loaded
                }

                String title = page.title();
                Object textObj = page.evaluate("() => document.body?.innerText || ''");
                String text = textObj != null ? textObj.toString() : "";
                if (text.length() > 50_000) {
                    text = text.substring(0, 50_000);
                }

                Object rawResult = page.evaluate("""
                    () => {
                        const noise = /logo|icon|avatar|favicon|badge|emoji|sprite|1x1|blank\\.gif|spacer|pixel|qrcode|share|sns|social|toolbar|topbar|nav[-_]|sidebar|widget|footer[-_]icon/i;
                        const brandUrl = /\\/img\\/nav|\\/header\\/|\\/topbar\\/|channel[_-]?logo|site[_-]?logo|brand[_-]?(mark|logo)/i;
                        const mainEl = document.querySelector('article, main, [class*="content"], [class*="detail"], [id*="content"], [id*="detail"]');
                        const mainRect = mainEl ? mainEl.getBoundingClientRect() : null;
                        function isInMainArea(img) {
                            if (!mainRect) return true;
                            const r = img.getBoundingClientRect();
                            return r.top >= mainRect.top - 100 && r.top <= mainRect.bottom + 100;
                        }
                        function isDecorativeAttr(img) {
                            const cls = (img.className || '') + ' ' + (img.id || '') + ' ' + (img.alt || '');
                            return noise.test(cls);
                        }
                        const scored = [];
                        document.querySelectorAll('img').forEach(img => {
                            const src = img.currentSrc || img.src || img.dataset.src || img.dataset.original || '';
                            if (!src || !src.startsWith('http') || src.includes('data:')) return;
                            if (img.naturalWidth < 120 || img.naturalHeight < 80) return;
                            if (noise.test(src) || brandUrl.test(src)) return;
                            if (isDecorativeAttr(img)) return;
                            let score = img.naturalWidth * img.naturalHeight;
                            if (isInMainArea(img)) score += 500000;
                            const trimSrc = src.length > 500 ? src.substring(0, 500) : src;
                            scored.push({ src: trimSrc, score });
                        });
                        scored.sort((a, b) => b.score - a.score);
                        const result = new Set();
                        const meta = document.querySelector('meta[property="og:image"]');
                        if (meta) {
                            const c = meta.getAttribute('content');
                            if (c && c.startsWith('http')) result.add(c);
                        }
                        for (const s of scored) {
                            result.add(s.src);
                            if (result.size >= 10) break;
                        }
                        return [...result];
                    }
                """);

                List<String> images = extractImageList(rawResult);
                return new Result(title, text, images);
            } finally {
                ctx.close();
            }
        } catch (Exception e) {
            log.warn("Headless fetch failed for {}: {}", url, e.getMessage());
            return new Result("", "", List.of());
        }
    }

    private static List<String> extractImageList(Object rawResult) {
        List<String> images = new ArrayList<>();
        if (!(rawResult instanceof List<?> list)) return images;
        Set<String> seen = new LinkedHashSet<>();
        for (Object item : list) {
            String s = String.valueOf(item);
            if (s.startsWith("http") && seen.add(s)) {
                images.add(s);
            }
        }
        return images;
    }

    private void installSafetyRoute(BrowserContext ctx) {
        if (!properties.isUrlFetchSsrfProtection()) {
            return;
        }
        ctx.route("**/*", route -> {
            String requestUrl = route.request().url();
            try {
                validateHeadlessUrl(requestUrl);
                route.resume();
            } catch (Exception e) {
                log.debug("Headless request blocked by URL safety: {} ({})", requestUrl, e.getMessage());
                route.abort();
            }
        });
    }

    private void validateHeadlessUrl(String url) {
        if (!properties.isUrlFetchSsrfProtection()) {
            return;
        }
        UrlFetchSafety.validateHttpUrlForServerSideFetch(URI.create(url));
    }

    private volatile boolean browserInstalled = false;

    private void ensureBrowser() {
        if (browser != null && browser.isConnected()) return;
        synchronized (lock) {
            if (browser != null && browser.isConnected()) return;
            if (!browserInstalled) {
                log.info("Installing Chromium (first run, may take a minute)...");
                try {
                    // CLI.main() calls System.exit() — must run in a subprocess
                    String javaCmd = ProcessHandle.current().info().command().orElse("java");
                    String cp = System.getProperty("java.class.path");
                    ProcessBuilder pb = new ProcessBuilder(javaCmd, "-cp", cp,
                            "com.microsoft.playwright.CLI", "install", "chromium");
                    pb.inheritIO();
                    int exit = pb.start().waitFor();
                    if (exit != 0) {
                        log.warn("Chromium install process exited with code {}", exit);
                    }
                    browserInstalled = true;
                } catch (Exception e) {
                    log.warn("Chromium auto-install failed (may already be installed): {}", e.getMessage());
                }
            }
            if (playwright == null) {
                playwright = Playwright.create();
            }
            browser = playwright.chromium().launch(new BrowserType.LaunchOptions()
                    .setHeadless(true)
                    .setArgs(List.of("--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage")));
            log.info("Headless Chromium launched");
        }
    }

    @PreDestroy
    public void shutdown() {
        synchronized (lock) {
            if (browser != null) {
                try { browser.close(); } catch (Exception ignored) {}
                browser = null;
            }
            if (playwright != null) {
                try { playwright.close(); } catch (Exception ignored) {}
                playwright = null;
            }
            log.info("Headless Chromium shut down");
        }
    }
}
