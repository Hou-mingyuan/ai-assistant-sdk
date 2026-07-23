# 能力矩阵

本文是 AI Assistant SDK `1.0.1` 发布候选版的能力边界。README、功能指南和部署文档均以此表为准。

## 状态定义

| 状态 | 含义 |
| --- | --- |
| `stable` | 已有实现、自动化测试和至少一条可重复运行链路，可作为 v1 公共能力使用。 |
| `experimental` | 已有可运行实现，但协议、持久化、多副本或集成边界尚未承诺稳定；默认关闭或需要显式配置。 |
| `mock-only` | 只用于零密钥演示和确定性测试；输出会明确标识为 Demo，不能当作真实 AI 结果。 |
| `documented-only` | 仓库只定义扩展接口或接入方法，没有随仓库交付实现。 |
| `broken` | 已知不可用或核心流程有可复现缺陷；发布候选版不接受此状态。当前矩阵没有已接受的 `broken` 项。 |

## 后端与客户端

| 能力 | 状态 | 已实现范围与限制 | 主要证据 |
| --- | --- | --- | --- |
| Spring Boot Starter | `stable` | Java 21、Spring Boot 3；自动装配 REST、SSE、错误处理和可选安全过滤器。宿主没有 `MeterRegistry` 时仍可启动。 | `AiAssistantAutoConfigurationTest`、`StarterDemoIntegrationTest` |
| 独立服务 | `stable` | 与 Starter 使用同一核心实现，提供 `/chat`、`/stream`、健康与运行时摘要端点。 | 后端集成测试、`scripts/smoke-zero-key.mjs` |
| Java Client | `stable` | 阻塞式同步聊天与 SSE、认证头、租户头、超时和结构化错误；调用线程生命周期由宿主管理。 | `AiAssistantClientTest`、Maven `verify` |
| OpenAI-compatible 适配 | `stable` | 支持同步与 SSE 协议、供应商默认值、上游错误透传；真实模型调用需要用户提供供应商端点和密钥。仓库测试使用本地协议服务，不伪造公网调用成功。 | `OpenAiCompatibleChatClientTest`、`ProviderAwareChatCompletionClientTest` |
| Function Calling | `stable` | 服务端支持多轮工具调用、参数校验、最大轮次和工具执行结果回灌。具体业务工具及其权限由宿主负责。 | `ToolCallingLoopTest`、`StreamingToolCallingLoopTest` |
| 请求与安全基线 | `stable` | `X-AI-Token`、`X-Tenant-Id` 请求上下文、CORS、SSRF、上传上限、PII 遮罩、注入告警、限流、request id 和结构化错误。宿主仍须负责用户身份与资源级授权。 | 后端安全/过滤器测试、`SECURITY.md` |
| RAG（本地内存） | `experimental` | 已实现分块、embedding、内存向量存储、检索和上下文注入；默认关闭，索引不持久化且不适合多副本。 | `RagServiceTest`、RAG 管理端点测试 |
| 外部向量库 | `documented-only` | `VectorStore` 可替换，但仓库不交付 Milvus、Pinecone、Qdrant 或 pgvector 实现。 | `VectorStore` 接口、部署文档 |
| Agent 步骤执行器 | `experimental` | `AgentExecutor.execute(plan)` 只执行调用方给定的步骤列表并返回轨迹；不包含自主 LLM 规划。 | `AgentExecutorTest` |
| 自主 ReAct 规划 | `documented-only` | 当前没有“模型生成计划—观察—再规划”的自主 Agent 实现。 | 本矩阵与 Function Calling 指南 |
| MCP Server | `experimental` | 仅实现 HTTP JSON-RPC 子集：`initialize`、`tools/list`、`tools/call`；默认关闭，不承诺完整 MCP 规范兼容。 | `McpServerControllerTest` |
| WebSocket | `experimental` | 可选双向通道，默认关闭；官方 Vue 主流程使用 SSE，启用前需自行确认代理、鉴权和重连策略。 | WebSocket 处理器测试、配置指南 |
| Admin API | `experimental` | 总览、用量、Prompt、工具、RAG 和运行时模型配置；默认关闭，必须设置管理令牌并限制网络边界。 | Admin 控制器测试、Admin API 文档 |

## 前端与演示

| 能力 | 状态 | 已实现范围与限制 | 主要证据 |
| --- | --- | --- | --- |
| Vue 3 插件与 Composable | `stable` | SSE 对话、取消/重试、错误状态、会话、主题、键盘操作、移动端与长内容处理。 | Vitest、Playwright 核心流程 |
| Web Component | `stable` | `<ai-assistant>` 使用与 Vue 包相同的组件和请求契约，可在原生 HTML 等宿主中使用。 | 包导出检查、真实后端 Playwright 测试 |
| Playground | `stable` | Demo、Admin 和表单填充演示页；支持桌面/移动视口，明确展示当前 Provider 模式。 | Playground Vitest、浏览器验收截图 |
| Artifact 预览 | `experimental` | 前端解析并预览模型输出中的 `<artifact>` 片段，支持本地版本 UI；不是独立的服务端制品存储系统。 | 前端组件测试 |
| 浏览器语音、朗读与截图辅助 | `experimental` | 依赖浏览器权限和 Web API，兼容性及用户授权由宿主环境决定。 | 前端组件测试与功能指南 |
| Demo Provider | `mock-only` | 确定性本地回复，不访问外部模型。健康响应包含 `mode=demo`、`mock=true`，聊天响应包含 Demo 标识与 `meta.provider=demo`。 | `DemoChatCompletionClientTest`、零密钥 smoke |

## 使用边界

- 默认零密钥路径选择 `provider=demo`，用于验证真实 HTTP/SSE 链路，不用于评估模型质量。
- 真实模型路径必须显式配置 Provider、API Key，并按部署文档启用鉴权、限定 CORS 和网络出口。
- `experimental` 与 `documented-only` 能力不属于 v1 稳定兼容承诺；若依赖这些能力上线，应在宿主项目增加契约测试和容量验证。
- 多租户请求上下文不等于完整业务 RBAC。资源所有权、用户登录和细粒度授权由宿主应用或网关强制执行。
