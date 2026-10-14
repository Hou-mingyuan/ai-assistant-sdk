package com.aiassistant.service.llm;

import com.aiassistant.config.TenantContext;
import com.aiassistant.security.ContentFilter;
import com.aiassistant.service.OpenAiResponseParser;
import com.aiassistant.stats.TokenUsageTracker;
import reactor.core.publisher.Flux;

/**
 * Post-LLM processing: PII scrubbing on assistant output, response payload parsing, and usage-based
 * token accounting.
 *
 * <p>Splits cleanly into three responsibilities:
 *
 * <ul>
 *   <li>Sync — {@link #parseContentFromRaw(String)} extracts the assistant text from the raw
 *       OpenAI-compatible JSON; {@link #filterSync(String)} runs PII filtering on that text.
 *   <li>Streaming — {@link #filterStream(Flux, String)} layers per-chunk PII filtering and a
 *       deferred token-usage record on a streaming response.
 *   <li>Accounting — {@link #extractAndRecord(String, String)} pulls {@code usage.prompt_tokens /
 *       completion_tokens} out of a non-stream response and pushes them into the tracker.
 * </ul>
 *
 * <p>{@link ContentFilter} and {@link TokenUsageTracker} dependencies are optional. {@link
 * OpenAiResponseParser} must be supplied because it has no sensible default.
 */
public class ResponsePostProcessor {

    private final ContentFilter contentFilter;
    private final TokenUsageTracker tokenUsageTracker;
    private final OpenAiResponseParser responseParser;

    public ResponsePostProcessor(
            ContentFilter contentFilter,
            TokenUsageTracker tokenUsageTracker,
            OpenAiResponseParser responseParser) {
        this.contentFilter = contentFilter;
        this.tokenUsageTracker = tokenUsageTracker;
        this.responseParser = responseParser;
    }

    /** Apply PII / prompt-injection filter to a synchronous assistant response. */
    public String filterSync(String response) {
        if (contentFilter == null) {
            return response;
        }
        return contentFilter.filterOutput(response);
    }

    /** Extract the assistant content text from a raw OpenAI-compatible completion JSON. */
    public String parseContentFromRaw(String rawResponse) {
        return responseParser.parseContent(rawResponse);
    }

    /**
     * Pull {@code usage.prompt_tokens / completion_tokens} from {@code rawResponse} and record them
     * for the current tenant, returning {@code [promptTokens, completionTokens]}.
     */
    public int[] extractAndRecord(String rawResponse, String modelId) {
        int[] counts = responseParser.parseUsage(rawResponse);
        if (tokenUsageTracker != null && counts[0] + counts[1] > 0) {
            String tenantId = TenantContext.tenantId();
            tokenUsageTracker.recordUsage(tenantId, modelId, counts[0], counts[1]);
        }
        return counts;
    }

    /**
     * Apply per-chunk PII filtering and accumulate the streamed text so we can record an estimated
     * completion-token count when the stream completes.
     *
     * <p>P0 hardening: {@link TenantContext} is a ThreadLocal set on the servlet thread. Stream
     * operators run on reactor threads where that ThreadLocal is absent, so the tenant id is
     * captured here at assembly time (on the calling thread, e.g. the request thread or the
     * boundedElastic probe) and used inside the completion callback. Same pattern as
     * AsyncTaskController's manual capture/restore around executor.submit().
     */
    public Flux<String> filterStream(Flux<String> flux, String modelId) {
        if (contentFilter == null && tokenUsageTracker == null) {
            return flux;
        }
        // Capture on the assembly thread; do NOT read TenantContext inside stream callbacks.
        final String tenantId = TenantContext.tenantId();
        StringBuilder fullText = new StringBuilder();
        return flux.map(
                        chunk -> {
                            fullText.append(chunk);
                            if (contentFilter != null) {
                                return contentFilter.filterOutput(chunk);
                            }
                            return chunk;
                        })
                .doOnComplete(
                        () -> {
                            if (tokenUsageTracker != null && !fullText.isEmpty()) {
                                int estimatedCompletionTokens = fullText.length() / 4;
                                tokenUsageTracker.recordUsage(
                                        tenantId, modelId, 0, estimatedCompletionTokens);
                            }
                        });
    }
}
