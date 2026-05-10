package com.aiassistant.config;

/**
 * Internal abstraction shared by advisors that need to know whether the JVM looks like it is part
 * of a multi-replica deployment. Kept package-private because callers should not depend on its
 * exact shape — public advisors may swap their detection strategy at any time.
 *
 * <p>The default implementation is {@link SystemEnvMultiReplicaEnvironmentProbe}, which inspects
 * Kubernetes service discovery hints and pod hostname patterns. Tests inject deterministic
 * implementations to avoid touching real environment variables.
 */
interface MultiReplicaEnvironmentProbe {
    boolean looksLikeMultiReplica();
}
