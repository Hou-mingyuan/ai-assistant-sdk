# AI Assistant SDK

可嵌入任何 Java + Vue 项目的 AI 小助手，覆盖一键翻译、全文摘要、自由对话、RAG 知识库、多步 Agent、PII 脱敏、多租户隔离与管理后台。

仓库由后端 Spring Boot Starter、独立服务、Vue 3 组件库、Web Component、Java 客户端、VitePress 文档站和 Helm/Docker 部署模板组成；任选其中一种或两种形态接入，互不冲突。

## 先看这里

README 只作为项目总览和常用入口。更完整、可导航的安装、配置、部署和 API 说明请优先查看文档站目录。

| 你想做什么 | 推荐入口 |
| --- | --- |
| 5 分钟内跑通 Starter + Vue 组件 | [快速开始](docs/guide/quick-start.md) |
| 了解所有配置项如何分层启用 | [配置说明](docs/guide/configuration.md) |
| 在 Starter 集成和独立服务之间做选择 | [部署路径检查清单](docs/guide/deployment-checklists.md) |
| 不改业务后端，直接运行独立服务 | [独立服务部署](docs/guide/standalone-service.md) |
| 前端单独连接远程后端服务 | [前端连接独立服务](docs/guide/frontend-standalone.md) |
| 配置前端事件、快捷 Prompt 和常见交互 | [前端集成配方](docs/guide/frontend-recipes.md) |
| 维护后端模块边界和扩展点 | [后端架构维护说明](docs/guide/backend-architecture.md) |
| 对接聊天、流式输出或管理接口 | [API 文档](docs/api/index.md) |
| 上线前检查安全和运维配置 | [生产上线清单](docs/guide/production-checklist.md) |
| 联调时排查 404、401、跨域或模型错误 | [排障手册](docs/guide/troubleshooting.md) |

如果你是第一次接入，建议先按"后端 Starter 集成"和"独立服务部署"二选一，不要同时混用两条路径。

---

## 特性

**核心交互**

- 翻译、摘要、自由对话三档模式；多轮上下文记忆与可编辑 system prompt
- SSE 流式输出（打字机效果）和可选 WebSocket 双向通道
- Markdown 安全渲染（DOMPurify + highlight.js 核心 8 种语言常驻、扩展 13 种按需懒加载）
- 暗色 / 浅色 / 跟随系统主题，多语言 UI（中 / 英 / 日 / 韩）
- 对话持久化、多会话标签页、会话内搜索、会话分叉

**多模型**

OpenAI、DeepSeek、通义千问、智谱 GLM、火山引擎豆包、MiniMax、Kimi、Google Gemini、SiliconFlow、Groq、零一万物 Yi、讯飞星火、百川、阶跃星辰、腾讯混元、Ollama 共 16 家内置；其它任意 OpenAI 兼容供应商可通过 `provider=openai` + 自定义 `base-url` 接入。

**企业能力**

- 多租户隔离（`X-Tenant-Id` 请求头驱动，按租户独立配置模型 / 限流 / 连接器）
- PII 自动脱敏（手机号、身份证、银行卡、邮箱、IP）+ 26 种 Prompt 注入检测
- Token 用量按租户日期统计 + 每日配额
- 智能模型路由（任务类型 / 成本 / token 量）+ A/B 测试分流
- 服务端 Prompt 模板引擎（`{{var}}`、`{{#if}}`、4 套预设）

**工程与运维**

- Function Calling（多轮 tool calling 循环）+ ReAct 多步 Agent
- RAG 检索增强（嵌入 → 向量存储 → 上下文注入）
- 异步任务 API（202 + 轮询 + Webhook 回调）
- Admin REST 后台（`/admin/*`，默认关闭）
- 数据连接器（Informat / JDBC / REST API），自动注册为 LLM 工具
- 链接正文抓取（含 SSRF 防护与短 TTL 缓存）
- 启动时 Provider 连通性检测、连接器健康调度、熔断器
- 进程内或 Redis 限流、SSE GZIP、请求追踪、SSE / WebSocket 心跳

