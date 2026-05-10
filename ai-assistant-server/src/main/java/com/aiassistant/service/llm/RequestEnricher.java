package com.aiassistant.service.llm;

import com.aiassistant.security.ContentFilter;
import com.aiassistant.service.UrlFetchService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Pre-LLM enrichment of free-form user text.
 *
 * <p>Currently: {@link ContentFilter#filterInput(String) PII / prompt injection scrubbing} followed
 * by {@link UrlFetchService#enrichUserMessage(String) URL link expansion}.
 *
 * <p>Either dependency can be {@code null} (disabled). The enricher is resilient: if URL expansion
 * throws, the (already filtered) input text is returned, so chat keeps working when the network is
 * unreachable.
 */
public class RequestEnricher {

    private static final Logger log = LoggerFactory.getLogger(RequestEnricher.class);

    private final ContentFilter contentFilter;
    private final UrlFetchService urlFetchService;

    public RequestEnricher(ContentFilter contentFilter, UrlFetchService urlFetchService) {
        this.contentFilter = contentFilter;
        this.urlFetchService = urlFetchService;
    }

    /**
     * Filter sensitive content out of the user message and append fetched page bodies for any
     * inline links.
     */
    public String enrichUserText(String text) {
        if (text == null) {
            return text;
        }
        if (contentFilter != null) {
            ContentFilter.FilterResult filtered = contentFilter.filterInput(text);
            text = filtered.text();
            if (filtered.hasWarnings()) {
                log.warn("Content filter warnings: {}", filtered.warnings());
            }
        }
        if (urlFetchService == null) {
            return text;
        }
        try {
            return urlFetchService.enrichUserMessage(text);
        } catch (Exception e) {
            log.warn("URL enrichment skipped: {}", e.getMessage());
            return text;
        }
    }
}
