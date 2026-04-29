# 独立服务 Docker 部署

除了作为 Spring Boot Starter 集成进业务后端，AI Assistant 也可以作为独立 HTTP 服务部署。这个形态适合多个前端或多个业务系统共用同一套模型配置、鉴权、限流和导出能力。

如果部署或联调遇到问题，先参考：[排障手册](./troubleshooting)。
正式上线前建议按：[生产上线检查清单](./production-checklist) 逐项确认。
如果你还没有确定应该使用 Starter 集成还是独立服务部署，先看：[部署路径检查清单](./deployment-checklists)。

## 1. 一键启动

在仓库根目录复制环境变量模板：

```bash
copy .env.example .env
```

至少修改以下配置：

```text
AI_ASSISTANT_API_KEY=sk-your-key
AI_ASSISTANT_PROVIDER=openai
AI_ASSISTANT_ALLOWED_ORIGINS=http://localhost:5173
AI_ASSISTANT_ACCESS_TOKEN=change-me
```

启动服务：

```bash
docker compose up -d --build
```

默认服务地址：

```text
http://localhost:8080/ai-assistant
```

健康检查：

```bash
curl http://localhost:8080/ai-assistant/health
curl http://localhost:8080/actuator/health
```

本地烟测：

```bash
node scripts/smoke-standalone-service.mjs http://localhost:8080/ai-assistant change-me
```

## 2. 使用已发布镜像

发布 GitHub Release 后，镜像会推送到 GHCR：

```text
ghcr.io/hou-mingyuan/ai-assistant-service
```

如果仓库配置了 Docker Hub 凭据，Release 发布时也会同步推送 Docker Hub 镜像。需要配置：

```text
secrets.DOCKERHUB_USERNAME
secrets.DOCKERHUB_TOKEN
vars.DOCKERHUB_REPOSITORY   # 可选，默认 <DOCKERHUB_USERNAME>/ai-assistant-service
```

Release 发布流程会在 GHCR 推送完成后再次拉取刚发布的镜像，启动容器并执行 `scripts/smoke-standalone-service.mjs`。这个步骤用于确认远程镜像可以被实际拉取和启动，而不仅仅是构建成功。

发布镜像还会随工作流生成 SBOM 和 provenance，并在发布后执行 Trivy
高危漏洞扫描。建议生产部署记录镜像 digest，而不是只记录标签：

```bash
docker buildx imagetools inspect ghcr.io/hou-mingyuan/ai-assistant-service:<tag>
```

如果本地或上线流水线也安装了 Trivy，可以在部署前复扫一次：

```bash
trivy image --vuln-type os,library --severity CRITICAL,HIGH ghcr.io/hou-mingyuan/ai-assistant-service:<tag>
```

如果不想本地构建，可以把 `docker-compose.yml` 中的镜像改为已发布镜像，并跳过 `build` 配置。

仓库已提供拉取 GHCR 镜像的一键启动文件：

```bash
docker compose -f docker-compose.ghcr.yml up -d
```

生产环境推荐使用带必填项校验的 Compose 模板：

```bash
docker compose -f docker-compose.prod.yml up -d
```

这个模板会强制要求 `AI_ASSISTANT_API_KEY`、`AI_ASSISTANT_ACCESS_TOKEN` 和 `AI_ASSISTANT_ALLOWED_ORIGINS`，并默认启用 `SPRING_PROFILES_ACTIVE=prod` 结构化 JSON 日志。

如果要指定镜像标签：

```text
AI_ASSISTANT_IMAGE_TAG=latest
```

## 3. Docker Hub 或代理网络

如果 Docker Hub 或 Maven Central 访问不稳定，可以在 `.env` 中配置构建代理。Docker Desktop 下容器访问宿主机代理通常使用 `host.docker.internal`：

```text
DOCKER_BUILD_HTTP_PROXY=http://host.docker.internal:7897
DOCKER_BUILD_HTTPS_PROXY=http://host.docker.internal:7897
DOCKER_BUILD_NO_PROXY=localhost,127.0.0.1,host.docker.internal
DOCKER_BUILD_MAVEN_OPTS=-Dhttp.proxyHost=host.docker.internal -Dhttp.proxyPort=7897 -Dhttps.proxyHost=host.docker.internal -Dhttps.proxyPort=7897
```

## 4. 前端如何连接独立服务

完整前端联调说明见：[前端连接独立服务](./frontend-standalone)。

前端组件的 `baseUrl` 指向独立服务的上下文路径：

```ts
app.use(AiAssistant, {
  baseUrl: 'http://localhost:8080/ai-assistant',
  accessToken: 'change-me'
})
```

如果使用 Web Component 形态，属性同样指向独立服务：

```html
<ai-assistant
  base-url="http://localhost:8080/ai-assistant"
  access-token="change-me">
</ai-assistant>
```

如果前端和服务端不在同一个域名下，需要把前端地址加入 CORS 白名单：

```text
AI_ASSISTANT_ALLOWED_ORIGINS=https://your-frontend.example.com
```

生产环境不要使用 `*`。

## 5. 鉴权

