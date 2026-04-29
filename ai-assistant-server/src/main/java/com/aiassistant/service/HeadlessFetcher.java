package com.aiassistant.service;

import java.util.List;

/**
 * Abstraction for headless browser fetching, decoupling UrlFetchService from Playwright class
 * loading.
 */
public interface HeadlessFetcher {

    record Result(String title, String text, List<String> imageUrls) {}

    Result fetch(String url);
}
