package com.aiassistant.service.llm;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.aiassistant.config.TenantContext;
import com.aiassistant.security.ContentFilter;
import com.aiassistant.service.OpenAiResponseParser;
import com.aiassistant.stats.InMemoryTokenUsageTracker;
import com.aiassistant.stats.TokenUsageTracker;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import reactor.core.publisher.Flux;

class ResponsePostProcessorTest {

    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final OpenAiResponseParser PARSER = new OpenAiResponseParser(MAPPER);

    @Test
    void filterSyncBypassesWhenContentFilterIsNull() {
        ResponsePostProcessor pp = new ResponsePostProcessor(null, null, PARSER);
        assertEquals("call me at 13800138000", pp.filterSync("call me at 13800138000"));
    }

    @Test
    void filterSyncMasksPiiWhenContentFilterPresent() {
        ResponsePostProcessor pp = new ResponsePostProcessor(new ContentFilter(), null, PARSER);
        assertEquals("call me at [手机号已脱敏]", pp.filterSync("call me at 13800138000"));
    }

    @Test
    void parseContentFromRawForwardsToParser() {
        ResponsePostProcessor pp = new ResponsePostProcessor(null, null, PARSER);
        String json = "{\"choices\":[{\"message\":{\"content\":\"hello world\"}}]}";
        assertEquals("hello world", pp.parseContentFromRaw(json));
    }

    @Test
    void extractAndRecordReturnsZeroesAndDoesNotRecordWhenTrackerNull() {
        ResponsePostProcessor pp = new ResponsePostProcessor(null, null, PARSER);
        int[] counts =
                pp.extractAndRecord(
                        "{\"usage\":{\"prompt_tokens\":12,\"completion_tokens\":34}}",
                        "test-model");
        assertEquals(12, counts[0]);
        assertEquals(34, counts[1]);
    }

    @Test
    void extractAndRecordRecordsUsageWhenTrackerPresent() {
        TokenUsageTracker tracker = new InMemoryTokenUsageTracker();
        ResponsePostProcessor pp = new ResponsePostProcessor(null, tracker, PARSER);
        int[] counts =
                pp.extractAndRecord(
                        "{\"usage\":{\"prompt_tokens\":7,\"completion_tokens\":11}}", "gpt-x");
        assertEquals(7, counts[0]);
        assertEquals(11, counts[1]);

        Map<String, Object> snap = tracker.getSnapshot(TenantContext.tenantId());
        assertEquals(18L, snap.get("totalTokens"));
        Map<?, ?> byModel = (Map<?, ?>) snap.get("byModel");
        assertNotNull(byModel);
        assertEquals(18L, byModel.get("gpt-x"));
    }

    @Test
    void extractAndRecordSkipsTrackerWhenUsageIsZero() {
        TokenUsageTracker tracker = new InMemoryTokenUsageTracker();
        ResponsePostProcessor pp = new ResponsePostProcessor(null, tracker, PARSER);
        int[] counts = pp.extractAndRecord("{\"choices\":[]}", "gpt-x");
        assertEquals(0, counts[0]);
        assertEquals(0, counts[1]);
        assertEquals(0L, tracker.getTotalTokens());
    }

    @Test
    void filterStreamPassesThroughWhenBothDependenciesAreNull() {
        ResponsePostProcessor pp = new ResponsePostProcessor(null, null, PARSER);
        List<String> out = pp.filterStream(Flux.just("hello ", "world"), "m").collectList().block();
        assertEquals(List.of("hello ", "world"), out);
    }

    @Test
    void filterStreamMasksChunksAndAccumulatesEstimatedCompletionTokens() {
        TokenUsageTracker tracker = new InMemoryTokenUsageTracker();
        ResponsePostProcessor pp = new ResponsePostProcessor(new ContentFilter(), tracker, PARSER);

        List<String> out =
                pp.filterStream(Flux.just("phone ", "13800138000"), "stream-model")
                        .collectList()
                        .block();

        assertEquals(List.of("phone ", "[手机号已脱敏]"), out);

        // The tracker received an estimated completion-token count for the full streamed text.
        Map<String, Object> snap = tracker.getSnapshot(TenantContext.tenantId());
        Long completionTokens = (Long) snap.get("completionTokens");
        assertNotNull(completionTokens);
        assertTrue(completionTokens > 0);
    }
}
