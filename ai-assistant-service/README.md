# AI Assistant Service

`ai-assistant-service` 是独立部署启动器，复用 `ai-assistant-spring-boot-starter`，用于把小助手能力作为单独 HTTP 服务运行。

适用场景：

- 不想改已有业务后端，只想部署一个统一 AI 助手服务。
- 多个前端或业务系统共用同一套模型配置、鉴权和限流。
- 需要 Docker / docker compose 方式私有化部署。

## 本地打包

先安装 starter 到本地 Maven 仓库，再打包服务模块：

```bash
mvn -q -f ../ai-assistant-server/pom.xml \
  -DskipTests \
  -Dspotless.check.skip=true \
  -Dcheckstyle.skip=true \
  -Djacoco.skip=true \
  install

mvn -q -f pom.xml -DskipTests package
```

生成的可执行 jar：

```text
target/ai-assistant-service-1.0.0-SNAPSHOT.jar
```

## Docker 运行

在仓库根目录执行：

```bash
copy .env.example .env
# 编辑 .env，至少设置 AI_ASSISTANT_API_KEY
docker compose up -d --build
```

可以通过 `.env` 调整宿主机端口、模型请求参数、功能开关和资源限制。例如：

```env
AI_ASSISTANT_PORT=8080
SERVER_PORT=8080
AI_ASSISTANT_CONTEXT_PATH=/ai-assistant
AI_ASSISTANT_TIMEOUT_SECONDS=60
AI_ASSISTANT_MAX_TOKENS=2048
AI_ASSISTANT_LLM_MAX_RETRIES=2
AI_ASSISTANT_WEBSOCKET_ENABLED=false
AI_ASSISTANT_URL_FETCH_SSRF_PROTECTION=true
AI_ASSISTANT_EXPORT_MAX_MESSAGES=2000
AI_ASSISTANT_CHAT_HISTORY_MAX_CHARS=48000
```

如果构建卡在 `docker.io/library/maven` 或 `docker.io/library/eclipse-temurin` 的 metadata/token 拉取阶段，说明当前网络访问 Docker Hub 不稳定。可以先配置 Docker 镜像加速器，或提前拉取基础镜像：

```bash
docker pull maven:3.9.11-eclipse-temurin-17
docker pull eclipse-temurin:17-jre-alpine
```

如果基础镜像能拉取，但 Maven 依赖下载中断，可以把宿主机代理显式传入 Docker 构建。Docker Desktop 中容器访问宿主机代理时通常使用 `host.docker.internal`：

```bash
docker build ^
  --build-arg HTTP_PROXY=http://host.docker.internal:7897 ^
  --build-arg HTTPS_PROXY=http://host.docker.internal:7897 ^
  --build-arg http_proxy=http://host.docker.internal:7897 ^
  --build-arg https_proxy=http://host.docker.internal:7897 ^
  --build-arg MAVEN_OPTS="-Dhttp.proxyHost=host.docker.internal -Dhttp.proxyPort=7897 -Dhttps.proxyHost=host.docker.internal -Dhttps.proxyPort=7897" ^
  -t ai-assistant-service:local .
```

使用 docker compose 时，也可以直接在 `.env` 中加入：

```env
DOCKER_BUILD_HTTP_PROXY=http://host.docker.internal:7897
DOCKER_BUILD_HTTPS_PROXY=http://host.docker.internal:7897
DOCKER_BUILD_MAVEN_OPTS=-Dhttp.proxyHost=host.docker.internal -Dhttp.proxyPort=7897 -Dhttps.proxyHost=host.docker.internal -Dhttps.proxyPort=7897
```

默认接口：

```text
GET  http://localhost:8080/actuator/health
GET  http://localhost:8080/ai-assistant/health
POST http://localhost:8080/ai-assistant/chat
POST http://localhost:8080/ai-assistant/stream
POST http://localhost:8080/ai-assistant/export
```

如果修改了 `AI_ASSISTANT_CONTEXT_PATH`，业务接口和容器健康检查会一起切换到新的路径。

默认 compose 配置会以只读容器文件系统运行，并给 `/tmp` 挂载临时内存目录。服务日志输出到标准输出，不需要写入镜像内的应用目录。

容器默认启用 Spring Boot 优雅停机，并给 Docker 停止流程预留 30 秒窗口，适合滚动更新或手动重启：

```env
SERVER_SHUTDOWN=graceful
SPRING_LIFECYCLE_TIMEOUT_PER_SHUTDOWN_PHASE=20s
AI_ASSISTANT_STOP_GRACE_PERIOD=30s
```

compose 默认也提供资源和日志保护，避免异常请求或日志量过大拖垮宿主机：

```env
AI_ASSISTANT_MEMORY_LIMIT=768m
AI_ASSISTANT_CPUS=1.0
AI_ASSISTANT_LOG_MAX_SIZE=10m
AI_ASSISTANT_LOG_MAX_FILE=3
```

Actuator 默认只暴露 `health,info`。如果需要暴露 `metrics`，建议先通过网关或内网策略保护，再设置：

```env
MANAGEMENT_ENDPOINTS_WEB_EXPOSURE_INCLUDE=health,info,metrics
```

`/actuator/info` 会包含 Maven 构建信息和应用镜像名，便于确认当前容器版本。镜像也会写入 OCI 标签，可通过以下命令查看：

```bash
docker image inspect ai-assistant-service:local
```

生产环境建议至少设置：

```env
AI_ASSISTANT_ACCESS_TOKEN=change-me
AI_ASSISTANT_ALLOWED_ORIGINS=https://your-frontend.example.com
AI_ASSISTANT_RATE_LIMIT=60
```
