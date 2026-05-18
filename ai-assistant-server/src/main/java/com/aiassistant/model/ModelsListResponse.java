package com.aiassistant.model;

import java.util.List;

/** GET /models：可供前端下拉的模型 id 列表（已由服务端白名单约束）。 */
public class ModelsListResponse {

    private boolean success = true;
    private List<String> models;
    private String defaultModel;
    private List<ModelDetail> modelDetails;

    public static ModelsListResponse ok(
            List<String> models, String defaultModel, List<ModelDetail> modelDetails) {
        ModelsListResponse r = new ModelsListResponse();
        r.models = models;
        r.defaultModel = defaultModel;
        r.modelDetails = modelDetails;
        return r;
    }

    public static ModelsListResponse ok(List<String> models, String defaultModel) {
        return ok(models, defaultModel, List.of());
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

    public List<ModelDetail> getModelDetails() {
        return modelDetails;
    }

    public void setModelDetails(List<ModelDetail> modelDetails) {
        this.modelDetails = modelDetails;
    }

    public static class ModelDetail {
        private String id;
        private List<String> capabilities;
        private String source;
        private String updatedAt;

        public ModelDetail() {}

        public ModelDetail(String id, List<String> capabilities, String source, String updatedAt) {
            this.id = id;
            this.capabilities = capabilities;
            this.source = source;
            this.updatedAt = updatedAt;
        }

        public String getId() {
            return id;
        }

        public void setId(String id) {
            this.id = id;
        }

        public List<String> getCapabilities() {
            return capabilities;
        }

        public void setCapabilities(List<String> capabilities) {
            this.capabilities = capabilities;
        }

        public String getSource() {
            return source;
        }

        public void setSource(String source) {
            this.source = source;
        }

        public String getUpdatedAt() {
            return updatedAt;
        }

        public void setUpdatedAt(String updatedAt) {
            this.updatedAt = updatedAt;
        }
    }
}
