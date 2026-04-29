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
