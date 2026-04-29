# 配置说明

AI Assistant SDK 的配置分为三层：

1. **后端 Starter 配置**：写在宿主 Spring Boot 项目的 `application.yml` 中，前缀为 `ai-assistant`。
2. **独立服务环境变量**：写在根目录 `.env` 中，由 `ai-assistant-service` 的 `application.yml` 映射成后端配置。
3. **前端组件配置**：写在 Vue 宿主项目的 `app.use(AiAssistant, options)` 中。

如果你还没有确定接入方式，请先阅读 [介绍](./index) 中的“从哪里开始”。

## 最小可用配置

### Starter 集成

在宿主 Spring Boot 项目的 `application.yml` 中至少配置模型供应商和 API Key：

```yaml
ai-assistant:
  provider: openai
  api-key: ${AI_ASSISTANT_API_KEY}
  model: gpt-4o-mini
```

如果你使用 OpenAI 兼容网关、代理地址或私有模型服务，再显式配置 `base-url`：

```yaml
ai-assistant:
  provider: openai
  api-key: ${AI_ASSISTANT_API_KEY}
  base-url: https://your-openai-compatible-gateway.example.com/v1
  model: your-model-name
```

### 独立服务

独立服务使用根目录 `.env.example` 中的环境变量。最小配置通常是：

```text
AI_ASSISTANT_API_KEY=sk-your-key
AI_ASSISTANT_PROVIDER=openai
AI_ASSISTANT_BASE_URL=https://api.openai.com/v1
AI_ASSISTANT_MODEL=gpt-4o-mini
AI_ASSISTANT_ACCESS_TOKEN=change-me
AI_ASSISTANT_ALLOWED_ORIGINS=http://localhost:5173
```

本地启动后默认访问：

```text
http://localhost:8080/ai-assistant/health
```

### 前端组件

Vue 宿主项目中注册组件：

```ts
app.use(AiAssistant, {
  baseUrl: 'http://localhost:8080/ai-assistant',
  accessToken: 'change-me',
})
```

如果后端设置了 `access-token` 或独立服务设置了 `AI_ASSISTANT_ACCESS_TOKEN`，前端必须传入相同的 `accessToken`。组件会通过 `X-AI-Token` 请求头访问接口。

## 后端配置分层

### 必填与模型连接

| 配置项 | 默认值 | 说明 | 建议 |
| --- | --- | --- | --- |
| `provider` | `openai` | 模型供应商标识。 | 使用内置供应商时可直接填 `openai`、`deepseek`、`qwen`、`glm`、`ollama` 等。 |
| `api-key` | 空 | 当前模型供应商的 API Key。 | 生产环境使用环境变量注入，不要写死在仓库中。 |
| `api-keys` | 空 | 多个 API Key，运行时会与 `api-key` 合并。 | 适合简单轮询或多 Key 兜底。 |
| `base-url` | 按 `provider` 推导 | OpenAI 兼容接口地址。 | 使用代理、网关、自部署模型或未知供应商时必须显式配置。 |
| `model` | 按 `provider` 推导 | 默认模型。 | 生产环境建议显式配置，避免供应商默认值变化带来行为差异。 |
| `context-path` | `/ai-assistant` | 后端接口前缀。 | 修改后前端 `baseUrl`、健康检查和反向代理路径必须同步调整。 |

### 安全相关

| 配置项 | 默认值 | 说明 | 生产建议 |
| --- | --- | --- | --- |
| `access-token` | 空 | 小助手接口访问令牌，客户端通过 `X-AI-Token` 传入。 | 必填，尤其是公网或跨系统部署。 |
| `allowed-origins` | `*` | CORS 白名单，多个来源用逗号分隔。 | 使用明确域名，不要在生产环境使用 `*`。 |
| `allow-query-token-auth` | `false` | 是否允许用 `?token=` 传令牌。 | 保持关闭，避免 Token 出现在 URL、日志和浏览器历史中。 |
| `pii-masking-enabled` | `true` | 是否启用手机号、邮箱、身份证号等敏感信息脱敏。 | 保持开启。 |
| `url-fetch-enabled` | `true` | 是否允许后端抓取用户消息里的链接正文。 | 需要链接摘要时开启；不需要外链抓取时关闭。 |
| `url-fetch-ssrf-protection` | `true` | 是否启用 SSRF 防护。 | 保持开启，不要为绕过内网访问限制而关闭。 |
| `admin-enabled` | `false` | 是否注册 `/admin/*` 管理接口。 | 只在受保护的内网、网关或鉴权环境中开启。 |
| `connector-management-enabled` | `false` | 是否允许运行时注册或卸载连接器。 | 只给可信管理端开启。 |
| `mcp-server-enabled` | `false` | 是否启用 MCP Server 端点。 | 只在确认调用方身份和权限后开启。 |

