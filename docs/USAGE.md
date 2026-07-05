# 5 分钟接入手册

> 目标：在现有 **Java + Vue** 项目中接入 AI Assistant SDK，跑通「悬浮球 → 提问 → 流式回答」最小链路。
> 当前版本见仓库根目录 `VERSION`。

---

## 开始前（30 秒）

| 项 | 要求 |
| --- | --- |
| 后端 | Java 17+，Spring Boot 3.x |
| 前端 | Vue 3 + Vite（或兼容的 Vue 3 构建链） |
| 模型 | 任一已支持的供应商 API Key（如 DeepSeek / OpenAI / 通义千问） |
| 接入形态 | **Starter 集成**（下文默认）或 [独立服务部署](guide/standalone-service.md) |

> 若业务后端无法引入 Starter，请改走 [独立服务](guide/standalone-service.md) + [前端连接独立服务](guide/frontend-standalone.md)，本手册以 Starter 路径为主。

---

## 第 1 步：后端依赖（1 分钟）

在业务 Spring Boot 项目的 `pom.xml` 中加入：

```xml
<dependency>
  <groupId>com.aiassistant</groupId>
  <artifactId>ai-assistant-spring-boot-starter</artifactId>
  <version>1.0.1</version>
</dependency>
```

在 `application.yml`（或环境变量）中配置：

```yaml
ai-assistant:
  provider: deepseek          # openai / deepseek / qwen / glm / ollama 等
  api-key: sk-your-api-key    # 勿提交到 Git
  context-path: /ai-assistant
  access-token: change-me     # 生产环境务必修改
```

启动应用后，以下端点自动可用：

| 端点 | 说明 |
| --- | --- |
| `GET /ai-assistant/health` | 健康检查 |
| `POST /ai-assistant/chat` | 同步对话 |
| `POST /ai-assistant/stream` | SSE 流式（官方 UI 默认） |

---

## 第 2 步：前端组件（2 分钟）

在 Vue 3 项目中安装并注册：

```bash
npm install @ai-assistant/vue
```

```ts
// main.ts
import { createApp } from 'vue'
import App from './App.vue'
import AiAssistant from '@ai-assistant/vue'
import '@ai-assistant/vue/dist/style.css'

createApp(App)
  .use(AiAssistant, {
    baseUrl: '/ai-assistant',
    accessToken: 'change-me',   // 与后端 ai-assistant.access-token 一致
    locale: 'zh',
    theme: 'auto',
  })
  .mount('#app')
```

在根组件或任意页面放置挂件：

```vue
<template>
  <AiAssistant />
</template>
```

**零侵入替代**：不想改模板时，可设 `autoMountToBody: true`，由插件自动挂载悬浮球（此时不要再写 `<AiAssistant />`）。

---

## 第 3 步：验证（1 分钟）

1. 打开前端页面，点击右下角悬浮球。
2. 输入任意问题，确认出现 **流式打字机** 效果。
3. 浏览器 Network 面板应看到 `POST /ai-assistant/stream` 返回 `text/event-stream`。
4. 命令行快速探活：

```bash
curl http://localhost:8080/ai-assistant/health
```

期望返回 `200` 且 body 含健康状态字段。

---

## 生产最小基线（可选，+1 分钟）

```yaml
ai-assistant:
  allowed-origins: https://your-frontend.com
  rate-limit: 60
  pii-masking-enabled: true
  url-fetch-ssrf-protection: true
```

前端 `accessToken` 不要硬编码在源码中，建议由网关或运行时注入。

---

## 常见问题速查

| 现象 | 处理 |
| --- | --- |
| 启动报 `api-key must be configured` | 补全 `ai-assistant.api-key` 或对应环境变量 |
| 前端 401 | 检查 `accessToken` 与后端 `access-token` 是否一致 |
| 跨域错误 | 配置 `allowed-origins` 为前端域名 |
| 流式无输出 | 确认 `baseUrl` 指向正确，且网关未缓冲 SSE |

完整排障见 [troubleshooting.md](guide/troubleshooting.md)。

---

## 下一步

| 目标 | 文档 |
| --- | --- |
| 全部配置项 | [configuration.md](guide/configuration.md) |
| 独立 Docker 服务 | [standalone-service.md](guide/standalone-service.md) |
| 前端高级配方 | [frontend-recipes.md](guide/frontend-recipes.md) |
| API 契约 | [api/index.md](api/index.md) |
| 上线前检查 | [production-checklist.md](guide/production-checklist.md) |
