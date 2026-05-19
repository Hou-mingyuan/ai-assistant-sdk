# 多实例部署配置 Lint

当独立服务以多副本（Helm `replicaCount > 1` / `docker compose up -d --scale ai-assistant=N`）部署时，进程内状态会出现一致性问题。仓库提供轻量 lint 脚本扫 `.env` / `docker-compose*.yml` / `helm/values.yaml`，对已知风险给出 warn 或 high 级别 finding。

## 检测的高风险组合

| 规则 ID | 触发条件 | 严重度 | 建议 |
|---------|----------|--------|------|
| `in-process-rate-limit` | `AI_ASSISTANT_RATE_LIMIT > 0` 且未配 Redis，且 replicas > 1 | **high** | 改在 API 网关限流，或在 Starter 宿主中提供 `StringRedisTemplate` 让 `RedisRateLimitFilter` 接管 |
| `in-memory-session-store` | 未声明 `AI_ASSISTANT_SESSION_STORE` 且 replicas > 1 | **high** | 切到 `AI_ASSISTANT_SESSION_STORE=redis` |
| `in-memory-rag-store` | `AI_ASSISTANT_RAG_ENABLED=true` 且 vector store 为内存，replicas > 1 | **high** | 换 Milvus / Pinecone / Qdrant |
| `detected-multi-replica` | YAML 中 `replicas: N` (N>1) | info | 提醒检查 .env 状态 |

## 用法

```bash
# 仅警告，不阻塞
node scripts/multi-replica-config-lint.mjs

# 高严重度 finding 阻塞 CI (exit 1)
node scripts/multi-replica-config-lint.mjs --strict

# 指定单个文件
node scripts/multi-replica-config-lint.mjs --file path/to/.env

# 显式声明副本数（绕过 YAML 自动检测）
node scripts/multi-replica-config-lint.mjs --replicas 3 --strict
```

## CI 集成

集成到 `project-health-check.mjs`：

```bash
node scripts/project-health-check.mjs --multi-replica          # 仅警告
node scripts/project-health-check.mjs --multi-replica --strict # CI 阻塞
node scripts/project-health-check.mjs --all                    # 跑所有 lane
```

在 `.github/workflows/ci.yml` 的 frontend job 末尾追加一步即可：

```yaml
- name: Multi-replica config lint
  run: node scripts/multi-replica-config-lint.mjs --strict
```

注意：本仓库默认的 `.env.example` 故意保留单实例配置作为起点；lint 默认对单文件不报 high（除非 yaml 检测出 `replicas > 1` 或显式 `--replicas`）。

## 例：触发与解决

`.env`：

```text
AI_ASSISTANT_RATE_LIMIT=60
AI_ASSISTANT_RAG_ENABLED=true
```

`helm/values.yaml`：

```yaml
replicaCount: 3
```

跑 lint：

```text
[HIGH] .env — in-process-rate-limit
  AI_ASSISTANT_RATE_LIMIT=60 是进程内限流，多实例部署时各副本各算各的；
  生产请改在 API 网关或 Redis (RedisRateLimitFilter) 上做配额

[HIGH] .env — in-memory-session-store
  session store 未声明，默认 InMemorySessionStore；多实例部署会话粘连不稳定，
  请配 AI_ASSISTANT_SESSION_STORE=redis 并提供 redis URL

[HIGH] .env — in-memory-rag-store
  RAG 已开启但 vector store 是 InMemoryVectorStore；多实例间检索结果不一致，
  生产应换成 Milvus / Pinecone / Qdrant

Found 3 finding(s); high-severity: 3
```

修复后 `.env`（示例，用于表达多副本必须接入共享状态；实际连接参数以宿主 Spring Boot / 平台配置为准）：

```text
AI_ASSISTANT_SESSION_STORE=redis
SPRING_DATA_REDIS_HOST=redis
SPRING_DATA_REDIS_PORT=6379
AI_ASSISTANT_RATE_LIMIT_DISTRIBUTED=true
AI_ASSISTANT_RAG_VECTOR_STORE=milvus
```

对于独立服务镜像，如果没有把 Redis 客户端依赖和连接配置一起纳入运行环境，优先把限流前移到 API 网关；不要仅靠写一个 `AI_ASSISTANT_*` 环境变量假设进程内限流已经变成分布式限流。

再跑：

```text
multi-replica-config-lint: no issues found
```

## 局限

- 不检测真实运行中的 redis / milvus 是否能连通；只看配置项。
- 仅识别 `AI_ASSISTANT_*` 前缀的环境变量；自定义命名不在覆盖范围。
- YAML 检测 `replicas: N` 的简单正则；未来如换 HPA 动态副本，应改用 K8s API 实际查询。
