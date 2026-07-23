# 部署路径检查清单

AI Assistant SDK 有两种主要部署路径。开始前先选一种，再按对应清单执行。

- **Starter 集成**：已有 Spring Boot 业务后端，希望小助手接口和业务系统部署在同一个后端里。
- **独立服务部署**：不想改业务后端，或多个系统共用同一套 AI 能力，直接运行 `ai-assistant-service`。

不要在同一次接入里同时把两种路径混用。最常见的问题是：后端实际跑在独立服务里，但前端仍指向业务后端的 `/ai-assistant`；或者业务后端已经集成 Starter，却又启动了另一个独立服务，导致 Token、CORS、会话和模型配置不一致。

## 路径一：Starter 集成检查清单

适用场景：

- 业务后端本来就是 Spring Boot 3.x。
- 希望复用业务系统已有的登录态、租户、审计、数据库或网关。
- AI 助手只服务于当前业务系统，不需要独立扩容成共享平台。

上线前确认：

- [ ] 宿主后端已引入 `ai-assistant-spring-boot-starter`。
- [ ] 宿主后端已配置 `ai-assistant.api-key`、`ai-assistant.provider` 和必要的 `ai-assistant.model`。
- [ ] 如果使用模型代理或自部署模型，已配置 `ai-assistant.base-url`。
- [ ] 宿主后端暴露的 `ai-assistant.context-path` 与前端 `baseUrl` 一致，默认都是 `/ai-assistant`。
- [ ] 如需前端跨域访问，`ai-assistant.allowed-origins` 包含真实前端域名。
- [ ] 生产环境已配置 `ai-assistant.access-token`，前端通过 `accessToken` 传入同一个值。
- [ ] `ai-assistant.allow-query-token-auth=false`。
- [ ] 如需启用 Admin 或运行时模型配置，已配置独立 `ai-assistant.admin-token`；需要持久化运行时 API key 时已配置 `ai-assistant.runtime-config-secret-key`。
- [ ] 生产如需统一助手角色，已设置 `ai-assistant.allow-client-system-prompt=false`，并在前端关闭 `showSystemPromptEditor`。
- [ ] 如果启用链接抓取，保持 `ai-assistant.url-fetch-ssrf-protection=true`。
- [ ] 如果启用 Admin、MCP Server、连接器管理或 RAG，已确认对应接口只对可信调用方开放。
- [ ] 宿主系统已有统一限流时，确认与 `ai-assistant.rate-limit` 不会重复导致误伤；多实例限流优先放到网关或 Redis。
- [ ] 已运行宿主后端的最小相关测试，或至少访问 `GET /ai-assistant/health` 通过。

前端最小配置：

```ts
app.use(AiAssistant, {
  baseUrl: '/ai-assistant',
  accessToken: 'same-token-as-backend',
  locale: 'zh',
})
```

排查重点：

- 访问 `/ai-assistant/health` 返回 404：检查 Starter 是否被自动装配、`api-key` 是否为空、`context-path` 是否被改过。
- 请求返回 401：检查前端 `accessToken` 是否与后端 `ai-assistant.access-token` 一致。
- 浏览器跨域失败：检查 `allowed-origins` 是否包含当前前端域名。

## 路径二：独立服务部署检查清单

适用场景：

- 不想改业务后端。
- 多个前端或多个业务系统共用同一套 AI 能力。
- 希望单独扩容、升级、审计或替换模型网关。

上线前确认：

- [ ] 已从 `.env.example` 复制出 `.env`，并配置真实值。
- [ ] `AI_ASSISTANT_API_KEY`、`AI_ASSISTANT_PROVIDER` 和必要的 `AI_ASSISTANT_MODEL` 已配置。
- [ ] 如果使用模型代理或自部署模型，已配置 `AI_ASSISTANT_BASE_URL`。
- [ ] `AI_ASSISTANT_CONTEXT_PATH` 与前端 `baseUrl`、反向代理路径和健康检查路径一致，默认是 `/ai-assistant`。
- [ ] `AI_ASSISTANT_ACCESS_TOKEN` 已配置，且不是示例值。
- [ ] `AI_ASSISTANT_ALLOWED_ORIGINS` 使用明确前端域名，生产环境不使用 `*`。
- [ ] `AI_ASSISTANT_ALLOW_QUERY_TOKEN_AUTH=false`。
- [ ] 如果使用 Helm 部署，已通过 `secrets.apiKey` 和 `secrets.accessToken` 注入模型 Key 与访问 Token，未把长期密钥写入普通 `env` 配置。
- [ ] 如需启用 Admin 或运行时模型配置，已配置独立 `AI_ASSISTANT_ADMIN_TOKEN`；需要持久化运行时 API key 时已配置 `AI_ASSISTANT_RUNTIME_CONFIG_SECRET_KEY`。
- [ ] 如需统一助手角色，`AI_ASSISTANT_ALLOW_CLIENT_SYSTEM_PROMPT=false`，前端设置 `showSystemPromptEditor: false`。
- [ ] `AI_ASSISTANT_RATE_LIMIT` 已按业务流量设置。
- [ ] Compose、Kubernetes 或平台层已设置 CPU、内存和日志滚动限制。
- [ ] 反向代理已为 SSE 流式接口关闭缓冲。
- [ ] Actuator 只暴露必要端点，默认建议 `health,info`。
- [ ] 已执行独立服务烟测脚本，且不会触发真实模型调用。

