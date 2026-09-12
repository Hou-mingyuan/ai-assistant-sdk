# Instance and State Ownership

The default Starter supports one application JVM. Set
`ai-assistant.deployment-replicas` to the actual maximum concurrent JVM count,
including rolling-update overlap. Values above one now stop startup if an enabled
core store is a known in-memory implementation. Kubernetes heuristics still emit
warnings; they are not proof of deployment topology or shared-store correctness.

| State | Default owner | Requirement before scale-out |
| --- | --- | --- |
| Indexed RAG vectors | InMemoryVectorStore in one JVM | Shared VectorStore, consistent collection/tenant keys and coordinated ingestion |
| Session listings and history | InMemorySessionStore | RedisSessionStore or a shared host implementation |
| Conversation facts/history | InMemoryConversationMemoryProvider | RedisConversationMemoryProvider or equivalent shared implementation |
| Token usage and daily quotas | InMemoryTokenUsageTracker | RedisTokenUsageTracker/shared counter with atomic increments |
| Request limits | Per-JVM unless distributed limiter is enabled | Shared Redis limiter or gateway-enforced quota |
| Active streams/tool execution | The request's JVM | Drain requests before stopping a replica; define host idempotency for side effects |

Replacing a bean bypasses recognition of the default memory store; it does not
certify that a custom bean is distributed. Hosts must verify cross-replica reads,
concurrent quota consumption, tenant isolation, and reconnects against real shared
services. Sticky sessions alone do not make token quotas or ingestion consistent.

Back up durable vector/session data with the host application's database and
Redis retention policy. A default in-memory restart loses that state. Use graceful
termination for active streams, and a host-owned durable job queue with leases if
background ingestion must survive worker failure. This change enforces declared
topology and does not implement a distributed task scheduler.
