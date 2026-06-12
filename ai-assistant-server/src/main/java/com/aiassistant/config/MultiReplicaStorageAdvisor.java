package com.aiassistant.config;

import com.aiassistant.rag.InMemoryVectorStore;
import com.aiassistant.rag.VectorStore;
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
 *
 * <p>In a single-replica setup these defaults are fine and incur no extra dependency. Once the
 * service is scaled out — Kubernetes Deployment with replicas &gt; 1, blue/green or canary
 * rollouts, or any horizontally-scaled PaaS — every replica keeps its own copy of the state and
 * users observe inconsistent behavior:
 *
 * <ul>
 *   <li>RAG documents indexed on one replica are not visible to others.
 *   <li>Conversation history written by replica A is missing when the next request lands on B.
 *   <li>Token usage and quotas are counted per replica, so a hard quota of {@code N} tokens per day
 *       effectively becomes {@code N * replicas}.
 *   <li>Session listings and per-user limits drift between replicas.
 * </ul>
 *
 * <p>The advisor only emits a single grouped warning per affected component and does not change
 * defaults. Hosts can silence individual warnings by registering replacement beans ({@code @Bean
 * SessionStore redisSessionStore()}, {@code @Bean ConversationMemoryProvider
 * redisConversationMemoryProvider()}, etc.) or by ignoring the warning if the multi-replica
 * detection was a false positive.
 */
public class MultiReplicaStorageAdvisor {

    public static final String MULTI_REPLICA_INMEMORY_VECTOR_STORE =
            "MULTI_REPLICA_INMEMORY_VECTOR_STORE";
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

    /**
     * Test-friendly constructor: lets unit tests inject a fake probe so the multi-replica detection
     * can be exercised without manipulating real environment variables.
     */
    MultiReplicaStorageAdvisor(MultiReplicaEnvironmentProbe environmentProbe) {
        this.environmentProbe = environmentProbe;
    }

    /**
     * Returns the list of warning codes that apply to the supplied beans, or an empty list if the
     * environment does not look multi-replica.
     */
    public List<String> warningCodes(
            VectorStore vectorStore,
            SessionStore sessionStore,
            TokenUsageTracker tokenUsageTracker,
            ConversationMemoryProvider conversationMemoryProvider) {
        if (!environmentProbe.looksLikeMultiReplica()) {
            return List.of();
        }
        List<String> warnings = new ArrayList<>();
        if (vectorStore instanceof InMemoryVectorStore) {
            warnings.add(MULTI_REPLICA_INMEMORY_VECTOR_STORE);
        }
        if (sessionStore instanceof InMemorySessionStore) {
            warnings.add(MULTI_REPLICA_INMEMORY_SESSION_STORE);
        }
        // Only the in-memory implementation is per-replica; a shared backend
        // (RedisTokenUsageTracker or a custom bean) is consistent and must not warn.
        if (tokenUsageTracker instanceof InMemoryTokenUsageTracker) {
            warnings.add(MULTI_REPLICA_INMEMORY_TOKEN_USAGE);
        }
        if (conversationMemoryProvider instanceof InMemoryConversationMemoryProvider) {
            warnings.add(MULTI_REPLICA_INMEMORY_CONVERSATION_MEMORY);
        }
        return List.copyOf(warnings);
    }

    /** Emits one structured WARN per affected component on the SLF4J logger. */
    public void logWarnings(
            VectorStore vectorStore,
            SessionStore sessionStore,
            TokenUsageTracker tokenUsageTracker,
            ConversationMemoryProvider conversationMemoryProvider) {
        for (String warning :
                warningCodes(
                        vectorStore, sessionStore, tokenUsageTracker, conversationMemoryProvider)) {
            switch (warning) {
                case MULTI_REPLICA_INMEMORY_VECTOR_STORE ->
                        log.warn(
                                "RAG is using InMemoryVectorStore but the environment looks like a multi-replica "
                                        + "deployment. Indexed documents will not be visible across replicas. "
                                        + "Replace with a shared VectorStore bean (Milvus / Pinecone / Qdrant / pgvector) "
                                        + "before relying on RAG in production.");
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
