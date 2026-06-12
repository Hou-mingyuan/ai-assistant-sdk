# 多副本上线 Runbook

当独立服务以多副本（Helm `replicaCount > 1` / `autoscaling` / `docker compose --scale`）部署时，进程内状态会在副本间不一致。本页给出从「接 Redis」到「上线核对、故障演练、回滚」的完整操作手册。

配置项扫描可配合 [多实例部署配置 Lint](./multi-replica-lint.md)；K8s 细节见 [Kubernetes 指南](./kubernetes.md)；上线前安全/运维项见 [生产上线清单](./production-checklist.md)。

## 0. 最大的坑：镜像必须自带 Redis 依赖

发布镜像 `ai-assistant-service` **不自带** `spring-boot-starter-data-redis`（它在 starter 里是 `optional`）。因此：

- 直接用官方镜像 + Helm `redis.enabled=true` **无效**：classpath 没有 Redis → 没有 `StringRedisTemplate` bean → 所有状态仍走进程内内存。
- 必须**自建一个包含 Redis 依赖的镜像**才能真正启用跨副本（最简单：用内置 `redis` Maven profile，见第 2 节）。

Helm chart 内置了一个 `helm test` 守卫，会在 `redis.enabled=true` 时调用 `/runtime/config` 断言存储确实是分布式，揪出这种「静默回退内存」：

```bash
helm test <release>
```

## 1. 接 Redis 后哪些自动变分布式

只要镜像含 Redis 依赖且配置了 `spring.data.redis.*`（存在 `StringRedisTemplate` bean），以下能力自动切换；无需额外开关：

| 能力 | Redis 就绪后 | Redis key 命名 | 类型 |
| --- | --- | --- | --- |
| 限流（滑动窗口） | ✅ 自动 | `ai-rl:{client}:{action}` | ZSET |
| 会话存储 | ✅ 自动 | `ai-session:{userId}` | Hash |
| 会话记忆 | ✅ 自动 | `ai:memory:{sessionId}:messages` / `:facts` | String（TTL 24h） |
| 配额 / 用量 | ✅ 自动 | `ai-usage:quota` / `ai-usage:u:{tenant}:{date}` / `ai-usage:r:{tenant}:{date}` / `ai-usage:tenants` / `ai-usage:g` | Hash / String / Set |
| **RAG 向量库** | ❌ **仍是内存** | — | — |

::: warning RAG 向量库例外
RAG 向量库没有 Redis 变体。多副本 + `rag-enabled=true` 时，必须自行提供共享 `VectorStore` bean（Milvus / Qdrant / pgvector），否则各副本索引互不可见。
:::

四条 Redis 路径（限流 / 会话 / 记忆 / 配额）均为 **fail-open**：Redis 宕机时不抛错拖垮请求，而是优雅降级（限流/配额放行、会话读空、记忆读空、写不持久化），并按 30 秒节流打告警。生产仍需在 API 网关保留一道硬上限兜底。

## 2. 依赖（让镜像 / 宿主含 Redis 支持）

### 独立服务镜像：用内置 `redis` Maven profile（推荐）

服务模块自带一个 `redis` profile，激活后才把 `spring-boot-starter-data-redis` 打进产物；默认不打包，镜像足迹不变。

```bash
# 构建可运行 jar
mvn -Predis package

# 构建含 Redis 的镜像（Dockerfile 暴露了 MAVEN_ARGS 构建参数）
docker build --build-arg MAVEN_ARGS=-Predis -t ai-assistant-service:redis .
```

docker compose 里可在 `build.args` 传 `MAVEN_ARGS`：

```yaml
services:
  ai-assistant:
    build:
      context: .
      args:
        MAVEN_ARGS: -Predis
```

### Starter 集成到自己的 Spring Boot 后端

在宿主工程 pom 直接加依赖：

```xml
<dependency>
  <groupId>org.springframework.boot</groupId>
  <artifactId>spring-boot-starter-data-redis</artifactId>
</dependency>
```

> 构建好后，用第 6 节的 `helm test <release>` 或 `/runtime/config` 的 `storage.distributed` 字段确认 Redis 真的接上了。

## 3. application.yml（Starter 集成）

