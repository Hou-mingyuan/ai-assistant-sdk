package com.aiassistant.config;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.aiassistant.memory.ConversationMemory;
import com.aiassistant.service.InMemorySessionStore;
import com.aiassistant.spi.ConversationMemoryProvider;
import com.aiassistant.spi.InMemoryConversationMemoryProvider;
import com.aiassistant.stats.InMemoryTokenUsageTracker;
import java.util.List;
import org.junit.jupiter.api.Test;

class MultiReplicaStorageAdvisorTest {

    @Test
    void explicitScaleOutFailsEvenWhenEnvironmentProbeMissesIt() {
        MultiReplicaStorageAdvisor advisor = new MultiReplicaStorageAdvisor(() -> false);
        org.junit.jupiter.api.Assertions.assertThrows(
                IllegalStateException.class,
                () ->
                        advisor.enforceReplicaCount(
                                2,
                                new InMemorySessionStore(),
                                new InMemoryTokenUsageTracker(),
                                new InMemoryConversationMemoryProvider()));
        org.junit.jupiter.api.Assertions.assertDoesNotThrow(
                () ->
                        advisor.enforceReplicaCount(
                                1,
                                new InMemorySessionStore(),
                                new InMemoryTokenUsageTracker(),
                                new InMemoryConversationMemoryProvider()));
    }

    @Test
    void singleReplicaEnvironmentProducesNoWarnings() {
        MultiReplicaStorageAdvisor advisor = new MultiReplicaStorageAdvisor(() -> false);

        List<String> warnings =
                advisor.warningCodes(
                        new InMemorySessionStore(),
                        new InMemoryTokenUsageTracker(),
                        new InMemoryConversationMemoryProvider());

        assertTrue(warnings.isEmpty());
    }

    @Test
    void multiReplicaEnvironmentWithAllDefaultsProducesAllWarnings() {
        MultiReplicaStorageAdvisor advisor = new MultiReplicaStorageAdvisor(() -> true);

        List<String> warnings =
                advisor.warningCodes(
                        new InMemorySessionStore(),
                        new InMemoryTokenUsageTracker(),
                        new InMemoryConversationMemoryProvider());

        assertEquals(
                List.of(
                        MultiReplicaStorageAdvisor.MULTI_REPLICA_INMEMORY_SESSION_STORE,
                        MultiReplicaStorageAdvisor.MULTI_REPLICA_INMEMORY_TOKEN_USAGE,
                        MultiReplicaStorageAdvisor.MULTI_REPLICA_INMEMORY_CONVERSATION_MEMORY),
                warnings);
    }

    @Test
    void multiReplicaEnvironmentWithReplacedBeansSilencesIndividualWarnings() {
        MultiReplicaStorageAdvisor advisor = new MultiReplicaStorageAdvisor(() -> true);

        ConversationMemoryProvider customMemory = sessionId -> (ConversationMemory) null;

        List<String> warnings =
                advisor.warningCodes(new InMemorySessionStore(), null, customMemory);

        assertEquals(
                List.of(MultiReplicaStorageAdvisor.MULTI_REPLICA_INMEMORY_SESSION_STORE), warnings);
    }

    @Test
    void multiReplicaEnvironmentWithNullBeansProducesNoWarnings() {
        MultiReplicaStorageAdvisor advisor = new MultiReplicaStorageAdvisor(() -> true);

        List<String> warnings = advisor.warningCodes(null, null, null);

        assertTrue(warnings.isEmpty());
    }
}
