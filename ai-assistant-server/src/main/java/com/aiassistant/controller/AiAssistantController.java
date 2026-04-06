package com.aiassistant.controller;

import com.aiassistant.config.AiAssistantProperties;
import com.aiassistant.model.ChatInputLimits;
import com.aiassistant.model.ChatRequest;
import com.aiassistant.model.ChatResponse;
import com.aiassistant.model.ModelsListResponse;
import com.aiassistant.model.UrlPreviewResponse;
import com.aiassistant.service.LlmService;
import com.aiassistant.service.UrlFetchService;
import com.aiassistant.stats.UsageStats;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import reactor.core.publisher.Flux;

@RestController
@RequestMapping("${ai-assistant.context-path:/ai-assistant}")
public class AiAssistantController {

    private static final Logger log = LoggerFactory.getLogger(AiAssistantController.class);

    private final LlmService llmService;
    private final UsageStats usageStats;
    private final UrlFetchService urlFetchService;
    private final AiAssistantProperties assistantProperties;

    public AiAssistantController(LlmService llmService, UsageStats usageStats, UrlFetchService urlFetchService,
                                 AiAssistantProperties assistantProperties) {
        this.llmService = llmService;
        this.usageStats = usageStats;
        this.urlFetchService = urlFetchService;
        this.assistantProperties = assistantProperties;
    }

    @PostMapping("/chat")
    public ChatResponse chat(@Valid @RequestBody ChatRequest request) {
        try {
            String tooLarge = ChatInputLimits.validateTotalChars(request, assistantProperties.getChatMaxTotalChars());
            if (tooLarge != null) {
                return ChatResponse.fail(tooLarge);
            }
            String action = request.getAction() == null ? "chat" : request.getAction();
            String result = switch (action) {
                case "translate" -> llmService.translate(request.getText(),
                        request.getTargetLang() != null ? request.getTargetLang() : "zh");
                case "summarize" -> llmService.summarize(request.getText());
                default -> llmService.chat(request.getText(), request.getHistory(), request.getSystemPrompt(),
                        request.getModel());
            };
            usageStats.recordCall(action);
            return ChatResponse.ok(result);
        } catch (Exception e) {
            usageStats.recordError();
            log.warn("POST /chat failed", e);
            return ChatResponse.fail("AI service error. Check server logs for details.");
        }
    }

    @PostMapping(value = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public Flux<String> stream(@Valid @RequestBody ChatRequest request) {
        String tooLarge = ChatInputLimits.validateTotalChars(request, assistantProperties.getChatMaxTotalChars());
        if (tooLarge != null) {
            return Flux.just("Error: " + tooLarge);
        }
        String action = request.getAction() == null ? "chat" : request.getAction();
        usageStats.recordCall("stream_" + action);
        return switch (action) {
            case "translate" -> llmService.translateStream(request.getText(),
                    request.getTargetLang() != null ? request.getTargetLang() : "zh");
            case "summarize" -> llmService.summarizeStream(request.getText());
            default -> llmService.chatStream(request.getText(), request.getHistory(), request.getSystemPrompt(),
                    request.getModel());
        };
    }

    @GetMapping("/health")
    public ChatResponse health() {
        return ChatResponse.ok("AI Assistant is running");
    }

    /**
     * 返回可供用户选择的模型 id 列表（受 {@code ai-assistant.allowed-models} 约束；未配置时仅一条默认模型）。
     */
    @GetMapping("/models")
    public ModelsListResponse listModels() {
        return ModelsListResponse.ok(
                assistantProperties.listModelsForClient(),
                assistantProperties.resolveModel());
    }

    /**
     * 从 http(s) 页面提取 og:image 或首个可读图片 URL及标题，供前端渲染预览（与 URL 抓取共用安全策略）。
     */
    @GetMapping("/url-preview")
    public UrlPreviewResponse urlPreview(@RequestParam(value = "url", required = false) String url) {
        return urlFetchService.previewUrl(url);
    }
}