```yaml
spring:
  data:
    redis:
      host: ${REDIS_HOST:redis}
      port: ${REDIS_PORT:6379}
      password: ${REDIS_PASSWORD:}
      database: 0
      timeout: 2s
      lettuce:
        pool: { max-active: 16, max-idle: 8, min-idle: 2 }
ai-assistant:
  rate-limit-distributed: true   # 默认 true，显式写上更清楚
  rate-limit: 60                 # 跨副本每分钟总额
server:
  shutdown: graceful
```

## 4. 环境变量（独立服务 / compose）

```bash
SPRING_DATA_REDIS_HOST=redis
SPRING_DATA_REDIS_PORT=6379
SPRING_DATA_REDIS_PASSWORD=...
AI_ASSISTANT_RATE_LIMIT=60
AI_ASSISTANT_RATE_LIMIT_DISTRIBUTED=true
```

## 5. Helm values（多副本）

```yaml
replicaCount: 3                 # 或 autoscaling.enabled: true
image:
  repository: <你自建的含-redis镜像>   # 不能用不含 redis 依赖的官方镜像
  tag: <版本>
redis:
  enabled: true                 # 注入 SPRING_DATA_REDIS_HOST/PORT
  host: redis-master
  port: 6379
env:
  AI_ASSISTANT_ALLOWED_ORIGINS: https://app.example.com
  AI_ASSISTANT_RATE_LIMIT: "60"
  AI_ASSISTANT_RATE_LIMIT_DISTRIBUTED: "true"
secrets:
  apiKey: <provider key>
  accessToken: <接口鉴权 token>
autoscaling:
  enabled: true
  minReplicas: 3
  maxReplicas: 8
```

Redis 密码建议走 Secret，不要写进 values 明文。

## 6. 上线前核对清单

1. **启动日志**：`kubectl logs` 搜 `multi-replica`。理想状态是 `TOKEN_USAGE / SESSION / CONVERSATION_MEMORY` 三条告警都消失（只剩 `VECTOR_STORE`，且仅在启用 RAG 时才需处理）。
2. **存储后端自检**：调 `/runtime/config`，确认 `storage.distributed` 为 `true`：

```bash
curl -s -H "X-AI-Token: $TOKEN" \
  http://<host>/ai-assistant/runtime/config | grep '"distributed":true'
```

3. **redis-cli 看到 key**（打几个请求后）：

```bash
redis-cli --scan --pattern 'ai-rl:*'         # 限流 ZSET
redis-cli --scan --pattern 'ai-session:*'    # 会话
redis-cli --scan --pattern 'ai:memory:*'     # 记忆
redis-cli HGETALL 'ai-usage:quota'           # 配额
redis-cli HGETALL "ai-usage:u:<tenant>:$(date +%F)"
```

4. **跨副本验证**：副本 A `POST /sessions` 建会话 → 副本 B `GET /sessions` 能读到；连续超 `rate-limit` 的请求跨副本总量触发 429；同租户多副本总消耗不超过日配额。
5. **helm test**：`helm test <release>`，失败即说明镜像静默回退内存。

## 7. 故障演练（验证 fail-open）

```bash
# 1) 停 Redis
kubectl scale deploy redis-master --replicas=0   # 或 docker stop redis
# 2) 发 /chat：期望仍 200（不是 500）
curl -X POST .../ai-assistant/chat -H "X-AI-Token: $TOKEN" -d '{"text":"hi"}'
# 3) 日志出现节流 WARN：
#    "Redis rate limiter unavailable, failing open"
#    "Redis session store '...' failed, degrading gracefully"
#    "Redis conversation memory '...' failed, degrading gracefully"
# 4) 恢复 Redis
kubectl scale deploy redis-master --replicas=1
# 5) 再请求，redis-cli 重新看到 key 计数恢复
```

::: tip
Redis 宕机期间 fail-open 意味着限流/配额不再强制、会话/记忆读空、写不持久化。因此生产必须在 API 网关保留一道硬上限兜底。
:::

## 8. 回滚

- 应急回滚：`replicaCount: 1`（单副本下内存实现也一致）。
- 完全退出 Redis：`redis.enabled=false` 或换回不含 redis 依赖的镜像 → 回到每副本内存（多副本会变不一致，仅作应急）。