本地启动：

```bash
copy .env.example .env
docker compose up -d --build
node scripts/smoke-standalone-service.mjs http://localhost:8080/ai-assistant change-me
```

前端最小配置：

```ts
app.use(AiAssistant, {
  baseUrl: 'http://localhost:8080/ai-assistant',
  accessToken: 'change-me',
  locale: 'zh',
})
```

生产更推荐把独立服务挂到同源子路径，再让前端使用相对路径：

```ts
app.use(AiAssistant, {
  baseUrl: '/ai-assistant',
  accessToken: shortLivedToken,
})
```

排查重点：

- 健康检查通过但前端 404：检查浏览器访问的 `baseUrl` 是否是最终公开路径，而不是容器内地址。
- 请求返回 401：检查前端 `accessToken` 是否与 `AI_ASSISTANT_ACCESS_TOKEN` 一致。
- 跨域失败：检查 `AI_ASSISTANT_ALLOWED_ORIGINS` 是否包含浏览器地址栏里的完整源。
- 流式输出不实时：检查 Nginx、Caddy、Ingress 或 API Gateway 是否关闭了响应缓冲。

## 选择建议

| 条件 | 更适合 |
| --- | --- |
| 已有 Spring Boot 后端，AI 能力只服务当前系统 | Starter 集成 |
| 需要复用业务权限、租户、审计和数据库上下文 | Starter 集成 |
| 不想修改业务后端 | 独立服务部署 |
| 多个系统共用同一套模型配置和 AI 能力 | 独立服务部署 |
| 希望 AI 服务独立扩容、独立升级 | 独立服务部署 |

如果仍不确定，先用独立服务跑通最小链路；确认需要深度复用业务上下文后，再切换到 Starter 集成。

## 多副本部署专题

无论选择哪种路径，只要把 SDK 部署成多个副本（Kubernetes Deployment、StatefulSet、负载均衡后挂多个 Pod 等），下面这些"默认进程内"的能力都会在每个副本上独立计数，导致总体表现不一致：

| 能力 | 默认实现 | 多副本表现 | 建议 |
| --- | --- | --- | --- |
| 限流 | `RateLimitFilter`（进程内 Bucket） | 每副本独立计数，总配额 = 副本数 × 单副本配额 | 注册 `RedisRateLimitFilter` Bean，或把限流前移到 API 网关 |
| 会话存储 | `InMemorySessionStore` | 同一会话被路由到不同副本时丢失上下文 | 切换为 `RedisSessionStore` 或自定义 `SessionStore` 实现 |
| 向量存储（RAG） | `InMemoryVectorStore` | 每副本各持一份索引，不共享 | 由宿主注入经过契约测试的共享 `VectorStore`；仓库不交付外部数据库适配器 |
| Token 用量 | `TokenUsageTracker`（进程内） | 每副本独立计数，配额超额检测可能不准 | 替换为基于 Redis / 数据库的实现 |
| 对话记忆 | `ConversationMemory`（进程内） | 同一会话被路由到不同副本时记忆不一致 | 实现 `ConversationMemoryProvider` 持久化 |

启动时，若服务检测到运行在 Kubernetes 中（`KUBERNETES_SERVICE_HOST` 存在）或 `HOSTNAME` 命中 K8s 命名规则，且 `ai-assistant.rate-limit` 大于 0，会在日志中输出 `MULTI_REPLICA_INPROCESS_RATE_LIMIT` 警告，提示需要切换到 Redis 限流或网关限流。请把该警告作为多副本环境的强制检查项。

要快速判断当前环境是否多副本：

```bash
# 入口副本数
kubectl get deployment ai-assistant-service -o jsonpath='{.spec.replicas}'

# 实际运行的 Pod 数
kubectl get pods -l app=ai-assistant-service --no-headers | wc -l
```

如果只能用单副本运行（小流量、内部工具），把 `ai-assistant.rate-limit` 调整到与单副本容量匹配的水平；启用 `RedisRateLimitFilter` 后再恢复到面向集群的配额。

多副本上线前建议把 lint 作为强制步骤：

```bash
node scripts/multi-replica-config-lint.mjs --replicas 2 --strict
```

如果使用 Starter 集成并希望 SDK 自动切到 Redis 限流与 Redis Session，需要宿主应用提供 `StringRedisTemplate`，并保持 `ai-assistant.rate-limit-distributed=true`（默认）。独立服务镜像若未接入 Redis 或网关限流，不建议把副本数提升到 2 以上。
