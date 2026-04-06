package com.aiassistant.model;

import java.util.List;

/**
 * GET /models：可供前端下拉的模型 id 列表（已由服务端白名单约束）。
 */
public class ModelsListResponse {

    private boolean success = true;
    private List<String> models;
    private String defaultModel;

    public static ModelsListResponse ok(List<String> models, String defaultModel) {
        ModelsListResponse r = new ModelsListResponse();
        r.models = models;
        r.defaultModel = defaultModel;
        return r;
    }

    public boolean isSuccess() {
        return success;
    }

    public void setSuccess(boolean success) {
        this.success = success;
    }

    public List<String> getModels() {
        return models;
    }

    public void setModels(List<String> models) {
        this.models = models;
    }

    public String getDefaultModel() {
        return defaultModel;
    }

    public void setDefaultModel(String defaultModel) {
        this.defaultModel = defaultModel;
    }
}
