# 生产上线检查清单

上线前建议逐项确认。这个清单适用于独立服务 Docker / Compose 部署，也可作为 Kubernetes 部署前的基础检查。

## 镜像和版本

- [ ] 使用固定镜像标签，不要在生产发布脚本里依赖浮动的 `latest`。
- [ ] 记录镜像 digest，部署单或变更单里能追溯到具体不可变镜像。
- [ ] Release 后确认 GHCR 镜像烟测通过。
- [ ] Release 工作流里的 Trivy 扫描通过，或者已记录可接受的例外风险。
- [ ] 如需合规留痕，已保存或能重新查询镜像 SBOM 和 provenance。
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
- [ ] 代理、网关和应用日志都不会记录 `X-AI-Token`、模型 API Key 或上游 Authorization 头。
- [ ] 公开前端包里没有写死长期高权限 Token；如需前端直接传 Token，优先使用短期令牌。
- [ ] 如果前端和助手服务跨域部署，已确认 `allowed-origins` 中的协议、域名和端口与浏览器地址栏完全一致。
- [ ] 如果使用 Cookie、统一登录态或网关鉴权，已确认它不会绕过 `X-AI-Token` 或让未授权页面调用助手接口。

## 高风险功能开关

- [ ] `AI_ASSISTANT_URL_FETCH_SSRF_PROTECTION=true`，且没有为了调试内网链接而在生产关闭。
- [ ] 如果不需要链接正文抓取，已设置 `AI_ASSISTANT_URL_FETCH_ENABLED=false`。
- [ ] 如果启用链接抓取，已确认 `AI_ASSISTANT_URL_FETCH_MAX_BYTES`、`AI_ASSISTANT_URL_FETCH_TIMEOUT_SECONDS` 和 `AI_ASSISTANT_URL_FETCH_MAX_CHARS_INJECTED` 有明确上限。
- [ ] `AI_ASSISTANT_HEADLESS_FETCH_ENABLED=false`，除非确实需要抓取 JS 渲染页面，并且运行环境已隔离。
- [ ] `AI_ASSISTANT_ADMIN_ENABLED=false`，除非管理接口只在受保护网络或网关后开放。
- [ ] `AI_ASSISTANT_CONNECTOR_MANAGEMENT_ENABLED=false`，除非只有可信管理端可以动态注册或卸载连接器。
- [ ] `AI_ASSISTANT_MCP_SERVER_ENABLED=false`，除非 MCP 调用方身份、权限和网络边界都已确认。
- [ ] 如果启用 RAG，已确认知识库录入接口、命名空间、租户隔离和向量存储访问权限。

## 限流和资源

- [ ] `AI_ASSISTANT_RATE_LIMIT` 已按业务流量设置。
- [ ] 如果配置了分 action 限流，`chat`、`stream`、`export`、`file` 等重操作都有合理配额。
- [ ] 多副本部署时，不只依赖进程内限流；已在网关、Redis 或平台层做统一限流。
- [ ] `AI_ASSISTANT_TIMEOUT_SECONDS` 能覆盖模型响应时间，但不会无限等待。
- [ ] `AI_ASSISTANT_CHAT_MAX_TOTAL_CHARS` 和 `AI_ASSISTANT_CHAT_HISTORY_MAX_CHARS` 保持默认或有明确上限。
- [ ] `AI_ASSISTANT_MULTIPART_MAX_FILE_SIZE` 和 `AI_ASSISTANT_MULTIPART_MAX_REQUEST_SIZE` 已按上传场景设置。
- [ ] `AI_ASSISTANT_FILE_MAX_EXTRACTED_CHARS`、`AI_ASSISTANT_EXPORT_MAX_MESSAGES` 和 `AI_ASSISTANT_EXPORT_MAX_TOTAL_CHARS` 已按业务场景设置。
- [ ] 如果允许导出图片，`AI_ASSISTANT_EXPORT_MAX_IMAGE_BYTES` 和 `AI_ASSISTANT_EXPORT_MAX_IMAGE_URLS` 有明确上限。
- [ ] Compose 或平台层已设置内存、CPU 和日志滚动限制。

## 网络和反向代理

- [ ] 反向代理公开路径和 `AI_ASSISTANT_CONTEXT_PATH` 一致。
- [ ] SSE 流式接口关闭了代理缓冲。
- [ ] 前端生产环境优先使用同源 `/ai-assistant` 路径；如果跨域访问，CORS
      白名单只包含真实前端域名。
- [ ] 只公开 `/actuator/health` 和 `/actuator/info`，不要开放全部 Actuator 端点。
- [ ] TLS、域名和前端 `baseUrl` 使用最终用户可访问地址。
- [ ] 如果模型 API 需要代理，已确认容器内网络能访问代理或模型网关。

## 日志和可观测性

- [ ] 生产环境设置 `SPRING_PROFILES_ACTIVE=prod` 或 `json`，启用结构化日志。
- [ ] 日志采集平台能按 `requestId`、`traceId`、`tenantId` 检索。
- [ ] `MANAGEMENT_ENDPOINTS_WEB_EXPOSURE_INCLUDE=health,info`，除非 metrics 已由内网或网关保护。
- [ ] 如果开放 `metrics`，确认它只在内网、网关鉴权或监控系统网络内可访问。
- [ ] `/ai-assistant/runtime/config` 只输出不含密钥的摘要，但仍建议只在可信网络或鉴权后访问。
- [ ] 告警系统覆盖容器重启、健康检查失败、上游模型错误率和 429。
- [ ] 日志脱敏规则覆盖 `X-AI-Token`、模型 API Key、用户上传文件名和上游请求头。
- [ ] 已确认模型调用失败时日志只输出响应摘要，不输出完整 Prompt、上传文件正文或密钥。

## Actuator 和健康检查

- [ ] 对外只暴露必要健康检查路径，例如 `/actuator/health`、`/actuator/info` 和 `/ai-assistant/health`。
- [ ] Kubernetes 或容器平台的 liveness、readiness 路径与实际 `AI_ASSISTANT_CONTEXT_PATH` 一致。
- [ ] `/actuator/info` 中的镜像名、版本、修订号和构建时间可用于定位当前运行版本。
- [ ] 不把 `/actuator/env`、`/actuator/configprops`、`/actuator/heapdump` 等敏感端点暴露到公网。
- [ ] 如果平台统一接管健康检查，仍保留一个轻量业务健康接口用于排查助手上下文路径是否正确。

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