### 性能与资源限制

| 配置项 | 默认值 | 说明 | 调整建议 |
| --- | --- | --- | --- |
| `timeout-seconds` | `60` | 调用 LLM 的超时时间。 | 长文摘要或慢模型可调大，但不要无限增大。 |
| `max-tokens` | `2048` | 模型最大输出 Token。 | 按成本和结果长度调整。 |
| `temperature` | `0.7` | 模型随机性。 | 客服、知识问答等稳定场景可降低。 |
| `llm-max-retries` | `2` | 非流式请求的瞬时错误重试次数。 | 网络不稳定时保留默认；高并发场景注意重试放大流量。 |
| `rate-limit` | `0`（Starter）/ `60`（独立服务） | 每客户端每分钟限流。 | 单实例可用内置限流，多实例建议在网关或 Redis 层统一。 |
| `rate-limit-per-action` | 空 | 按 `chat`、`stream`、`export` 等动作覆盖限流。 | 对导出、上传等重操作单独设置更低配额。 |
| `chat-max-total-chars` | `300000` | 单次聊天请求总字符上限。 | 避免超长请求拖垮服务或放大模型成本。 |
| `chat-history-max-chars` | `48000` | 发送给模型的历史消息最大字符数。 | 长会话成本高时降低。 |
| `file-max-extracted-chars` | `300000` | 文件解析后注入模型的最大字符数。 | 大文件摘要场景可适度调大。 |
| `url-fetch-max-bytes` | `524288` | 链接抓取的最大响应字节数。 | 公网部署建议保持有限值。 |
| `url-fetch-timeout-seconds` | `15` | 链接抓取超时。 | 避免被慢站点拖住请求线程。 |
| `url-fetch-max-chars-injected` | `24000` | 抓取正文注入模型的最大字符数。 | 控制外链内容带来的 Token 成本。 |

### 可选能力开关

| 配置项 | 默认值 | 说明 | 何时开启 |
| --- | --- | --- | --- |
| `websocket-enabled` | `false` | 启用 WebSocket 通道。 | 需要双向实时通信且前端已适配时开启。 |
| `rag-enabled` | `false` | 启用 RAG 检索增强。 | 需要知识库问答时开启，并配置嵌入模型与向量存储。 |
| `embedding-model` | 空 | 嵌入模型名称。 | 开启 RAG 后按供应商配置。 |
| `embedding-dimensions` | `1536` | 向量维度。 | 必须与嵌入模型和向量库一致。 |
| `headless-fetch-enabled` | `false` | 使用 Playwright 抓取 JS 渲染页面。 | 只有普通 HTTP 抓取无法获取正文时开启。 |
| `headless-fetch-timeout-seconds` | `30` | Headless 页面加载超时。 | JS 页面较慢时调大。 |
| `allowed-models` | 空 | 允许前端选择的模型白名单。 | 需要模型下拉切换时配置。 |
| `system-prompt` | 空 | 服务端默认系统提示词。 | 需要统一助手角色、语气或边界时配置。 |
| `allow-client-system-prompt` | `true` | 是否允许请求体覆盖系统提示词。 | 生产环境如需统一角色，可关闭。 |
| `client-system-prompt-max-chars` | `4000` | 客户端自定义系统提示词最大字符数。 | 前端开放个性化输入时保留上限。 |

### 导出与文件处理

| 配置项 | 默认值 | 说明 |
| --- | --- | --- |
| `export-max-messages` | `2000` | 单次导出最多消息数。 |
| `export-max-total-chars` | `2000000` | 单次导出总字符上限。 |
| `export-max-image-bytes` | `3000000` | 单张导出图片最大字节数。 |
| `export-max-image-urls` | `64` | 单次导出最多外链图片数。 |
| `export-embed-images` | `true` | 导出时是否嵌入图片。 |
| `export-pdf-unicode-font` | `classpath:/fonts/NotoSansSC_400Regular.ttf` | PDF 中文字体。 |

