# Kubernetes 部署

本项目提供 Helm 目录作为 Kubernetes 部署起点。生产部署前请结合你的集群网关、密钥管理、日志和监控体系调整。

## 部署前检查

- 已准备可用镜像。
- 已通过 Secret 注入 `AI_ASSISTANT_API_KEY`。
- 已通过 Secret 注入 `AI_ASSISTANT_ACCESS_TOKEN`。
- 已配置明确的 CORS 白名单，不在生产使用 `*`。
- 已确认服务只暴露必要端口。

## 推荐配置

```text
AI_ASSISTANT_ACCESS_TOKEN=change-me
AI_ASSISTANT_ALLOWED_ORIGINS=https://your-frontend.example.com
AI_ASSISTANT_RATE_LIMIT=60
SPRING_PROFILES_ACTIVE=prod
```

使用仓库内 Helm chart 时，生产敏感项应放在 `secrets` 区，或由 CI/CD、External Secrets、Sealed Secrets 等平台能力写入 Kubernetes Secret，不要写入普通 ConfigMap：

```bash
helm upgrade --install ai-assistant ./helm/ai-assistant \
  --set secrets.apiKey=sk-your-key \
  --set secrets.accessToken=your-client-token \
  --set env.AI_ASSISTANT_ALLOWED_ORIGINS=https://your-frontend.example.com
```

如果开启 Admin 或允许前端运行时修改模型配置，还应设置独立管理令牌，避免管理面回退到普通访问令牌：

```bash
helm upgrade --install ai-assistant ./helm/ai-assistant \
  --set secrets.adminToken=your-admin-token \
  --set env.AI_ASSISTANT_ADMIN_ENABLED=true
```

如果运行时模型 API key 需要重启后保留，还应设置高强度 `secrets.runtimeConfigSecretKey`；否则运行时 key 只应保存在内存中。

## 健康检查

建议使用：

```text
/actuator/health
```

如果修改了 `AI_ASSISTANT_CONTEXT_PATH`，请同步检查 Ingress、探针和前端 `baseUrl`。

## 生产注意事项

- API Key 和访问令牌应使用 Secret 管理，不要写入镜像或 ConfigMap 明文。
- `AI_ASSISTANT_ALLOWED_ORIGINS` 必须是浏览器实际访问的前端源，例如 `https://app.example.com`，不要把 `*` 带到生产。
- `AI_ASSISTANT_ALLOW_QUERY_TOKEN_AUTH` 保持 `false`，避免 token 出现在 URL、访问日志、浏览器历史或 Referer 中。
- `AI_ASSISTANT_RATE_LIMIT` 可作为单副本基础保护；多副本部署时，不要只依赖进程内限流。
- 需要全局限流时，优先放到 Ingress/API Gateway，或接入 Redis 让分布式限流接管。
- 多副本部署时，默认内存会话、对话记忆、Token 用量统计和 RAG 向量存储都不是全局一致的；需要跨副本一致性时，应接入 Redis、数据库或外部向量库。
- `redis.enabled=true` 只会注入 Redis 连接环境变量，仍需确保镜像运行时包含对应 Redis 客户端依赖，并确认 `AI_ASSISTANT_RATE_LIMIT_DISTRIBUTED=true`。
- Actuator 默认只暴露 `health,info`。如果要暴露 `metrics`，应放在内网、监控系统网络或网关鉴权之后；不要公开 `env`、`configprops`、`heapdump` 等敏感端点。
- 如果启用 Admin、连接器管理、MCP Server、Headless 抓取或 RAG 录入接口，应同时确认调用方鉴权、网络边界、审计日志和限流策略。

多副本上线前建议运行配置检查，并把结果作为发布门禁：

```bash
node scripts/multi-replica-config-lint.mjs --replicas 2 --strict
node scripts/project-health-check.mjs --prod-config --strict
```
