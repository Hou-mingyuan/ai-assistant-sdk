package com.aiassistant.service;

import com.aiassistant.config.AiAssistantProperties;
import com.aiassistant.model.UrlPreviewResponse;
import com.aiassistant.util.UrlFetchSafety;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class UrlFetchService {

    private static final Logger log = LoggerFactory.getLogger(UrlFetchService.class);

    private static final Pattern URL_IN_TEXT = Pattern.compile("https?://[^\\s<>\"()\\[\\]{}]+",
            Pattern.CASE_INSENSITIVE);

    private static final Pattern META_OG_TITLE = Pattern.compile(
            "<meta[^>]+property=[\"']og:title[\"'][^>]+content=[\"']([^\"']*)[\"']",
            Pattern.CASE_INSENSITIVE | Pattern.DOTALL);
    private static final Pattern META_OG_TITLE2 = Pattern.compile(
            "<meta[^>]+content=[\"']([^\"']*)[\"'][^>]+property=[\"']og:title[\"']",
            Pattern.CASE_INSENSITIVE | Pattern.DOTALL);
    private static final Pattern TITLE_TAG = Pattern.compile("<title[^>]*>([^<]+)</title>",
            Pattern.CASE_INSENSITIVE | Pattern.DOTALL);

    private static final Pattern META_OG_IMAGE = Pattern.compile(
            "<meta[^>]+property=[\"']og:image[\"'][^>]+content=[\"']([^\"']*)[\"']",
            Pattern.CASE_INSENSITIVE | Pattern.DOTALL);
    private static final Pattern META_OG_IMAGE2 = Pattern.compile(
            "<meta[^>]+content=[\"']([^\"']*)[\"'][^>]+property=[\"']og:image[\"']",
            Pattern.CASE_INSENSITIVE | Pattern.DOTALL);
    private static final Pattern META_TW_IMAGE = Pattern.compile(
            "<meta[^>]+name=[\"']twitter:image[\"'][^>]+content=[\"']([^\"']*)[\"']",
            Pattern.CASE_INSENSITIVE | Pattern.DOTALL);

    /** 抽取 img 属性块，便于根据 class/宽高等侧栏分享图特征过滤 */
    private static final Pattern IMG_TAG = Pattern.compile("<img\\s+([^>]+)>", Pattern.CASE_INSENSITIVE);

    private static final Pattern SRC_OR_LAZY_ATTR = Pattern.compile(
            "(?:src|data-src|data-original|data-lazy-src)=[\"']([^\"']+)[\"']",
            Pattern.CASE_INSENSITIVE);

    private static final Pattern BODY_REGION_HINT = Pattern.compile(
            "class=[\"'][^\"']*\\b(article-body|post-content|entry-content|news_txt|text-content|article__content|story-body)\\b[^\"']*[\"']",
            Pattern.CASE_INSENSITIVE);

    private static final Pattern URL_NOISE_MARKERS = Pattern.compile(
            "logo|icon|avatar|favicon|badge|emoji|sprite|1x1|blank\\.gif|spacer|pixel\\.gif|wx-qrcode|qrcode_s",
            Pattern.CASE_INSENSITIVE);

    /** 站点顶栏、导航条、分享条、频道品牌等 URL 特征（图并非新闻正文配图） */
    private static final Pattern URL_BRAND_OR_CHROME = Pattern.compile(
            "/img/nav|nav\\d+\\.(png|gif|jpe?g)|share[fF]\\d*\\.(png|gif)|chinaindex"
                    + "|/header/|/topbar/|channel[_-]?logo|site[_-]?logo|brand[_-]?(mark|logo)|/toolbar/"
                    + "|/images1/ch/.+/(nav|share)",
            Pattern.CASE_INSENSITIVE);

    /**
     * 常见分享条 / 社交 widget / 侧栏小图标 URL 片段，不参与正文图预览。
     */
    private static final String[] SHARE_OR_DECOR_IMAGE_MARKERS = {
            "service.weibo.com", "widget.weibo.com", "tjs.sjs.sinajs.cn",
            "connect.qq.com", "graph.qq.com", "open.weixin.qq.com", "qzonestyle.gtimg.cn",
            "res.wx.qq.com", "thirdwx.qlogo.cn", "wx.qlogo.cn",
            "/sns/", "share/icons", "bdimg.com/share", "/bdshare/",
            "addthis.com", "addtoany.com", "sharethis.com",
            "/icon_weibo", "/icon_wechat", "weixin_icon", "wechat_icon", "qzone_icon",
            "share_btn", "share-btn", "bshare",
            "favicon", "/avatar/", "gravatar", "1x1", "blank.gif", "spacer.gif", "pixel.gif",
            "loading.gif", "placeholder.",
    };

    private final AiAssistantProperties properties;
    private final HttpClient httpClient;
    private final Map<String, CacheEntry> fetchCache = new LinkedHashMap<>(16, 0.75f, true);

    public UrlFetchService(AiAssistantProperties properties) {
        this.properties = properties;
        int timeout = Math.max(1, properties.getUrlFetchTimeoutSeconds());
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(timeout))
                .followRedirects(HttpClient.Redirect.NORMAL)
                .build();
    }

    public UrlPreviewResponse previewUrl(String url) {
        if (url == null || url.isBlank()) {
            return UrlPreviewResponse.fail("url is required");
        }
        URI uri;
        try {
            uri = URI.create(url.trim());
        } catch (Exception e) {
            return UrlPreviewResponse.fail("invalid url");
        }
        if (uri.getScheme() == null || !List.of("http", "https").contains(uri.getScheme().toLowerCase(Locale.ROOT))) {
            return UrlPreviewResponse.fail("only http(s) urls are supported");
        }

        try {
            byte[] body = fetchBytes(uri);
            if (body.length == 0) {
                return UrlPreviewResponse.ok("", "", null, List.of());
            }
            Charset cs = sniffCharset(body, uri);
            String html = new String(body, cs);
            String title = firstNonBlank(
                    matchGroup(META_OG_TITLE, html),
                    matchGroup(META_OG_TITLE2, html),
                    stripTags(matchGroup(TITLE_TAG, html))
            );
            String plainFull = htmlToPlain(html);
            List<String> images = collectImages(html, uri, title, plainFull, properties.getUrlPreviewMaxImages());
            String primary = images.isEmpty() ? null : images.get(0);
            int cap = Math.max(100, properties.getUrlPreviewMaxSummaryChars());
            String plain = plainFull.length() > cap ? plainFull.substring(0, cap) + "…" : plainFull;
            return UrlPreviewResponse.ok(title, plain, primary, images);
        } catch (Exception e) {
            log.debug("url preview failed: {}", e.toString());
            return UrlPreviewResponse.fail("preview failed: " + e.getMessage());
        }
    }

    /**
     * 若用户正文中含 http(s) 链接，尝试抓取首条可解析 URL 的正文并附在消息后（有长度上限）。
     */
    public String enrichUserMessage(String text) throws Exception {
        if (text == null || !properties.isUrlFetchEnabled()) {
            return text;
        }
        Matcher m = URL_IN_TEXT.matcher(text);
        if (!m.find()) {
            return text;
        }
        String url = m.group();
        URI uri = URI.create(url);
        if (uri.getScheme() == null || !List.of("http", "https").contains(uri.getScheme().toLowerCase(Locale.ROOT))) {
            return text;
        }

        String cached = getCachedText(uri);
        String extracted;
        if (cached != null) {
            extracted = cached;
        } else {
            byte[] raw = fetchBytes(uri);
            Charset cs = sniffCharset(raw, uri);
            String html = new String(raw, cs);
            extracted = htmlToPlain(html);
            putCachedText(uri, extracted);
        }

        int injectCap = Math.max(0, properties.getUrlFetchMaxCharsInjected());
        if (injectCap > 0 && extracted.length() > injectCap) {
            extracted = extracted.substring(0, injectCap) + "\n…[truncated]";
        }

        return text + "\n\n--- fetched: " + url + " ---\n" + extracted;
    }

    private byte[] fetchBytes(URI uri) throws Exception {
        if (properties.isUrlFetchSsrfProtection()) {
            UrlFetchSafety.validateHttpUrlForServerSideFetch(uri);
        }
        int max = Math.max(1024, properties.getUrlFetchMaxBytes());
        HttpRequest req = HttpRequest.newBuilder(uri)
                .timeout(Duration.ofSeconds(Math.max(1, properties.getUrlFetchTimeoutSeconds())))
                .header("User-Agent", "AiAssistantUrlFetch/1.0")
                .GET()
                .build();
        HttpResponse<byte[]> res = httpClient.send(req, HttpResponse.BodyHandlers.ofByteArray());
        if (res.statusCode() < 200 || res.statusCode() >= 300) {
            throw new IllegalStateException("HTTP " + res.statusCode());
        }
        byte[] body = res.body();
        if (body == null) {
            return new byte[0];
        }
        return body.length <= max ? body : java.util.Arrays.copyOf(body, max);
    }

    private static Charset sniffCharset(byte[] body, URI uri) {
        String head = new String(body, 0, Math.min(body.length, 8192), StandardCharsets.ISO_8859_1);
        Matcher cm = Pattern.compile("charset=([a-zA-Z0-9._-]+)", Pattern.CASE_INSENSITIVE).matcher(head);
        if (cm.find()) {
            try {
                return Charset.forName(cm.group(1).trim());
            } catch (Exception ignored) {
            }
        }
        return StandardCharsets.UTF_8;
    }

    private static String htmlToPlain(String html) {
        String s = html
                .replaceAll("(?is)<script[^>]*>.*?</script>", " ")
                .replaceAll("(?is)<style[^>]*>.*?</style>", " ");
        s = s.replaceAll("<[^>]+>", " ");
        s = s.replace("&nbsp;", " ")
                .replace("&lt;", "<")
                .replace("&gt;", ">")
                .replace("&amp;", "&")
                .replace("&quot;", "\"");
        s = s.replaceAll("\\s+", " ").trim();
        return s;
    }

    private static String stripTags(String s) {
        if (s == null) {
            return "";
        }
        return s.replaceAll("<[^>]+>", " ").replaceAll("\\s+", " ").trim();
    }

    private static String firstNonBlank(String... parts) {
        if (parts == null) {
            return "";
        }
        for (String p : parts) {
            if (p != null && !p.isBlank()) {
                return p.trim();
            }
        }
        return "";
    }

    private static String matchGroup(Pattern p, String html) {
        Matcher m = p.matcher(html);
        return m.find() ? decodeBasicEntities(m.group(1).trim()) : "";
    }

    private static String decodeBasicEntities(String s) {
        if (s == null) {
            return "";
        }
        return s.replace("&amp;", "&").replace("&quot;", "\"").replace("&#39;", "'");
    }

    /**
     * 抽取并对图片按「与新闻正文相关性」排序：优先 og/twitter 主图、正文区域内大图、alt 与标题/摘要有交集者；剔除明显装饰/图标 URL。
     */
    private List<String> collectImages(String html, URI base, String title, String plainBody, int maxImages) {
        int cap = Math.min(30, Math.max(1, maxImages));
        List<ScoredImage> scored = new ArrayList<>();
        int bodyStart = estimateMainContentStartIndex(html);

        for (String metaUrl : List.of(
                matchGroup(META_OG_IMAGE, html),
                matchGroup(META_OG_IMAGE2, html),
                matchGroup(META_TW_IMAGE, html))) {
            String abs = resolveImgRef(metaUrl, base);
            if (abs != null && !isLikelyShareOrDecorativeImageUrl(abs) && !isLikelyNoiseImageUrl(abs)
                    && !isLikelyBrandOrChromeImageUrl(abs)) {
                scored.add(new ScoredImage(abs, 950, "meta"));
            }
        }

        Matcher im = IMG_TAG.matcher(html);
        while (im.find()) {
            String attrs = im.group(1);
            if (isLikelyDecorativeImgAttributes(attrs) || isLikelyHeaderChromeAttributes(attrs)) {
                continue;
            }
            Matcher sm = SRC_OR_LAZY_ATTR.matcher(attrs);
            if (!sm.find()) {
                continue;
            }
            String raw = sm.group(1).trim();
            String abs = resolveImgRef(raw, base);
            if (abs == null || isLikelyShareOrDecorativeImageUrl(abs) || isLikelyNoiseImageUrl(abs)
                    || isLikelyBrandOrChromeImageUrl(abs)) {
                continue;
            }
            int pos = im.start();
            int[] wh = parseImgWidthHeight(attrs);
            int score = scoreBodyImage(pos, bodyStart, wh, attrs, title, plainBody);
            if (pos < bodyStart && score < 140) {
                continue;
            }
            scored.add(new ScoredImage(abs, score, "img"));
        }

        scored.sort(Comparator.comparingInt((ScoredImage s) -> s.score).reversed());
        List<String> out = new ArrayList<>();
        Set<String> seen = new LinkedHashSet<>();
        for (ScoredImage si : scored) {
            if (seen.size() >= cap) {
                break;
            }
            if (seen.add(si.url)) {
                out.add(si.url);
            }
        }
        return out;
    }

    private record ScoredImage(String url, int score, String kind) {
    }

    private static int estimateMainContentStartIndex(String html) {
        String lc = html.toLowerCase(Locale.ROOT);
        int best = Integer.MAX_VALUE;
        int article = lc.indexOf("<article");
        if (article >= 0) {
            best = Math.min(best, article);
        }
        int main = lc.indexOf("<main");
        if (main >= 0) {
            best = Math.min(best, main);
        }
        Matcher br = BODY_REGION_HINT.matcher(html);
        if (br.find()) {
            best = Math.min(best, br.start());
        }
        int h1 = lc.indexOf("<h1");
        if (h1 >= 0) {
            best = Math.min(best, h1);
        }
        int body = lc.indexOf("<body");
        if (body >= 0) {
            best = Math.min(best, body + 200);
        }
        if (best == Integer.MAX_VALUE) {
            return 0;
        }
        return best;
    }

    private static int[] parseImgWidthHeight(String attrs) {
        if (attrs == null) {
            return new int[]{-1, -1};
        }
        String a = attrs.toLowerCase(Locale.ROOT);
        int w = -1;
        int h = -1;
        Matcher wm = Pattern.compile("width=[\"']?(\\d+)[\"']?", Pattern.CASE_INSENSITIVE).matcher(a);
        Matcher hm = Pattern.compile("height=[\"']?(\\d+)[\"']?", Pattern.CASE_INSENSITIVE).matcher(a);
        try {
            if (wm.find()) {
                w = Integer.parseInt(wm.group(1));
            }
            if (hm.find()) {
                h = Integer.parseInt(hm.group(1));
            }
        } catch (NumberFormatException ignored) {
        }
        return new int[]{w, h};
    }

    private static int scoreBodyImage(int tagPos, int bodyStart, int[] wh, String attrs, String title, String plainBody) {
        int score = 100;
        if (tagPos >= bodyStart) {
            score += 220;
        } else {
            score -= 200;
        }
        int w = wh[0];
        int h = wh[1];
        if (w > 0 && h > 0) {
            int area = w * h;
            if (area >= 120_000) {
                score += 120;
            } else if (area >= 40_000) {
                score += 70;
            } else if (w <= 96 && h <= 96) {
                score -= 180;
            } else if (w <= 160 && h <= 160) {
                score -= 40;
            }
        }
        score += altAndCaptionRelevance(attrs, title, plainBody);
        return score;
    }

    private static int altAndCaptionRelevance(String attrs, String title, String plainBody) {
        if (attrs == null) {
            return 0;
        }
        Matcher am = Pattern.compile("alt=[\"']([^\"']*)[\"']", Pattern.CASE_INSENSITIVE).matcher(attrs);
        String alt = am.find() ? am.group(1).trim() : "";
        if (alt.isEmpty()) {
            return 0;
        }
        int bonus = 0;
        if (title != null && title.length() >= 4 && alt.length() >= 2) {
            String tl = title.toLowerCase(Locale.ROOT);
            String al = alt.toLowerCase(Locale.ROOT);
            if (tl.contains(al) || al.contains(tl.substring(0, Math.min(tl.length(), 12)))) {
                bonus += 80;
            } else if (hasTokenOverlap(tl, al)) {
                bonus += 45;
            }
        }
        if (plainBody != null && plainBody.length() >= 30 && alt.length() >= 4) {
            String sample = plainBody.substring(0, Math.min(plainBody.length(), 600)).toLowerCase(Locale.ROOT);
            String al = alt.toLowerCase(Locale.ROOT);
            if (sample.contains(al)) {
                bonus += 55;
            }
        }
        bonus += substringOverlapScore(title, alt);
        return bonus;
    }

    /** 中文标题与 alt 常无空格分词：用最长公共子串长度加分 */
    private static int substringOverlapScore(String title, String alt) {
        if (title == null || alt == null) {
            return 0;
        }
        String t = title.replaceAll("\\s+", "");
        String a = alt.replaceAll("\\s+", "");
        if (t.length() < 4 || a.length() < 4) {
            return 0;
        }
        int best = 0;
        int maxWindow = Math.min(24, a.length());
        for (int len = maxWindow; len >= 4; len--) {
            for (int i = 0; i + len <= a.length(); i++) {
                if (t.contains(a.substring(i, i + len))) {
                    best = Math.max(best, len);
                }
            }
        }
        return best >= 8 ? 65 : (best >= 6 ? 40 : (best >= 4 ? 20 : 0));
    }

    private static boolean hasTokenOverlap(String a, String b) {
        String[] ta = a.split("[\\s\\p{Punct}]+");
        String[] tb = b.split("[\\s\\p{Punct}]+");
        for (String x : ta) {
            if (x.length() < 3) {
                continue;
            }
            for (String y : tb) {
                if (y.length() >= 3 && x.equals(y)) {
                    return true;
                }
            }
        }
        return false;
    }

    private static boolean isLikelyNoiseImageUrl(String url) {
        if (url == null) {
            return true;
        }
        if (URL_NOISE_MARKERS.matcher(url).find()) {
            return true;
        }
        String u = url.toLowerCase(Locale.ROOT);
        return u.endsWith(".svg") && (u.contains("icon") || u.contains("logo"));
    }

    private static boolean isLikelyBrandOrChromeImageUrl(String url) {
        if (url == null || url.isBlank()) {
            return true;
        }
        return URL_BRAND_OR_CHROME.matcher(url).find();
    }

    private static String resolveImgRef(String ref, URI base) {
        if (ref == null || ref.isBlank()) {
            return null;
        }
        ref = ref.trim();
        if (ref.startsWith("data:") || ref.startsWith("blob:")) {
            return null;
        }
        if (ref.startsWith("//")) {
            ref = base.getScheme() + ":" + ref;
        } else if (ref.startsWith("/")) {
            ref = base.resolve(ref).toString();
        } else if (!ref.toLowerCase(Locale.ROOT).startsWith("http")) {
            try {
                ref = base.resolve(ref).toString();
            } catch (Exception e) {
                return null;
            }
        }
        if (!ref.toLowerCase(Locale.ROOT).startsWith("http")) {
            return null;
        }
        return ref;
    }

    private static boolean isLikelyShareOrDecorativeImageUrl(String url) {
        if (url == null || url.isBlank()) {
            return true;
        }
        String u = url.toLowerCase(Locale.ROOT);
        for (String m : SHARE_OR_DECOR_IMAGE_MARKERS) {
            if (u.contains(m)) {
                return true;
            }
        }
        return false;
    }

    /** 顶栏 Logo、导航图标、语言球等：class/id/alt 命中则不作为正文图 */
    private static boolean isLikelyHeaderChromeAttributes(String attrs) {
        if (attrs == null) {
            return false;
        }
        String a = attrs.toLowerCase(Locale.ROOT);
        if (a.contains("site-logo") || a.contains("sitelogo") || a.contains("channel-logo")
                || a.contains("navbar") || a.contains("nav-bar") || a.contains("head-nav")
                || a.contains("topbar") || a.contains("top-bar") || a.contains("header-logo")) {
            return true;
        }
        Matcher idClass = Pattern.compile("(class|id)=[\"']([^\"']+)[\"']", Pattern.CASE_INSENSITIVE).matcher(a);
        while (idClass.find()) {
            String block = idClass.group(2).toLowerCase(Locale.ROOT);
            if (block.contains("logo") || block.contains("toolbar") || block.contains("lang-switch")
                    || block.contains("languages") || block.contains("globe")) {
                return true;
            }
        }
        Matcher am = Pattern.compile("alt=[\"']([^\"']*)[\"']", Pattern.CASE_INSENSITIVE).matcher(attrs);
        if (am.find()) {
            String alt = am.group(1).replaceAll("\\s+", "").toLowerCase(Locale.ROOT);
            if (alt.contains("中国网") || alt.contains("网logo") || alt.contains("网站logo")
                    || alt.contains("首页") || alt.equals("logo") || alt.contains("标志")) {
                return true;
            }
        }
        return false;
    }

    /**
     * 侧栏「分享到微博/微信」等小图：根据 class/id/alt 与声明尺寸过滤。
     */
    private static boolean isLikelyDecorativeImgAttributes(String attrs) {
        if (attrs == null) {
            return false;
        }
        String a = attrs.toLowerCase(Locale.ROOT);
        if (a.contains("share") || a.contains("sns") || a.contains("social")) {
            return true;
        }
        if (a.contains("sidebar") || a.contains("widget-icon") || a.contains("fixed-side")) {
            return true;
        }
        if ((a.contains("weibo") || a.contains("weixin") || a.contains("wechat") || a.contains("qzone"))
                && (a.contains("icon") || a.contains("btn"))) {
            return true;
        }
        Matcher wm = Pattern.compile("width=[\"']?(\\d+)[\"']?", Pattern.CASE_INSENSITIVE).matcher(a);
        Matcher hm = Pattern.compile("height=[\"']?(\\d+)[\"']?", Pattern.CASE_INSENSITIVE).matcher(a);
        if (wm.find() && hm.find()) {
            try {
                int w = Integer.parseInt(wm.group(1));
                int h = Integer.parseInt(hm.group(1));
                if (w > 0 && h > 0 && w <= 48 && h <= 48) {
                    return true;
                }
            } catch (NumberFormatException ignored) {
            }
        }
        return false;
    }

    private synchronized String getCachedText(URI uri) {
        int ttl = properties.getUrlFetchCacheTtlSeconds();
        if (ttl <= 0) {
            return null;
        }
        String key = uri.toString();
        CacheEntry e = fetchCache.get(key);
        if (e == null) {
            return null;
        }
        if (Instant.now().isAfter(e.expires)) {
            fetchCache.remove(key);
            return null;
        }
        return e.text;
    }

    private synchronized void putCachedText(URI uri, String text) {
        int ttl = properties.getUrlFetchCacheTtlSeconds();
        if (ttl <= 0) {
            return;
        }
        int maxEntries = Math.max(4, properties.getUrlFetchCacheMaxEntries());
        while (fetchCache.size() >= maxEntries) {
            String first = fetchCache.keySet().iterator().next();
            fetchCache.remove(first);
        }
        fetchCache.put(uri.toString(), new CacheEntry(text, Instant.now().plusSeconds(ttl)));
    }

    private record CacheEntry(String text, Instant expires) {
    }
}
