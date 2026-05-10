package com.aiassistant.config;

/**
 * Default probe: returns {@code true} when the JVM is running inside a Kubernetes pod (presence of
 * {@code KUBERNETES_SERVICE_HOST}) or when {@code HOSTNAME} matches the typical multi-replica
 * patterns used by Deployments / StatefulSets ({@code <name>-<replicasethash>-<suffix>} or
 * {@code <name>-N}).
 */
class SystemEnvMultiReplicaEnvironmentProbe implements MultiReplicaEnvironmentProbe {

    @Override
    public boolean looksLikeMultiReplica() {
        if (hasEnv("KUBERNETES_SERVICE_HOST")) {
            return true;
        }
        String host = System.getenv("HOSTNAME");
        if (host == null || host.isBlank()) {
            return false;
        }
        return host.matches(".+-[a-z0-9]{5,10}-[a-z0-9]{5}") || host.matches(".+-\\d+");
    }

    private static boolean hasEnv(String name) {
        String value = System.getenv(name);
        return value != null && !value.isBlank();
    }
}
