package com.aiassistant.controller;

import com.aiassistant.config.RuntimeModelConfigService;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Runtime model-provider configuration for local/admin connection diagnostics. */
@RestController
@RequestMapping("${ai-assistant.context-path:/ai-assistant}/admin/runtime/model-config")
public class RuntimeModelConfigController {

    private final RuntimeModelConfigService runtimeModelConfigService;

    public RuntimeModelConfigController(RuntimeModelConfigService runtimeModelConfigService) {
        this.runtimeModelConfigService = runtimeModelConfigService;
    }

    @GetMapping
    public Map<String, Object> getRuntimeModelConfig() {
        return runtimeModelConfigService.snapshot().toResponse();
    }

    @PostMapping
    public Map<String, Object> updateRuntimeModelConfig(
            @RequestBody RuntimeModelConfigService.UpdateRequest request) {
        return runtimeModelConfigService.update(request).toResponse();
    }

    @PostMapping("/discover-models")
    public Map<String, Object> discoverRuntimeProviderModels() {
        return runtimeModelConfigService.discoverProviderModels();
    }
}
