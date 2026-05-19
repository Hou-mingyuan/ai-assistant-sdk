package com.aiassistant.autoconfigure;

import com.aiassistant.config.AiAssistantProperties;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * RAG 装配：VectorStore 默认实现（InMemory），可被宿主替换为 Milvus / Pinecone / Qdrant。 EmbeddingProvider 与
 * RagService 仅在 {@code ai-assistant.rag-enabled=true} 时激活。
 *
 * <p>Refactor (T2)：从 {@link AiAssistantAutoConfiguration} 拆出。
 */
@Configuration(proxyBeanMethods = false)
public class AiAssistantRagAutoConfiguration {

    @Bean
    @ConditionalOnMissingBean
    public com.aiassistant.rag.VectorStore vectorStore() {
        return new com.aiassistant.rag.InMemoryVectorStore();
    }

    @Bean
    @ConditionalOnMissingBean
    @ConditionalOnProperty(prefix = "ai-assistant", name = "rag-enabled", havingValue = "true")
    public com.aiassistant.rag.EmbeddingProvider embeddingProvider(
            AiAssistantProperties properties) {
        return new com.aiassistant.rag.OpenAiEmbeddingProvider(properties);
    }

    @Bean
    @ConditionalOnMissingBean
    @ConditionalOnProperty(prefix = "ai-assistant", name = "rag-enabled", havingValue = "true")
    public com.aiassistant.rag.RagService ragService(
            com.aiassistant.rag.EmbeddingProvider embeddingProvider,
            com.aiassistant.rag.VectorStore vectorStore) {
        return new com.aiassistant.rag.RagService(embeddingProvider, vectorStore);
    }
}