独立服务还会通过 Spring Boot 的 multipart 配置控制上传大小：

```text
AI_ASSISTANT_MULTIPART_MAX_FILE_SIZE=10MB
AI_ASSISTANT_MULTIPART_MAX_REQUEST_SIZE=10MB
```

## 独立服务环境变量映射

独立服务的大多数环境变量与后端配置一一对应，只是命名从 kebab-case 变成大写下划线：

| 环境变量 | 后端配置 |
| --- | --- |
| `AI_ASSISTANT_API_KEY` | `ai-assistant.api-key` |
| `AI_ASSISTANT_PROVIDER` | `ai-assistant.provider` |
| `AI_ASSISTANT_BASE_URL` | `ai-assistant.base-url` |
| `AI_ASSISTANT_MODEL` | `ai-assistant.model` |
| `AI_ASSISTANT_CONTEXT_PATH` | `ai-assistant.context-path` |
| `AI_ASSISTANT_ACCESS_TOKEN` | `ai-assistant.access-token` |
| `AI_ASSISTANT_ALLOWED_ORIGINS` | `ai-assistant.allowed-origins` |
| `AI_ASSISTANT_RATE_LIMIT` | `ai-assistant.rate-limit` |
| `AI_ASSISTANT_ADMIN_ENABLED` | `ai-assistant.admin-enabled` |
| `AI_ASSISTANT_RAG_ENABLED` | `ai-assistant.rag-enabled` |
| `AI_ASSISTANT_URL_FETCH_ENABLED` | `ai-assistant.url-fetch-enabled` |
| `AI_ASSISTANT_URL_FETCH_SSRF_PROTECTION` | `ai-assistant.url-fetch-ssrf-protection` |

完整环境变量列表以根目录 `.env.example` 为准。

## 前端配置分层

| 配置项 | 默认值 | 说明 | 建议 |
| --- | --- | --- | --- |
| `baseUrl` | `/ai-assistant` | 后端接口地址。 | 与后端 `context-path` 保持一致；跨域访问独立服务时使用完整 URL。 |
| `accessToken` | 空 | 后端访问令牌。 | 与后端 `access-token` 或 `AI_ASSISTANT_ACCESS_TOKEN` 一致。 |
| `theme` | `light` | 主题，可选 `light`、`dark`、`auto`。 | 跟随宿主系统时使用 `auto`。 |
| `locale` | `en` | UI 语言。 | 中文项目通常设为 `zh`。 |
| `persistHistory` | `false` | 是否在浏览器保存对话历史。 | 涉及敏感信息时谨慎开启。 |
| `autoMountToBody` | `false` | 是否自动挂载到 `document.body`。 | 已在模板中写 `<AiAssistant />` 时不要开启。 |
| `showSystemPromptEditor` | `true` | 是否展示自定义 system prompt 编辑区。 | 生产统一角色时可关闭。 |
| `showModelPicker` | `true` | 是否展示模型选择器。 | 后端未配置 `allowed-models` 时可关闭。 |
| `maxMessagesInMemory` | `200` | 浏览器内最多保留消息条数。 | 长会话页面可降低。 |
| `maxTotalCharsInMemory` | `4000000` | 浏览器内消息总字符上限。 | 内存敏感页面可降低。 |
| `maxUserMessageChars` | `120000` | 单次用户输入最大字符数。 | 与后端 `chat-max-total-chars` 配合控制成本。 |

## 生产配置基线

生产环境至少确认以下项：

```yaml
ai-assistant:
  api-key: ${AI_ASSISTANT_API_KEY}
  access-token: ${AI_ASSISTANT_ACCESS_TOKEN}
  allowed-origins: https://your-frontend.example.com
  rate-limit: 60
  url-fetch-ssrf-protection: true
  allow-query-token-auth: false
  admin-enabled: false
```

如果必须开放管理接口、连接器管理、MCP Server 或 Headless 抓取，请先确保调用方鉴权、网络边界、日志审计和限流策略已经就位。上线前建议再按 [生产上线清单](./production-checklist) 逐项检查。
