# 介绍

AI Assistant SDK 是一个可嵌入的 AI 助手解决方案，包含：

- **后端**：Spring Boot Starter（Java 17+），提供对话、翻译、摘要、RAG、Tool Calling 等能力
- **前端**：Vue 3 组件库，开箱即用的对话界面
- **独立服务**：可通过 Docker / docker compose 单独部署，适合多个系统共用同一套 AI 能力

如果你选择独立服务形态，前端接入可参考：[前端连接独立服务](./frontend-standalone)。
部署或联调遇到问题时，可以直接查看：[排障手册](./troubleshooting)。

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
