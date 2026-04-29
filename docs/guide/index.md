# 介绍

AI Assistant SDK 是一个可嵌入的 AI 助手解决方案，包含：

- **后端**：Spring Boot Starter（Java 17+），提供对话、翻译、摘要、RAG、Tool Calling 等能力
- **前端**：Vue 3 组件库，开箱即用的对话界面
- **独立服务**：可通过 Docker / docker compose 单独部署，适合多个系统共用同一套 AI 能力

如果你选择独立服务形态，前端接入可参考：[前端连接独立服务](./frontend-standalone)。
部署或联调遇到问题时，可以直接查看：[排障手册](./troubleshooting)。
正式上线前建议按：[生产上线检查清单](./production-checklist) 逐项确认。

## 从哪里开始

先选择一种部署形态，再继续阅读对应文档。不要在同一次接入中同时把 Starter 集成和独立服务部署混在一起，否则容易出现接口地址、鉴权 Token、跨域和会话状态不一致的问题。

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
| Docker / Compose 独立服务 | [Standalone Service](./standalone-service) |
| Starter 与独立服务部署选择 | [Deployment Checklists](./deployment-checklists) |
| Kubernetes / Helm | [Kubernetes](./kubernetes) |
| REST API | [API Overview](../api/) |

## 核心特性

| 特性 | 说明 |
|------|------|
| 多 LLM 支持 | OpenAI / DeepSeek / 通义千问 / GLM / Gemini |
| SSE 流式 | 标准化 ServerSentEvent 端点 |
| MCP Server | 兼容织信等平台的 MCP 协议 |
| Function Calling | AssistantCapability 自动注册为 LLM 工具 |
| 插件系统 | 运行时热加载 JAR 插件 |
| 多租户 | X-Tenant-Id 隔离 + Token 配额 |
| 可观测性 | Micrometer + Actuator HealthIndicator |
| 事件总线 | Spring ApplicationEvent 解耦 |
| RBAC | 可插拔的权限模型 |
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
