# 后端架构维护说明

本页面向维护者，说明 `ai-assistant-server` 中各包的职责边界。新增能力时优先把代码放到正确层级，避免所有逻辑堆到 controller 或 `LlmService`。

## 总体分层

```text
controller  ->  service / capability / mcp / export
             ->  tool / rag / agent / prompt / routing / memory
             ->  connector / spi
             ->  config / security / observability / resilience
             ->  model / event / util
```

建议依赖方向从入口层流向能力层、基础设施层和模型层。避免反向依赖，例如 `model`、`config`、`spi` 不应依赖 controller。

## 包职责

| 包 | 职责 | 适合放什么 | 不适合放什么 |
| --- | --- | --- | --- |
| `controller` | HTTP、SSE、WebSocket 入口 | 请求参数校验、状态码、响应 DTO 组装、调用服务层 | 模型供应商细节、长业务流程、文件解析细节 |
| `service` | 核心业务编排 | `LlmService`、URL 抓取、文件解析、会话存储、LLM 客户端调用编排 | HTTP 路由、Spring MVC 注解、前端展示逻辑 |
| `service.llm` | 模型调用网关 | OpenAI 兼容请求、非流式和流式调用抽象 | 业务 prompt 规则、controller 响应处理 |
| `config` | 自动配置、过滤器和运行时配置 | `AiAssistantProperties`、CORS、鉴权、限流、租户、追踪、Provider 连通性检查 | 具体业务能力实现 |
| `autoconfigure` | Starter 自动装配 | Bean 条件注册、默认实现注入、与 Spring Boot 集成 | 复杂业务逻辑 |
| `model` | 请求和响应数据结构 | Controller DTO、内部简单值对象 | 依赖 Spring Web 或服务实现 |
| `tool` | Function Calling 工具抽象 | `ToolDefinition`、`ToolRegistry` | 某个具体数据源的查询协议 |
| `connector` | 外部数据源连接器 | JDBC、REST、低代码平台连接器、健康检查、熔断 | LLM prompt 逻辑、HTTP controller |
| `rag` | 检索增强生成 | Embedding、VectorStore、文档分块、检索编排 | 通用文件上传 controller |
| `agent` | 多步工具执行 | 执行计划、步骤结果、执行轨迹 | 模型供应商 HTTP 细节 |
| `prompt` | 服务端 Prompt 模板 | 模板注册、变量替换、条件渲染 | 前端 prompt 卡片 UI |
| `routing` | 模型路由和 A/B 测试 | 模型配置、路由规则、稳定分流 | HTTP 鉴权、供应商 API 调用 |
| `memory` | 对话记忆 | 短期窗口、长期事实、记忆注入 | 浏览器 localStorage |
| `security` | 内容安全 | PII 脱敏、Prompt 注入检测 | 接口 Token 鉴权过滤器 |
| `stats` | 统计和配额 | 调用次数、Token 用量、租户配额 | 业务日志格式化 |
| `observability` | 可观测性 | 指标、追踪、运行状态暴露辅助 | 业务功能开关 |
| `resilience` | 稳定性能力 | 重试、熔断、降级策略 | Controller 参数解析 |
| `spi` / `capability` | 可扩展接口 | 宿主系统扩展点、能力发现 | 默认业务流程硬编码 |
| `event` | 领域事件 | 请求、响应、错误、审计等事件对象 | 直接执行耗时任务 |
| `webhook` | Webhook 通知 | 异步任务完成通知、回调安全校验 | 同步 chat 主流程 |
| `export` | 导出相关模型和能力 | DOCX、PDF、XLSX 导出结构 | 文件上传解析入口 |
| `i18n` | 国际化文本 | 后端错误消息或提示文本 | 前端 UI 翻译表 |
| `util` | 小型无状态工具 | 字符串、集合、摘要等通用辅助 | 有状态服务、Spring Bean 编排 |

## 新增功能放置建议

| 新需求 | 推荐位置 |
| --- | --- |
| 新增 REST 接口 | `controller` 新增入口，复杂逻辑下沉到 `service` 或对应能力包 |
| 新增模型供应商或代理协议 | 优先扩展 `service.llm`，必要时更新 `AiAssistantProperties.resolveBaseUrl()` 和 `resolveModel()` |
| 新增 Function Calling 工具 | 实现 `tool.ToolDefinition`，或通过 `connector` 自动注册数据源工具 |
| 新增外部数据源 | 放到 `connector`，不要直接写在 `LlmService` |
| 新增知识库能力 | 放到 `rag`，HTTP 录入入口放到 controller，检索编排留在 service/rag |
| 新增安全检查 | 内容级检查放 `security`，请求级鉴权或限流放 `config` 过滤器 |
| 新增统计指标 | 计数和配额放 `stats`，Micrometer/追踪接入放 `observability` |
| 新增异步或回调能力 | 任务入口放 controller，执行和通知放 service/webhook |

## Controller 规则

Controller 只负责“协议适配”：

- 读取请求体、请求头和路径参数。
- 调用服务层或能力层。
- 转换状态码和响应结构。
- 不直接拼接模型 prompt。
- 不直接访问外部模型、数据库、向量库或第三方 API。
- 不保存跨请求状态。

如果一个 controller 方法需要超过少量参数整理和一次服务调用，优先抽成 service 方法。

## Service 规则

Service 负责业务流程编排，但不要无限膨胀：

- 模型请求组装和普通对话流程可以在 `LlmService`。
- 供应商 HTTP 调用细节放到 `service.llm`。
- RAG 相关流程放到 `rag`。
- 工具调用注册和执行放到 `tool` / `agent`。
- 外部数据源协议放到 `connector`。
- 文件解析放到 `FileParserService`，导出放到导出相关服务。

当一个 service 同时处理“请求入口、模型路由、文件解析、外部数据源、审计和响应格式”时，应拆分。

## 配置和自动装配规则

- 新配置项先加入 `AiAssistantProperties`，并设置安全默认值。
- 独立服务需要暴露给 `.env` 时，同步更新 `ai-assistant-service/src/main/resources/application.yml` 和 `.env.example`。
- Starter 默认 Bean 使用条件注册，让宿主系统可以覆盖。
- 新增生产风险项时，同步更新 [配置说明](./configuration) 和 [生产上线清单](./production-checklist)。

## 扩展点规则

优先提供接口或 Bean 覆盖点，而不是要求用户复制内部类：

- 模型调用：自定义 `ChatCompletionClient`。
- Prompt 或消息结构：必要时覆盖 `LlmService`。
- 工具调用：实现 `ToolDefinition`。
- 外部数据源：实现连接器接口或使用内置连接器配置。
- 会话存储：替换 `SessionStore`。
- 向量存储：替换 `VectorStore`。

新增扩展点时，应同时说明默认实现、覆盖方式和最小示例。

## 维护检查清单

提交后端新能力前，至少确认：

- [ ] 入口层、业务层、基础设施层职责没有混在同一个类里。
- [ ] 新配置项有默认值、文档和独立服务环境变量映射。
- [ ] 新能力默认关闭或有安全默认值。
- [ ] 公网风险能力已加入生产上线清单。
- [ ] 宿主可替换的能力使用接口、条件 Bean 或 SPI，而不是硬编码。
- [ ] 最小相关测试或脚本已运行。
