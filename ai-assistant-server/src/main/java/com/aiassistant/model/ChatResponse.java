package com.aiassistant.model;

import com.aiassistant.service.SearchSource;
import java.util.List;

/** 统一 API 响应体：{@code success}=true 时结果在 {@code result}，否则错误信息在 {@code error}。 */
public class ChatResponse {

    private boolean success;
    private String result;
    private String error;
    private String errorCode;
    private RuntimeMeta meta;

    public static ChatResponse ok(String result) {
        return ok(result, null);
    }

    public static ChatResponse ok(String result, RuntimeMeta meta) {
        ChatResponse r = new ChatResponse();
        r.success = true;
        r.result = result;
        r.meta = meta;
        return r;
    }

    public static ChatResponse fail(String error) {
        ChatResponse r = new ChatResponse();
        r.success = false;
        r.error = error;
        return r;
    }

    public static ChatResponse fail(String errorCode, String error) {
        ChatResponse r = new ChatResponse();
        r.success = false;
        r.errorCode = errorCode;
        r.error = error;
        return r;
    }

    public boolean isSuccess() {
        return success;
    }

    public void setSuccess(boolean success) {
        this.success = success;
    }

    public String getResult() {
        return result;
    }

    public void setResult(String result) {
        this.result = result;
    }

    public String getError() {
        return error;
    }

    public void setError(String error) {
        this.error = error;
    }

    public String getErrorCode() {
        return errorCode;
    }

    public void setErrorCode(String errorCode) {
        this.errorCode = errorCode;
    }

    public RuntimeMeta getMeta() {
        return meta;
    }

    public void setMeta(RuntimeMeta meta) {
        this.meta = meta;
    }

    public static class RuntimeMeta {
        private String requestedModel;
        private String effectiveModel;
        private String provider;
        private boolean fallback;
        private int visionInputCount;
        private String visionRoute;
        private boolean webSearchEnabled;
        private String webSearchProvider;
        private boolean webSearchFallback;
        private int webSearchResultCount;
        private List<String> webSearchSourceUrls;
        private List<SearchSource> webSearchSourcePreviews;
        private String webSearchFailureReason;
        private long webSearchDurationMs = -1;
        private long webSearchStableDurationMs = -1;
        private long webSearchFallbackDurationMs = -1;

        public String getRequestedModel() {
            return requestedModel;
        }

        public void setRequestedModel(String requestedModel) {
            this.requestedModel = requestedModel;
        }

        public String getEffectiveModel() {
            return effectiveModel;
        }

        public void setEffectiveModel(String effectiveModel) {
            this.effectiveModel = effectiveModel;
        }

        public String getProvider() {
            return provider;
        }

        public void setProvider(String provider) {
            this.provider = provider;
        }

        public boolean isFallback() {
            return fallback;
        }

        public void setFallback(boolean fallback) {
            this.fallback = fallback;
        }

        public int getVisionInputCount() {
            return visionInputCount;
        }

        public void setVisionInputCount(int visionInputCount) {
            this.visionInputCount = visionInputCount;
        }

        public String getVisionRoute() {
            return visionRoute;
        }

        public void setVisionRoute(String visionRoute) {
            this.visionRoute = visionRoute;
        }

        public boolean isWebSearchEnabled() {
            return webSearchEnabled;
        }

        public void setWebSearchEnabled(boolean webSearchEnabled) {
            this.webSearchEnabled = webSearchEnabled;
        }

        public String getWebSearchProvider() {
            return webSearchProvider;
        }

        public void setWebSearchProvider(String webSearchProvider) {
            this.webSearchProvider = webSearchProvider;
        }

        public boolean isWebSearchFallback() {
            return webSearchFallback;
        }

        public void setWebSearchFallback(boolean webSearchFallback) {
            this.webSearchFallback = webSearchFallback;
        }

        public int getWebSearchResultCount() {
            return webSearchResultCount;
        }

        public void setWebSearchResultCount(int webSearchResultCount) {
            this.webSearchResultCount = webSearchResultCount;
        }

        public List<String> getWebSearchSourceUrls() {
            return webSearchSourceUrls;
        }

        public void setWebSearchSourceUrls(List<String> webSearchSourceUrls) {
            this.webSearchSourceUrls = webSearchSourceUrls;
        }

        public List<SearchSource> getWebSearchSourcePreviews() {
            return webSearchSourcePreviews;
        }

        public void setWebSearchSourcePreviews(List<SearchSource> webSearchSourcePreviews) {
            this.webSearchSourcePreviews = webSearchSourcePreviews;
        }

        public String getWebSearchFailureReason() {
            return webSearchFailureReason;
        }

        public void setWebSearchFailureReason(String webSearchFailureReason) {
            this.webSearchFailureReason = webSearchFailureReason;
        }

        public long getWebSearchDurationMs() {
            return webSearchDurationMs;
        }

        public void setWebSearchDurationMs(long webSearchDurationMs) {
            this.webSearchDurationMs = webSearchDurationMs;
        }

        public long getWebSearchStableDurationMs() {
            return webSearchStableDurationMs;
        }

        public void setWebSearchStableDurationMs(long webSearchStableDurationMs) {
            this.webSearchStableDurationMs = webSearchStableDurationMs;
        }

        public long getWebSearchFallbackDurationMs() {
            return webSearchFallbackDurationMs;
        }

        public void setWebSearchFallbackDurationMs(long webSearchFallbackDurationMs) {
            this.webSearchFallbackDurationMs = webSearchFallbackDurationMs;
        }
    }
}
