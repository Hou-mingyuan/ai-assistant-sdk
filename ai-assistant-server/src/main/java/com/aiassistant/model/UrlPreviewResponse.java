package com.aiassistant.model;

import java.util.Collections;
import java.util.List;

/**
 * GET /url-preview 响应体：页面标题、纯文本摘要、og/正文主图 URL 列表。
 */
public class UrlPreviewResponse {

    private boolean success;
    private String imageUrl;
    private String title;
    private String summary;
    private List<String> imageUrls;
    private String error;

    public static UrlPreviewResponse ok(String title, String summary, String imageUrl, List<String> imageUrls) {
        UrlPreviewResponse r = new UrlPreviewResponse();
        r.success = true;
        r.title = title;
        r.summary = summary;
        r.imageUrl = imageUrl;
        r.imageUrls = imageUrls != null ? imageUrls : Collections.emptyList();
        return r;
    }

    public static UrlPreviewResponse fail(String error) {
        UrlPreviewResponse r = new UrlPreviewResponse();
        r.success = false;
        r.error = error;
        return r;
    }

    public boolean isSuccess() {
        return success;
    }

    public void setSuccess(boolean success) {
        this.success = success;
    }

    public String getImageUrl() {
        return imageUrl;
    }

    public void setImageUrl(String imageUrl) {
        this.imageUrl = imageUrl;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getSummary() {
        return summary;
    }

    public void setSummary(String summary) {
        this.summary = summary;
    }

    public List<String> getImageUrls() {
        return imageUrls;
    }

    public void setImageUrls(List<String> imageUrls) {
        this.imageUrls = imageUrls;
    }

    public String getError() {
        return error;
    }

    public void setError(String error) {
        this.error = error;
    }
}