独立服务使用 `AI_ASSISTANT_ACCESS_TOKEN` 保护业务接口。客户端需要传入：

```http
X-AI-Token: change-me
```

推荐配置：

```text
AI_ASSISTANT_ACCESS_TOKEN=change-me
AI_ASSISTANT_ALLOW_QUERY_TOKEN_AUTH=false
```

不要在生产环境开启 query token 鉴权，避免 token 出现在浏览器历史、网关日志或 Referer 中。

服务启动时会检查常见高风险配置组合。如果 `AI_ASSISTANT_ALLOWED_ORIGINS=*` 且没有配置 `AI_ASSISTANT_ACCESS_TOKEN`，日志会输出风险提示。生产环境建议同时使用明确 CORS 白名单和 `X-AI-Token` 鉴权。

## 6. 限流

默认每个客户端每分钟 60 次请求：

```text
AI_ASSISTANT_RATE_LIMIT=60
```

设置为 `0` 可以关闭进程内限流：

```text
AI_ASSISTANT_RATE_LIMIT=0
```

单容器部署时进程内限流足够简单可靠；多副本部署时建议接入网关限流，或者在 Starter 集成形态里使用 Redis 分布式限流。

## 7. 日志

服务日志输出到标准输出，由 Docker 或平台侧收集。compose 默认启用日志滚动：

```text
AI_ASSISTANT_LOG_MAX_SIZE=10m
AI_ASSISTANT_LOG_MAX_FILE=3
```

默认日志为人类可读的单行文本。生产环境如果接入 ELK、Loki、Datadog 或云日志平台，可以启用结构化 JSON 日志：

```text
SPRING_PROFILES_ACTIVE=prod
```

也可以只启用日志 JSON profile：

```text
SPRING_PROFILES_ACTIVE=json
```

JSON 日志会包含 `service`、`requestId`、`traceId`、`spanId`、`tenantId` 和 `userId` 等字段，方便按请求链路检索。

容器默认只读文件系统运行，`/tmp` 使用临时目录；服务不依赖写入镜像内目录。

## 8. 健康检查和可观测性

轻量健康检查：

```text
GET /ai-assistant/health
```

Actuator 健康检查：

```text
GET /actuator/health
```

版本与构建信息：

```text
GET /actuator/info
```

不含密钥的运行时配置摘要：

```text
GET /ai-assistant/runtime/config
```

默认只暴露 `health,info`：

```text
MANAGEMENT_ENDPOINTS_WEB_EXPOSURE_INCLUDE=health,info
```

如果需要暴露 metrics，建议先通过内网或网关保护：

```text
MANAGEMENT_ENDPOINTS_WEB_EXPOSURE_INCLUDE=health,info,metrics
```

## 9. 常用运行参数

```text
AI_ASSISTANT_PORT=8080
SERVER_PORT=8080
AI_ASSISTANT_CONTEXT_PATH=/ai-assistant
AI_ASSISTANT_TIMEOUT_SECONDS=60
AI_ASSISTANT_MAX_TOKENS=2048
AI_ASSISTANT_LLM_MAX_RETRIES=2
AI_ASSISTANT_EXPORT_MAX_MESSAGES=2000
AI_ASSISTANT_CHAT_HISTORY_MAX_CHARS=48000
```

如果修改 `AI_ASSISTANT_CONTEXT_PATH`，前端 `baseUrl` 和健康检查路径都要使用新的路径。

## 10. 本地烟测脚本

仓库提供了一个不依赖额外 npm 包的烟测脚本，用于确认独立服务已启动、Actuator liveness 正常、鉴权配置和运行时配置摘要生效：

```bash
node scripts/smoke-standalone-service.mjs http://localhost:8080/ai-assistant change-me
```

如果未配置 `AI_ASSISTANT_ACCESS_TOKEN`，可以省略第二个参数：

```bash
node scripts/smoke-standalone-service.mjs http://localhost:8080/ai-assistant
```

脚本只检查轻量接口，不会调用真实模型接口。

## 11. 反向代理

生产环境通常会把独立服务放在 Nginx、Caddy、Ingress 或 API Gateway 后面。仓库提供了两个可复制的起点：

```text
deploy/nginx/ai-assistant.conf
deploy/caddy/Caddyfile
```

注意事项：

- 公开路径需要和 `AI_ASSISTANT_CONTEXT_PATH` 保持一致，默认是 `/ai-assistant`。
- SSE 流式接口需要关闭代理缓冲，否则前端可能收不到实时输出。
- 默认只建议暴露 `/actuator/health` 和 `/actuator/info`，不要直接开放全部 Actuator 端点。
- 如果代理层改了域名或协议，前端 `baseUrl` 要使用最终浏览器可访问的地址。

前端和独立服务部署在同一个域名下时，推荐把助手服务挂到同源子路径，例如：

```text
https://app.example.com/ai-assistant
```

这种方式下前端可以把 `baseUrl` 配成 `/ai-assistant`，浏览器不会触发跨域预检，
生产环境的 CORS 白名单也可以收敛到最终站点域名。
