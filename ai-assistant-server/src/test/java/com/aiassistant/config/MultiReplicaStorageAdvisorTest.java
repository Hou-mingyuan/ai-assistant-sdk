package com.aiassistant.config;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.aiassistant.memory.ConversationMemory;
import com.aiassistant.rag.InMemoryVectorStore;
import com.aiassistant.rag.VectorStore;
import com.aiassistant.service.InMemorySessionStore;
import com.aiassistant.spi.ConversationMemoryProvider;
import com.aiassistant.spi.InMemoryConversationMemoryProvider;
import com.aiassistant.stats.TokenUsageTracker;
import java.util.List;
import org.junit.jupiter.api.Test;

class MultiReplicaStorageAdvisorTest {

    @Test
    void singleReplicaEnvironmentProducesNoWarnings() {
        MultiReplicaStorageAdvisor advisor = new MultiReplicaStorageAdvisor(() -> false);

        List<String> warnings =
                advisor.warningCodes(
                        new InMemoryVectorStore(),
                        new InMemorySessionStore(),
                        new TokenUsageTracker(),
                        new InMemoryConversationMemoryProvider());

        assertTrue(warnings.isEmpty());
    }

    @Test
    void multiReplicaEnvironmentWithAllDefaultsProducesAllWarnings() {
        MultiReplicaStorageAdvisor advisor = new MultiReplicaStorageAdvisor(() -> true);

        List<String> warnings =
                advisor.warningCodes(
                        new InMemoryVectorStore(),
                        new InMemorySessionStore(),
                        new TokenUsageTracker(),
                        new InMemoryConversationMemoryProvider());

        assertEquals(
                List.of(
                        MultiReplicaStorageAdvisor.MULTI_REPLICA_INMEMORY_VECTOR_STORE,
                        MultiReplicaStorageAdvisor.MULTI_REPLICA_INMEMORY_SESSION_STORE,
                        MultiReplicaStorageAdvisor.MULTI_REPLICA_INMEMORY_TOKEN_USAGE,
                        MultiReplicaStorageAdvisor.MULTI_REPLICA_INMEMORY_CONVERSATION_MEMORY),
                warnings);
    }

    @Test
    void multiReplicaEnvironmentWithReplacedBeansSilencesIndividualWarnings() {
        MultiReplicaStorageAdvisor advisor = new MultiReplicaStorageAdvisor(() -> true);

        VectorStore customVectorStore =
                new VectorStore() {
                    @Override
                    public void upsert(java.util.List<Document> documents) {}

                    @Override
                    public java.util.List<SearchResult> search(
                            float[] queryVector, int topK, String namespace) {
                        return java.util.List.of();
                    }

                    @Override
                    public void delete(String namespace, java.util.List<String> docIds) {}

                    @Override
                    public long count(String namespace) {
                        return 0;
                    }
                };

        ConversationMemoryProvider customMemory = sessionId -> (ConversationMemory) null;

        List<String> warnings =
                advisor.warningCodes(
                        customVectorStore, new InMemorySessionStore(), null, customMemory);

        // VectorStore replaced -> no warning. SessionStore still InMemory -> warned.
        // TokenUsageTracker null -> not warned. ConversationMemoryProvider replaced -> not warned.
        assertEquals(
                List.of(MultiReplicaStorageAdvisor.MULTI_REPLICA_INMEMORY_SESSION_STORE), warnings);
    }

    @Test
    void multiReplicaEnvironmentWithNullBeansProducesNoWarnings() {
        MultiReplicaStorageAdvisor advisor = new MultiReplicaStorageAdvisor(() -> true);

        List<String> warnings = advisor.warningCodes(null, null, null, null);

        assertTrue(warnings.isEmpty());
    }
}
