package com.aiassistant.service.llm;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.aiassistant.security.ContentFilter;
import com.aiassistant.service.UrlFetchService;
import org.junit.jupiter.api.Test;

class RequestEnricherTest {

    @Test
    void returnsNullWhenInputIsNull() throws Exception {
        UrlFetchService url = mock(UrlFetchService.class);
        RequestEnricher enricher = new RequestEnricher(null, url);

        assertNull(enricher.enrichUserText(null));
        verify(url, never()).enrichUserMessage(anyString());
    }

    @Test
    void filtersAndEnrichesUrlWhenBothDependenciesPresent() throws Exception {
        ContentFilter filter = new ContentFilter();
        UrlFetchService url = mock(UrlFetchService.class);
        when(url.enrichUserMessage(anyString()))
                .thenAnswer(inv -> inv.getArgument(0) + " [enriched]");

        RequestEnricher enricher = new RequestEnricher(filter, url);

        String result = enricher.enrichUserText("call me at 13800138000");
        assertEquals("call me at [手机号已脱敏] [enriched]", result);
        verify(url, times(1)).enrichUserMessage(anyString());
    }

    @Test
    void skipsContentFilterWhenAbsent() throws Exception {
        UrlFetchService url = mock(UrlFetchService.class);
        when(url.enrichUserMessage("raw text")).thenReturn("raw text [enriched]");

        RequestEnricher enricher = new RequestEnricher(null, url);

        assertEquals("raw text [enriched]", enricher.enrichUserText("raw text"));
    }

    @Test
    void skipsUrlFetchWhenServiceIsNull() {
        ContentFilter filter = new ContentFilter();
        RequestEnricher enricher = new RequestEnricher(filter, null);

        // Filter still runs; url-fetch is skipped silently.
        assertEquals("call me at [手机号已脱敏]", enricher.enrichUserText("call me at 13800138000"));
    }

    @Test
    void returnsFilteredTextWhenUrlFetchThrows() throws Exception {
        ContentFilter filter = new ContentFilter();
        UrlFetchService url = mock(UrlFetchService.class);
        when(url.enrichUserMessage(anyString()))
                .thenThrow(new RuntimeException("connection refused"));

        RequestEnricher enricher = new RequestEnricher(filter, url);

        // The filtered text survives even when url enrichment blows up.
        assertEquals("call me at [手机号已脱敏]", enricher.enrichUserText("call me at 13800138000"));
    }
}
