# 介绍

AI Assistant SDK 是一个可嵌入的 AI 助手解决方案，包含：

- **后端**：Spring Boot Starter（Java 21+），提供对话、翻译、摘要、RAG、Tool Calling 等能力
- **前端**：Vue 3 组件库，开箱即用的对话界面
- **独立服务**：可通过 Docker / docker compose 单独部署，适合多个系统共用同一套 AI 能力

如果你选择独立服务形态，前端接入可参考：[前端连接独立服务](./frontend-standalone)。
部署或联调遇到问题时，可以直接查看：[排障手册](./troubleshooting)。
正式上线前建议按：[生产上线检查清单](./production-checklist) 逐项确认。

## 从哪里开始

先选择一种部署形态，再继续阅读对应文档。不要在同一次接入中同时把 Starter 集成和独立服务部署混在一起，否则容易出现接口地址、鉴权 Token、跨域和会话状态不一致的问题。

### 接入决策树

按下面的判断顺序走一遍，可以在 1 分钟内确定最适合自己的部署路径：

```text
[ 我要接入 AI Assistant ]
        │
        ▼
Q1: 已有 Spring Boot 业务后端？
        │
   ┌────┴────┐
   否        是
   │         │
   ▼         ▼
路径 B   Q2: 需要复用业务系统的登录态 / 租户 / 数据库？
独立      │
服务   ┌──┴──┐
部署   是    否
       │     │
       ▼     ▼
  路径 A   Q3: 多个系统将共用同一套 AI 能力？
  Starter   │
  集成   ┌──┴──┐
         是    否
         │     │
         ▼     ▼
        路径 B Q4: 希望 AI 服务独立扩容 / 升级？
                │
            ┌───┴───┐
            是      否
            │       │
            ▼       ▼
          路径 B  路径 A

之后无论哪条路径都走：
  上线前对照 [生产上线清单] + [部署路径检查清单]
        │
        ▼
  副本数 > 1？
        │
   ┌────┴────┐
   是        否
   │         │
   ▼         ▼
切到 Redis   完成接入
限流和会话
存储 / 网关
层限流
```

如果决策树指向 **路径 A（Starter 集成）**：

| 场景 | 下一步 |
| --- | --- |
| 第一次接入 | [快速开始](./quick-start) → [配置说明](./configuration) |
| 想了解模块边界 / 扩展点 | [后端架构维护说明](./backend-architecture) |
| 准备上线 | [部署路径检查清单](./deployment-checklists) → [生产上线清单](./production-checklist) |

如果决策树指向 **路径 B（独立服务部署）**：

| 场景 | 下一步 |
| --- | --- |
| 第一次接入 | [独立服务部署](./standalone-service) → [前端连接独立服务](./frontend-standalone) |
| 想配置 K8s | [Kubernetes 指南](./kubernetes) |
| 副本数 > 1 / 多副本上线 | [多副本上线 Runbook](./multi-replica-runbook) |
| 准备上线 | [部署路径检查清单](./deployment-checklists) → [生产上线清单](./production-checklist) |

无论哪条路径，前端组件能力可参考 [前端集成配方](./frontend-recipes)；联调遇到问题时查看 [排障手册](./troubleshooting)。

### 三种典型场景速查

| 场景 | 推荐路径 | 下一步 |
| --- | --- | --- |
| 已有 Spring Boot 业务后端，希望把 AI 能力嵌入现有系统 | 集成 `ai-assistant-spring-boot-starter` | 先看 [快速开始](./quick-start)，再看 [配置说明](./configuration) |
| 不想改业务后端，或多个系统共用同一套 AI 能力 | 运行 `ai-assistant-service` 独立服务 | 先看 [独立服务部署](./standalone-service)，再看 [前端连接独立服务](./frontend-standalone) |
| 正在接前端组件，但后端由别人维护 | 只配置 Vue 组件的 `baseUrl` 和 `accessToken` | 先看 [前端连接独立服务](./frontend-standalone)，再看 [聊天 API](../api/chat) |
| 准备上线 | 对照安全、限流、日志和健康检查逐项确认 | 先看 [生产上线清单](./production-checklist)，再看 [排障手册](./troubleshooting) |

## 文档地图

| 主题 | 文档 |
| --- | --- |
| Starter 安装、最小配置和端点 | [快速开始](./quick-start) |
| 后端、独立服务和前端配置 | [配置说明](./configuration) |
| 前端组件配置、事件和交互配方 | [Frontend Recipes](./frontend-recipes) |
| 聊天、翻译、摘要和流式输出 | [Chat & Streaming](./chat) |
| Function Calling 和工具注册 | [Function Calling](./function-calling) |
| MCP Server 接入 | [MCP Server](./mcp-server) |
| 插件扩展 | [Plugin System](./plugins) |
| 后端模块边界和维护规则 | [Backend Architecture](./backend-architecture) |
| Starter / 独立服务 / 前端依赖边界 | [Dependency Footprint](./dependency-footprint) |
| Docker / Compose 独立服务 | [Standalone Service](./standalone-service) |
| Starter 与独立服务部署选择 | [Deployment Checklists](./deployment-checklists) |
| Kubernetes / Helm | [Kubernetes](./kubernetes) |
| 多副本部署上线（Redis 接线 / 故障演练 / 回滚） | [Multi-Replica Runbook](./multi-replica-runbook) |
| REST API | [API Overview](../api/) |
| 稳定、实验与仅文档能力边界 | [Capability Matrix](../CAPABILITY-MATRIX) |

## 核心特性

| 特性 | 说明 |
|------|------|
| 多 LLM 支持 | OpenAI / DeepSeek / 通义千问 / GLM / Gemini |
| SSE 流式 | 标准化 ServerSentEvent 端点 |
| MCP Server | 实验性的 HTTP JSON-RPC 子集：`initialize`、`tools/list`、`tools/call` |
| Function Calling | AssistantCapability 自动注册为 LLM 工具 |
| 插件系统 | 运行时热加载 JAR 插件 |
| 租户上下文 | `X-Tenant-Id` 请求上下文 + Token 配额；资源级授权由宿主负责 |
| 可观测性 | Micrometer + Actuator HealthIndicator |
| 事件总线 | Spring ApplicationEvent 解耦 |
| RBAC | 可插拔接口；默认 `AllowAll`，生产必须由宿主替换或在网关强制授权 |
| 独立部署 | Docker Compose + GHCR 镜像 + 健康检查 |

## 架构

```
┌─────────────┐     ┌──────────────────────────────────────┐
│  Vue 3 UI   │ ──► │  Spring Boot Starter                 │
│  Component  │     │  ├── AiAssistantController (REST/SSE)│
│  Library    │     │  ├── McpServerController (MCP)       │
└─────────────┘     │  ├── LlmService (core)               │
                    │  │   ├── ChatCompletionClient         │
                    │  │   ├── ToolRegistry + Capabilities  │
                    │  │   ├── ConversationMemory           │
                    │  │   └── ModelRouter + Fallback       │
                    │  ├── SPI Extensions                   │
                    │  └── Admin Dashboard                  │
                    └──────────────────────────────────────┘
```
