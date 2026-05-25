package com.aiassistant.service;

import com.aiassistant.config.AiAssistantProperties;
import java.util.Locale;
import java.util.concurrent.CompletableFuture;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.ApplicationListener;

/** Warms the configured default model once after the application is ready. */
public class LlmWarmupRunner implements ApplicationListener<ApplicationReadyEvent> {

    static final String WARMUP_PROMPT = "只回复 OK";

    private static final Logger log = LoggerFactory.getLogger(LlmWarmupRunner.class);

    private final AiAssistantProperties properties;
    private final LlmService llmService;

    public LlmWarmupRunner(AiAssistantProperties properties, LlmService llmService) {
        this.properties = properties;
        this.llmService = llmService;
    }

    @Override
    public void onApplicationEvent(ApplicationReadyEvent event) {
        if (!properties.isWarmupEnabled()) {
            return;
        }
        CompletableFuture.runAsync(this::warmupOnce);
    }

    void warmupOnce() {
        if (!properties.isWarmupEnabled()) {
            return;
        }
        if (properties.resolveApiKeys().isEmpty() && requiresProviderKey()) {
            log.info("AI Assistant warmup skipped because no provider API key is configured");
            return;
        }
        String model = properties.resolveModel();
        long startedAt = System.currentTimeMillis();
        try {
            llmService.chat(WARMUP_PROMPT, null, null, model);
            log.info(
                    "AI Assistant warmup completed: model={}, elapsedMs={}",
                    model,
                    System.currentTimeMillis() - startedAt);
        } catch (Exception e) {
            log.info(
                    "AI Assistant warmup failed: model={}, elapsedMs={}, error={}",
                    model,
                    System.currentTimeMillis() - startedAt,
                    e.getMessage());
        }
    }

    private boolean requiresProviderKey() {
        String provider = properties.getProvider();
        return provider == null || !"ollama".equals(provider.trim().toLowerCase(Locale.ROOT));
    }
}
