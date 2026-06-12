package com.aiassistant.service;

/**
 * 一条网页搜索结果来源，附带质量评分与标签。
 *
 * <p>原先是 {@link UrlFetchService} 的内部 record，为支持 web 搜索能力按服务拆分（fetch / preview / search），提升为独立顶层类型，供
 * {@link WebSearchService}、{@link UrlFetchService} 门面以及下游 Controller / 响应模型共享引用。
 *
 * @author houmy01
 */
public record SearchSource(
        String title, String url, String snippet, int qualityScore, String qualityLabel) {}
