# 多实例部署配置 Lint

多副本部署时，默认的进程内限流、会话、Token 用量、记忆和 RAG 索引不会在副本间共享。`scripts/multi-replica-config-lint.mjs` 只做静态风险提示，不能证明 Redis、自定义 Bean 或外部存储真实可用。

## 检测规则

| 规则 | 触发条件 | 多副本严重度 | 处理方式 |
| --- | --- | --- | --- |
| `in-process-rate-limit` | 限流开启，但未同时看到 Redis 连接配置和分布式限流开关 | `high` | 在网关限流，或让运行时包含 Spring Data Redis 并确认 `RedisRateLimitFilter` 接管。 |
| `in-memory-session-store` | 未看到 `SPRING_DATA_REDIS_HOST` / `SPRING_DATA_REDIS_URL` | `high` | 配置 Redis 依赖与连接，并从启动状态确认 `RedisSessionStore` 接管。 |
| `in-memory-rag-store` | 多副本且 `AI_ASSISTANT_RAG_ENABLED=true` | `high` | 宿主实现并注入共享 `VectorStore`，再执行持久化、租户和维度契约测试。仓库不交付外部向量库适配器。 |
| `detected-multi-replica` | YAML 出现 `replicas` 或 `replicaCount > 1` | `info` | 提醒继续核验用量、记忆和其它共享状态。 |

脚本会先汇总所有被检查 YAML 的副本数，再检查 `.env`，避免 Helm 已设置多副本但环境文件只得到普通警告。

## 用法

```bash
# 当前仓库配置；只打印风险
node scripts/multi-replica-config-lint.mjs

# high finding 非零退出
node scripts/multi-replica-config-lint.mjs --strict

# 明确按 3 副本检查
node scripts/multi-replica-config-lint.mjs --replicas 3 --strict

# 检查单个环境文件；建议同时传实际副本数
node scripts/multi-replica-config-lint.mjs --file path/to/.env --replicas 3 --strict
```

## Redis 接线边界

以下环境变量只提供连接和行为配置，运行产物仍必须包含 Spring Data Redis 依赖：

```dotenv
SPRING_DATA_REDIS_HOST=redis
SPRING_DATA_REDIS_PORT=6379
AI_ASSISTANT_RATE_LIMIT_DISTRIBUTED=true
```

独立服务可用 Maven `redis` profile 构建 Redis 运行时；Starter 宿主可自行引入 `spring-boot-starter-data-redis`。启动后应确认实际 Bean 类型，而不是仅因环境变量存在就认为已经分布式化。

## RAG 边界

仓库当前只有 `InMemoryVectorStore`。不存在可通过 `AI_ASSISTANT_RAG_VECTOR_STORE=milvus` 一类变量自动启用的实现。多副本 RAG 必须由宿主提供共享 `VectorStore` Bean；在完成前应保持 RAG 关闭或保持单副本。

## 局限

- 静态 lint 不连接 Redis，也不实例化 Spring Bean。
- 它不能识别网关限流、自定义依赖或宿主代码里的共享存储实现。
- 通过 lint 不等于多副本验收通过；还需故障、切流和跨副本会话测试。
