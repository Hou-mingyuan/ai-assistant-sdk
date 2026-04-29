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

如果构建卡在 `docker.io/library/maven` 或 `docker.io/library/eclipse-temurin` 的 metadata/token 拉取阶段，说明当前网络访问 Docker Hub 不稳定。可以先配置 Docker 镜像加速器，或提前拉取基础镜像：

```bash
docker pull maven:3.9.11-eclipse-temurin-17
docker pull eclipse-temurin:17-jre-alpine
```

默认接口：

```text
GET  http://localhost:8080/actuator/health
GET  http://localhost:8080/ai-assistant/health
POST http://localhost:8080/ai-assistant/chat
POST http://localhost:8080/ai-assistant/stream
POST http://localhost:8080/ai-assistant/export
```

生产环境建议至少设置：

```env
AI_ASSISTANT_ACCESS_TOKEN=change-me
AI_ASSISTANT_ALLOWED_ORIGINS=https://your-frontend.example.com
AI_ASSISTANT_RATE_LIMIT=60
```