**前端**

- Vue 3 插件 / Web Component / `useAiAssistant` Composable 三种形态
- 拖拽文件上传（PDF / Word / Excel / CSV）、Vision 图片理解、TTS 朗读、🎤 语音输入
- 70+ 配置项可控的悬浮球与面板（位置、贴边、缩放、自动挂载）

完整能力清单与状态说明：[特性详解 / 文档地图](docs/guide/index.md)。

---

## 架构与扩展点

**后端（`ai-assistant-server`）**

| 组件 | 职责 |
|------|------|
| `LlmService` | 业务 prompt 编排、`buildRequestBody`、URL enrich 后拼入 user 内容 |
| `ChatCompletionClient` | 与供应商无关的网关：非流式 / SSE 流各一条抽象；默认 Bean 为 `OpenAiCompatibleChatClient` |
| `UrlFetchService` | 外网抓取、SSRF 粗检、HTML 缓存与摘要 |
| `RagService` | RAG 编排：文档分块、embedding、向量检索、上下文注入 |
| `ContentFilter` | PII 脱敏 + Prompt 注入检测 |
| `ModelRouter` | 按任务类型 / 成本 / token 路由模型，支持 A/B 测试分流 |
| `AgentExecutor` | ReAct 多步 Agent：规划式工具调用 + 执行轨迹 |
| `PromptTemplateRegistry` | 服务端 Prompt 模板注册中心，支持条件渲染 |
| `TokenUsageTracker` | 按租户 / 日期追踪 token 用量与配额 |
| `ConversationMemory` | 短期滑动窗口 + 长期事实记忆 |
| `ProviderConnectivityChecker` | 启动时探测 LLM API 连通性 |
| `ConnectorHealthScheduler` | 定期探测 DataConnector 健康状态 |
| `TenantFilter` / `TenantContext` | 多租户请求隔离 |
| `SseCompressionFilter` | SSE 流式端点 GZIP 压缩 |
| `AdminDashboardController` | 管理后台 REST API |
| `AsyncTaskController` | 异步对话任务（202 + 轮询 + webhook） |

宿主只需声明自定义 `ChatCompletionClient` Bean（`@ConditionalOnMissingBean` 已让位）即可接入自建代理、工具调用协议或 RAG 改写后的请求体；若需改 prompt / 消息结构，仍可替换 `LlmService`。

**前端（`ai-assistant-ui`）**

| 资产 | 说明 |
|------|------|
| `components/AiAssistant.vue` | 主挂件逻辑与模板 |
| `components/styles/01..08-*.css` | 主组件样式按区域切片（layout / header-messages / input-popups / features / overlays / page-feedback / voice-thinking / late-additions） |
| `composables/useAiMarkdownRenderer.ts` | Markdown + 高亮 + DOMPurify + 代码块按钮 |
| `utils/i18n/{en,zh,ja,ko}.ts` | 4 语言 i18n 拆分 |
| `utils/api.ts` | REST `/export`、`url-preview`、`chat`、上传 |
| `utils/pageContextDom.ts` | 按选择器采集页面区块文本（`pageContextBlocks`） |

**限流**：Starter 内为进程内计数；多实例部署请在 API 网关或 Redis（`RedisRateLimitFilter`）侧做统一配额。

完整后端模块图、新功能放置规则、扩展点维护建议见：[后端架构维护说明](docs/guide/backend-architecture.md)。

---

## 高级能力（详见文档站）

