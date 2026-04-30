# 排障手册

这份手册面向独立服务、前端联调和生产部署。建议先从本地烟测开始，确认服务本身正常，再排查前端或代理层。

## 1. 先跑烟测

服务启动后执行：

```bash
node scripts/smoke-standalone-service.mjs http://localhost:8080/ai-assistant change-me
```

如果没有配置 `AI_ASSISTANT_ACCESS_TOKEN`：

```bash
node scripts/smoke-standalone-service.mjs http://localhost:8080/ai-assistant
```

烟测只访问轻量健康检查、Actuator liveness、`/stats` 和运行时配置摘要，不会调用真实模型。

如果需要确认当前服务启用了哪些功能和限制，可以访问不含密钥的运行时配置摘要：

```text
GET /ai-assistant/runtime/config
```

## 2. Docker 镜像拉取不稳定

现象：

- `docker pull` 卡在 `docker.io/library/maven`
- `docker build` 卡在 `eclipse-temurin`
- Docker Hub token 或 metadata 请求超时

处理：

```bash
docker pull maven:3.9.11-eclipse-temurin-17
docker pull eclipse-temurin:17-jre-alpine
```

如果本机走代理，Docker Desktop 容器访问宿主机代理通常用 `host.docker.internal`：

```text
DOCKER_BUILD_HTTP_PROXY=http://host.docker.internal:7897
DOCKER_BUILD_HTTPS_PROXY=http://host.docker.internal:7897
DOCKER_BUILD_NO_PROXY=localhost,127.0.0.1,host.docker.internal
DOCKER_BUILD_MAVEN_OPTS=-Dhttp.proxyHost=host.docker.internal -Dhttp.proxyPort=7897 -Dhttps.proxyHost=host.docker.internal -Dhttps.proxyPort=7897
```

## 3. 服务启动后健康检查 404

检查当前上下文路径：

```text
AI_ASSISTANT_CONTEXT_PATH=/ai-assistant
```

默认健康检查路径是：

```text
GET http://localhost:8080/ai-assistant/health
GET http://localhost:8080/actuator/health
```

如果改成 `/assistant`，路径也要同步改成：

```text
GET http://localhost:8080/assistant/health
```

前端 `baseUrl`、Docker healthcheck、反向代理路径也要保持一致。

## 4. 前端返回 401 Unauthorized

服务端配置了：

```text
AI_ASSISTANT_ACCESS_TOKEN=change-me
```

前端必须传入同样的 token：

```ts
app.use(AiAssistant, {
  baseUrl: 'http://localhost:8080/ai-assistant',
  accessToken: 'change-me',
})
```

最终浏览器请求会带：

```http
X-AI-Token: change-me
```

生产环境不要开启 query token，避免 token 出现在浏览器历史、网关日志或 Referer 里。

## 5. 前端跨域失败

本地开发通常是：

```text
AI_ASSISTANT_ALLOWED_ORIGINS=http://localhost:5173
```

生产环境写真实域名：

```text
AI_ASSISTANT_ALLOWED_ORIGINS=https://your-frontend.example.com
```

不要在生产环境使用 `*`。如果 `AI_ASSISTANT_ALLOWED_ORIGINS=*` 且未配置访问 Token，服务启动日志会输出风险提示。

也可以在 Vite 开发环境使用代理：

```ts
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const proxyTarget = env.VITE_AI_ASSISTANT_PROXY_TARGET || 'http://localhost:8080'

  return {
    server: {
      proxy: {
        '/ai-assistant': {
          target: proxyTarget,
          changeOrigin: true,
        },
      },
    },
  }
})
```

此时前端 `baseUrl` 使用 `/ai-assistant`。

如果 `8080` 已被其它本地服务占用，启动小助手后端时可换到 `18080`，然后在 Playground 或宿主前端的 `.env` 中设置：

```text
VITE_AI_ASSISTANT_PROXY_TARGET=http://localhost:18080
```

## 6. 接口返回 429 Too Many Requests

默认独立服务限流：

```text
AI_ASSISTANT_RATE_LIMIT=60
```

临时关闭：

```text
AI_ASSISTANT_RATE_LIMIT=0
```

多副本部署时，进程内限流不能全局汇总，建议在网关层配置统一限流，或者在集成 Starter 形态里使用 Redis 分布式限流。

## 7. SSE 流式输出不实时

如果服务本身正常，但前端流式输出变成一次性返回，通常是反向代理缓冲导致。

Nginx 需要：

```nginx
proxy_buffering off;
proxy_cache off;
gzip off;
proxy_read_timeout 120s;
```

Caddy 示例需要：

```text
reverse_proxy 127.0.0.1:8080 {
    flush_interval -1
}
```

仓库内已有示例：

```text
deploy/nginx/ai-assistant.conf
deploy/caddy/Caddyfile
```

## 8. 日志怎么看

Docker Compose 查看：

```bash
docker compose logs -f ai-assistant
```

生产环境建议启用结构化日志：

```text
SPRING_PROFILES_ACTIVE=prod
```

JSON 日志会带 `requestId`、`traceId`、`tenantId` 等字段，便于在 ELK、Loki 或云日志平台检索。

## 9. Release 镜像发布失败

GHCR 是默认发布目标。Release 发布后，工作流会再拉取刚发布的 GHCR 镜像并执行烟测。

发布镜像还会生成 SBOM、provenance，并执行 Trivy 高危漏洞扫描。如果发布失败，
先区分失败阶段：

- 构建失败：检查 Dockerfile、Maven 依赖下载和构建代理。
- 推送失败：检查 `GITHUB_TOKEN` 权限、包权限或 Docker Hub 凭据。
- 烟测失败：拉取同一个镜像标签，在本地运行
  `scripts/smoke-standalone-service.mjs` 复现。
- Trivy 扫描失败：优先升级基础镜像或受影响依赖；如果是不可修复且业务接受的风险，
  需要在变更记录里说明。

查看远程镜像 digest：

```bash
docker buildx imagetools inspect ghcr.io/hou-mingyuan/ai-assistant-service:<tag>
```

本地复扫镜像：

```bash
trivy image --vuln-type os,library --severity CRITICAL,HIGH ghcr.io/hou-mingyuan/ai-assistant-service:<tag>
```

如果要同步 Docker Hub，需要配置：

```text
secrets.DOCKERHUB_USERNAME
secrets.DOCKERHUB_TOKEN
vars.DOCKERHUB_REPOSITORY
```

如果 Docker Hub 没配置，不影响 GHCR 发布。

## 10. 生产 Compose 缺少变量

`docker-compose.prod.yml` 会强制要求：

```text
AI_ASSISTANT_API_KEY
AI_ASSISTANT_ACCESS_TOKEN
AI_ASSISTANT_ALLOWED_ORIGINS
```

如果缺少变量，`docker compose -f docker-compose.prod.yml config` 会直接失败。这是预期行为，用来避免生产环境裸奔。
