# 生产上线检查清单

上线前建议逐项确认。这个清单适用于独立服务 Docker / Compose 部署，也可作为 Kubernetes 部署前的基础检查。

## 镜像和版本

- [ ] 使用固定镜像标签，不要在生产发布脚本里依赖浮动的 `latest`。
- [ ] Release 后确认 GHCR 镜像烟测通过。
- [ ] 如果同步 Docker Hub，确认已配置 `DOCKERHUB_USERNAME`、`DOCKERHUB_TOKEN` 和可选的 `DOCKERHUB_REPOSITORY`。
- [ ] 记录当前部署的镜像名、标签和 Git commit。

## 必填环境变量

- [ ] `AI_ASSISTANT_API_KEY` 已配置。
- [ ] `AI_ASSISTANT_PROVIDER` 与目标模型供应商一致。
- [ ] `AI_ASSISTANT_BASE_URL` 在使用代理网关或兼容 API 时已配置。
- [ ] `AI_ASSISTANT_MODEL` 已显式确认，或接受 provider 默认模型。
- [ ] `AI_ASSISTANT_CONTEXT_PATH` 和前端 `baseUrl` 一致。

## 鉴权和跨域

- [ ] `AI_ASSISTANT_ACCESS_TOKEN` 已配置，且不是示例值。
- [ ] 前端通过 `X-AI-Token` 传递访问 Token。
- [ ] `AI_ASSISTANT_ALLOW_QUERY_TOKEN_AUTH=false`。
- [ ] `AI_ASSISTANT_ALLOWED_ORIGINS` 使用明确域名，不使用 `*`。
- [ ] 管理端、连接器管理和 MCP Server 未暴露，除非已有额外鉴权保护。

## 限流和资源

- [ ] `AI_ASSISTANT_RATE_LIMIT` 已按业务流量设置。
- [ ] `AI_ASSISTANT_TIMEOUT_SECONDS` 能覆盖模型响应时间，但不会无限等待。
- [ ] `AI_ASSISTANT_CHAT_MAX_TOTAL_CHARS` 和 `AI_ASSISTANT_CHAT_HISTORY_MAX_CHARS` 保持默认或有明确上限。
- [ ] `AI_ASSISTANT_MULTIPART_MAX_FILE_SIZE` 和 `AI_ASSISTANT_MULTIPART_MAX_REQUEST_SIZE` 已按上传场景设置。
- [ ] Compose 或平台层已设置内存、CPU 和日志滚动限制。

## 网络和反向代理

- [ ] 反向代理公开路径和 `AI_ASSISTANT_CONTEXT_PATH` 一致。
- [ ] SSE 流式接口关闭了代理缓冲。
- [ ] 只公开 `/actuator/health` 和 `/actuator/info`，不要开放全部 Actuator 端点。
- [ ] TLS、域名和前端 `baseUrl` 使用最终用户可访问地址。
- [ ] 如果模型 API 需要代理，已确认容器内网络能访问代理或模型网关。

## 日志和可观测性

- [ ] 生产环境设置 `SPRING_PROFILES_ACTIVE=prod` 或 `json`，启用结构化日志。
- [ ] 日志采集平台能按 `requestId`、`traceId`、`tenantId` 检索。
- [ ] `MANAGEMENT_ENDPOINTS_WEB_EXPOSURE_INCLUDE=health,info`，除非 metrics 已由内网或网关保护。
- [ ] 告警系统覆盖容器重启、健康检查失败、上游模型错误率和 429。

## 上线前验证

- [ ] `docker compose -f docker-compose.prod.yml config` 通过。
- [ ] 容器启动后执行烟测：

```bash
node scripts/smoke-standalone-service.mjs https://assistant.example.com/ai-assistant your-token
```

- [ ] 前端页面能完成一次普通对话或摘要请求。
- [ ] 反向代理下 SSE 流式输出是实时的。
- [ ] 401、429、CORS 错误路径都有明确排查办法。

## 回滚准备

- [ ] 上一个可用镜像标签仍可拉取。
- [ ] `.env` 或平台 Secret 有备份。
- [ ] 反向代理配置有回滚版本。
- [ ] 发布后观察窗口内有人值守日志和健康检查。