| 能力 | 入口 | 一句话 |
| --- | --- | --- |
| 数据连接器 | [插件指南](docs/guide/plugins.md) | `DataConnector` 接口让 LLM 自动调用 Informat / JDBC / REST API；每个连接器自动注册为 `list_modules` / `get_schema` / `query_data` 三个工具 |
| RAG 检索增强 | [chat 与 RAG 介绍](docs/guide/chat.md) | `rag-enabled=true` 启用；默认 `InMemoryVectorStore`，生产可换 Milvus / Pinecone / Qdrant |
| Admin 管理后台 | [Admin API](docs/api/admin.md) | `admin-enabled=true` 启用；提供总览、Token 配额、Prompt 模板、A/B 测试、RAG 录入 |
| 异步任务 | [API 参考](docs/api/reference.md) | `POST /async/chat` 返回 202 + taskId，可轮询或配置 webhook |
| 多租户 | [配置说明](docs/guide/configuration.md) | `X-Tenant-Id` 请求头隔离；可按租户独立配置模型 / 限流 / 配额 |
| PII 与 Prompt 注入 | [生产清单](docs/guide/production-checklist.md) | 默认 `pii-masking-enabled=true`；注入检测仅日志告警不阻断 |
| 模型路由 / A/B 测试 | [Admin API](docs/api/admin.md) | `ModelRouter` + Admin REST 配置 |
| Prompt 模板 | [Function Calling](docs/guide/function-calling.md) | 内置 `general` / `customer-service` / `data-analyst` / `code-assistant` 4 套；支持 `{{var}}` 与 `{{#if}}` |
| ReAct Agent | [Function Calling](docs/guide/function-calling.md) | `AgentExecutor.execute(plan)` 串行多步工具调用；含 `ExecutionTrace` |
| Token 用量 | [Admin API](docs/api/admin.md) | 按租户 / 日期统计；超额拒绝请求 |
| 连接器运维 | [插件指南](docs/guide/plugins.md) | `ConnectorHealthScheduler` 定时探测；`CircuitBreaker` 熔断；动态注册 / 卸载 |
| Web Component | [前端配方](docs/guide/frontend-recipes.md) | `npm run build:wc` 后可在 React / Angular / 原生 HTML 中以 `<ai-assistant>` 嵌入 |
| MCP Server | [MCP 指南](docs/guide/mcp-server.md) | `mcp-server-enabled=true` 暴露 JSON-RPC 工具发现 / 调用端点 |

---

## 快速开始

完整流程见 [docs/guide/quick-start.md](docs/guide/quick-start.md)。最小用法：

**后端（Spring Boot 3.x）**

```xml
<dependency>
  <groupId>com.aiassistant</groupId>
  <artifactId>ai-assistant-spring-boot-starter</artifactId>
  <version>1.0.0</version>
</dependency>
```

```yaml
ai-assistant:
  provider: deepseek
  api-key: sk-xxx
  context-path: /ai-assistant
```

**前端（Vue 3）**

```bash
npm install @ai-assistant/vue
```

```ts
import AiAssistant from '@ai-assistant/vue'
import '@ai-assistant/vue/dist/style.css'

app.use(AiAssistant, { baseUrl: '/ai-assistant', theme: 'auto', locale: 'zh' })
```

模板内放置 `<AiAssistant />`，或开启 `autoMountToBody: true` 自动挂载。

---

## 配置

完整配置项（约 50+，覆盖必填、模型连接、安全、性能、可选能力、导出、独立服务、前端）：[配置说明](docs/guide/configuration.md)。

最小生产基线：

```yaml
ai-assistant:
  provider: deepseek
  api-key: sk-xxx
  access-token: change-me                       # 接口鉴权
  allowed-origins: https://your-frontend.com    # CORS 限定
  rate-limit: 60                                # 每分钟每 IP/Token 上限
  pii-masking-enabled: true
  url-fetch-ssrf-protection: true
```

前端组件配置项（`app.use` 的 `AiAssistantOptions`）共 70+ 项，常用 ~20 个，详见：[前端集成配方](docs/guide/frontend-recipes.md)、[前端连接独立服务](docs/guide/frontend-standalone.md)。

---

## API 接口

完整 API 细节维护在文档站：

