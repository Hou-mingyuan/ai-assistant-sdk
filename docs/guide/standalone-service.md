# 独立服务 Docker 部署

除了作为 Spring Boot Starter 集成进业务后端，AI Assistant 也可以作为独立 HTTP 服务部署。这个形态适合多个前端或多个业务系统共用同一套模型配置、鉴权、限流和导出能力。

## 1. 一键启动

在仓库根目录复制环境变量模板：

```bash
copy .env.example .env
```

至少修改以下配置：

```env
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

如果不想本地构建，可以把 `docker-compose.yml` 中的镜像改为已发布镜像，并跳过 `build` 配置。

仓库已提供拉取 GHCR 镜像的一键启动文件：

```bash
docker compose -f docker-compose.ghcr.yml up -d
```

如果要指定镜像标签：

```env
AI_ASSISTANT_IMAGE_TAG=latest
```

## 3. Docker Hub 或代理网络

如果 Docker Hub 或 Maven Central 访问不稳定，可以在 `.env` 中配置构建代理。Docker Desktop 下容器访问宿主机代理通常使用 `host.docker.internal`：

```env
DOCKER_BUILD_HTTP_PROXY=http://host.docker.internal:7897
DOCKER_BUILD_HTTPS_PROXY=http://host.docker.internal:7897
DOCKER_BUILD_NO_PROXY=localhost,127.0.0.1,host.docker.internal
DOCKER_BUILD_MAVEN_OPTS=-Dhttp.proxyHost=host.docker.internal -Dhttp.proxyPort=7897 -Dhttps.proxyHost=host.docker.internal -Dhttps.proxyPort=7897
```

## 4. 前端如何连接独立服务

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

```env
AI_ASSISTANT_ALLOWED_ORIGINS=https://your-frontend.example.com
```

生产环境不要使用 `*`。

## 5. 鉴权

独立服务使用 `AI_ASSISTANT_ACCESS_TOKEN` 保护业务接口。客户端需要传入：

```http
X-AI-Token: change-me
```

推荐配置：

```env
AI_ASSISTANT_ACCESS_TOKEN=change-me
AI_ASSISTANT_ALLOW_QUERY_TOKEN_AUTH=false
```

不要在生产环境开启 query token 鉴权，避免 token 出现在浏览器历史、网关日志或 Referer 中。

服务启动时会检查常见高风险配置组合。如果 `AI_ASSISTANT_ALLOWED_ORIGINS=*` 且没有配置 `AI_ASSISTANT_ACCESS_TOKEN`，日志会输出风险提示。生产环境建议同时使用明确 CORS 白名单和 `X-AI-Token` 鉴权。

## 6. 限流

默认每个客户端每分钟 60 次请求：

```env
AI_ASSISTANT_RATE_LIMIT=60
```

设置为 `0` 可以关闭进程内限流：

```env
AI_ASSISTANT_RATE_LIMIT=0
```

单容器部署时进程内限流足够简单可靠；多副本部署时建议接入网关限流，或者在 Starter 集成形态里使用 Redis 分布式限流。

## 7. 日志

服务日志输出到标准输出，由 Docker 或平台侧收集。compose 默认启用日志滚动：

```env
AI_ASSISTANT_LOG_MAX_SIZE=10m
AI_ASSISTANT_LOG_MAX_FILE=3
```

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

默认只暴露 `health,info`：

```env
MANAGEMENT_ENDPOINTS_WEB_EXPOSURE_INCLUDE=health,info
```

如果需要暴露 metrics，建议先通过内网或网关保护：

```env
MANAGEMENT_ENDPOINTS_WEB_EXPOSURE_INCLUDE=health,info,metrics
```

## 9. 常用运行参数

```env
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

仓库提供了一个不依赖额外 npm 包的烟测脚本，用于确认独立服务已启动、Actuator 正常、鉴权配置生效：

```bash
node scripts/smoke-standalone-service.mjs http://localhost:8080/ai-assistant change-me
```

如果未配置 `AI_ASSISTANT_ACCESS_TOKEN`，可以省略第二个参数：

```bash
node scripts/smoke-standalone-service.mjs http://localhost:8080/ai-assistant
```

脚本只检查轻量接口，不会调用真实模型接口。
