package com.aiassistant.config;

import com.aiassistant.service.InMemorySessionStore;
import com.aiassistant.service.SessionStore;
import com.aiassistant.spi.ConversationMemoryProvider;
import com.aiassistant.spi.InMemoryConversationMemoryProvider;
import com.aiassistant.stats.InMemoryTokenUsageTracker;
import com.aiassistant.stats.TokenUsageTracker;
import java.util.ArrayList;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Reports startup warnings when the JVM looks like a multi-replica deployment but core stateful
 * components are still using their default in-memory implementations.
 */
public class MultiReplicaStorageAdvisor {

    public static final String MULTI_REPLICA_INMEMORY_SESSION_STORE =
            "MULTI_REPLICA_INMEMORY_SESSION_STORE";
    public static final String MULTI_REPLICA_INMEMORY_TOKEN_USAGE =
            "MULTI_REPLICA_INMEMORY_TOKEN_USAGE";
    public static final String MULTI_REPLICA_INMEMORY_CONVERSATION_MEMORY =
            "MULTI_REPLICA_INMEMORY_CONVERSATION_MEMORY";

    private static final Logger log = LoggerFactory.getLogger(MultiReplicaStorageAdvisor.class);

    private final MultiReplicaEnvironmentProbe environmentProbe;

    public MultiReplicaStorageAdvisor() {
        this(new SystemEnvMultiReplicaEnvironmentProbe());
    }

    public MultiReplicaStorageAdvisor(MultiReplicaEnvironmentProbe environmentProbe) {
        this.environmentProbe = environmentProbe;
    }

    public List<String> warningCodes(
            SessionStore sessionStore,
            TokenUsageTracker tokenUsageTracker,
            ConversationMemoryProvider conversationMemoryProvider) {
        if (!environmentProbe.looksLikeMultiReplica()) {
            return List.of();
        }
        List<String> warnings = new ArrayList<>();
        if (sessionStore instanceof InMemorySessionStore) {
            warnings.add(MULTI_REPLICA_INMEMORY_SESSION_STORE);
        }
        if (tokenUsageTracker instanceof InMemoryTokenUsageTracker) {
            warnings.add(MULTI_REPLICA_INMEMORY_TOKEN_USAGE);
        }
        if (conversationMemoryProvider instanceof InMemoryConversationMemoryProvider) {
            warnings.add(MULTI_REPLICA_INMEMORY_CONVERSATION_MEMORY);
        }
        return warnings;
    }

    /** Explicit replica declarations are enforced; heuristic detection remains advisory. */
    public void enforceReplicaCount(
            int replicas,
            SessionStore sessionStore,
            TokenUsageTracker tokenUsageTracker,
            ConversationMemoryProvider conversationMemoryProvider) {
        if (replicas < 1) {
            throw new IllegalStateException("ai-assistant.deployment-replicas must be positive");
        }
        if (replicas == 1) {
            return;
        }
        List<String> problems =
                new MultiReplicaStorageAdvisor(() -> true)
                        .warningCodes(sessionStore, tokenUsageTracker, conversationMemoryProvider);
        if (!problems.isEmpty()) {
            throw new IllegalStateException(
                    "Shared storage is required for multiple replicas: " + problems);
        }
    }

    /** Emits one structured WARN per affected component on the SLF4J logger. */
    public void logWarnings(
            SessionStore sessionStore,
            TokenUsageTracker tokenUsageTracker,
            ConversationMemoryProvider conversationMemoryProvider) {
        for (String warning :
                warningCodes(sessionStore, tokenUsageTracker, conversationMemoryProvider)) {
            switch (warning) {
                case MULTI_REPLICA_INMEMORY_SESSION_STORE ->
                        log.warn(
                                "SessionStore is using InMemorySessionStore but the environment looks like a "
                                        + "multi-replica deployment. Sessions are visible only to the replica that wrote "
                                        + "them. Configure spring-data-redis and let the auto-configured RedisSessionStore "
                                        + "take over, or provide your own SessionStore bean.");
                case MULTI_REPLICA_INMEMORY_TOKEN_USAGE ->
                        log.warn(
                                "TokenUsageTracker is in-process but the environment looks like a multi-replica "
                                        + "deployment. Daily quotas are enforced per replica, so the effective limit is "
                                        + "quota * replicas. Place quota enforcement at an upstream gateway or replace "
                                        + "TokenUsageTracker with a shared backend.");
                case MULTI_REPLICA_INMEMORY_CONVERSATION_MEMORY ->
                        log.warn(
                                "ConversationMemoryProvider is using InMemoryConversationMemoryProvider but the "
                                        + "environment looks like a multi-replica deployment. Long-term facts and rolling "
                                        + "history are not shared. Configure RedisConversationMemoryProvider (or another "
                                        + "implementation) so that memory survives replica boundaries.");
                default -> {
                    // unknown code, ignore -- defensive
                }
            }
        }
    }
}