- [API 概览](docs/api/index.md)
- [REST API 参考](docs/api/reference.md)
- [Chat API](docs/api/chat.md)
- [Capabilities API](docs/api/capabilities.md)
- [Admin API](docs/api/admin.md)

常用入口：

| API | 说明 |
| --- | --- |
| `POST /ai-assistant/chat` | 同步对话、翻译、摘要 |
| `POST /ai-assistant/stream` | SSE 流式输出 |
| `POST /ai-assistant/file/summarize` | 上传文件并摘要 |
| `POST /ai-assistant/file/translate` | 上传文件并翻译 |
| `GET /ai-assistant/url-preview?url=...` | 抓取链接标题、摘要和图片 |
| `POST /ai-assistant/export` | 导出 XLSX / DOCX / PDF |
| `GET /ai-assistant/health` | 轻量健康检查 |
| `GET /ai-assistant/runtime/config` | 不含密钥的运行时配置摘要 |

---

## 部署

完整路径选择 + 上线检查：[部署路径检查清单](docs/guide/deployment-checklists.md)。

**集成到已有 Spring Boot 后端**：引入 starter，业务服务自动暴露 `/ai-assistant/*`。最适合需要复用业务身份、租户、数据库上下文的场景。

**独立 Docker 服务**：`ai-assistant-service` 提供官方镜像。详见 [独立服务部署](docs/guide/standalone-service.md)。

```bash
copy .env.example .env
# 编辑 .env，至少填入 AI_ASSISTANT_API_KEY
docker compose up -d --build
```

启动后默认地址：

```text
http://localhost:8080/ai-assistant/health
http://localhost:8080/ai-assistant/chat
http://localhost:8080/ai-assistant/stream
http://localhost:8080/actuator/health
```

如使用已发布镜像而不在本机构建：

```bash
docker compose -f docker-compose.ghcr.yml up -d
```

生产推荐：

```bash
docker compose -f docker-compose.prod.yml up -d
```

Kubernetes：使用 `helm/ai-assistant`，Chart 包含 Deployment / Service / 可选 Ingress / 可选 HPA。详见 [Kubernetes 指南](docs/guide/kubernetes.md)。

烟测（不触发真实模型调用）：

```bash
node scripts/smoke-standalone-service.mjs http://localhost:8080/ai-assistant change-me
```

上线前请逐项确认：[生产上线清单](docs/guide/production-checklist.md)。

---

## 项目结构

```text
ai-assistant-sdk/
├── ai-assistant-server/          # Spring Boot Starter（核心后端能力）
│   └── src/main/java/com/aiassistant/
│       ├── autoconfigure/        # Spring Boot 自动装配入口
│       ├── config/               # Properties / Auth / CORS / RateLimit / Tenant / RequestId / Tracing
│       ├── controller/           # REST / SSE / WebSocket / 异步任务 / Admin / 健康
│       ├── service/              # LlmService、UrlFetchService、FileParser、Export、SessionStore
│       │   └── llm/              # ChatCompletionClient（默认 OpenAI 兼容）
│       ├── connector/            # DataConnector + Informat / JDBC / REST + 健康调度 + 熔断
│       ├── tool/                 # Function Calling：ToolDefinition / ToolRegistry
│       ├── rag/                  # EmbeddingProvider / VectorStore / RagService
│       ├── agent/                # AgentExecutor 多步执行
│       ├── memory/               # ConversationMemory
│       ├── prompt/               # PromptTemplateRegistry
│       ├── routing/              # ModelRouter + A/B 测试
│       ├── security/             # ContentFilter（PII + 注入检测）+ Audit
│       ├── stats/                # 用量 + TokenUsageTracker
│       ├── mcp/                  # MCP Server JSON-RPC 端点
│       └── spi/                  # 服务发现接口
├── ai-assistant-service/         # 独立 Docker 服务启动器（复用 starter）
├── ai-assistant-client/          # Java 客户端 SDK
├── ai-assistant-ui/              # @ai-assistant/vue（Vue 3 npm 包）
│   └── src/
│       ├── index.ts              # 插件入口与 AiAssistantOptions 类型
│       ├── components/           # AiAssistant.vue + styles/01..08-*.css + 11 个子组件
│       ├── composables/          # useAiAssistant + 21 个 composable
│       ├── utils/                # api / wsChat / i18n（按语言拆分）/ Markdown / 客户端导出
│       └── web-component.ts      # <ai-assistant> 自定义元素封装
├── docs/                         # VitePress 文档站
├── e2e/                          # Playwright 端到端测试
├── helm/                         # Kubernetes Helm Chart
├── deploy/                       # nginx / Caddy 反向代理样例
├── integrations/                 # 第三方集成示例
└── scripts/                      # 版本一致性、健康检查、smoke 测试
```

---

## 开发与测试

```bash
# 前端 Vitest
cd ai-assistant-ui && npm test

# 后端 JUnit 5
cd ai-assistant-server && mvn test

# 文档站本地预览
cd docs && npm ci && npm run dev

# 综合健康检查
node scripts/project-health-check.mjs --docs   # 仅文档站
node scripts/project-health-check.mjs --all    # 全量（耗时）
```

CI 流水线（`.github/workflows/ci.yml`）在每次 push / PR 时运行 lint、测试、构建、OWASP Dependency-Check、npm audit、Trivy；发布流（`publish.yml`）在创建 GitHub Release 时自动发包到 npmjs.org 与 GitHub Packages。详见 `docs/guide/quick-start.md` 与 `docs/guide/deployment-checklists.md`。

---

## 常见问题

完整 FAQ 见 [排障手册](docs/guide/troubleshooting.md)。最高频问题速查：

- 启动报 `ai-assistant.api-key must be configured` → 缺少配置项，按 [快速开始](docs/guide/quick-start.md) 在 `application.yml` / 环境变量补全。
- 调用 AI 返回 `LLM call failed: Connection refused` → 网络无法访问 `base-url`；离线环境改用 Ollama 或代理。
- 前端跨域报错 → 后端配置 `ai-assistant.allowed-origins=https://your-frontend.com`。
- 接口返回 401 / 429 → 检查 `X-AI-Token` 与 `rate-limit` 配置，详见 [配置说明](docs/guide/configuration.md)。
- 导出 PDF 中文变空格 → 默认嵌入 `NotoSansSC_400Regular.ttf`；若改成自定义字体注意 PDFBox 3.x 不支持 OTF/CFF。

---

## 性能与风险

| 维度 | 现状 |
| --- | --- |
| URL 抓取 | 预编译正则；HTML 超 ~900 KB 截断；同 URL 短 TTL 缓存截断正文 + 原始 HTML；SSRF DNS 判定 ~5 分钟缓存 |
| 悬浮球 / 面板 | `resize` / visualViewport 用 rAF 合并；自定义尺寸再夹紧 |
| 对话区 | 默认仅挂载最近 60 条；`scrollToBottom` rAF 合并；`content-visibility: auto` 减轻长列表 |
| Markdown | LRU 缓存；highlight.js 扩展语言按需加载；流式最后一泡用无高亮渲染 |
| 浏览器内存 | 默认 200 条 + 总字符 ~4M + 单次输入 120k；均可调整或关闭 |
| 模型请求 | `chat-history-max-chars` 从末尾截断；`chat-max-total-chars` 校验整包 |
| 限流 / 缓存 | 默认进程内；多实例需 Redis（`RedisRateLimitFilter` / `RedisSessionStore` 已预置） |

**主要风险**：外网抓取与 SSRF（限流、可关 `url-fetch-enabled`）；模型输出仅走 DOMPurify；密钥与 Token 防泄漏；多实例下进程内限流不一致；中文 PDF 嵌入字体 ~10 MB。生产请配 `rate-limit`、HTTPS 与网关层配额。

进一步扩展方向：[扩展指南 / 文档地图](docs/guide/index.md)。

---

## License

MIT
