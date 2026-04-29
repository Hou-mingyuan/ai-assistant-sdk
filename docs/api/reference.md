# REST API 参考

本页汇总常用 REST API。默认路径以前缀 `/ai-assistant` 为例；如果修改了 `ai-assistant.context-path` 或 `AI_ASSISTANT_CONTEXT_PATH`，请同步替换前缀。

配置了 `access-token` 或 `AI_ASSISTANT_ACCESS_TOKEN` 时，除健康检查外的业务接口都应携带：

```text
X-AI-Token: your-access-token
```

## 核心对话

### `POST /ai-assistant/chat`

同步调用 AI，适合服务端集成、批处理和不需要实时展示的场景。

```json
{
  "action": "translate",
  "text": "Hello world",
  "targetLang": "zh"
}
```

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `action` | string | 否 | `translate`、`summarize`、`chat`，默认 `chat`。 |
| `text` | string | 是 | 输入文本。 |
| `targetLang` | string | 否 | 翻译目标语言，例如 `zh`、`en`、`ja`。 |
| `history` | array | 否 | 多轮对话历史，仅对 `chat` 常用，格式为 `[{ "role": "user", "content": "..." }]`。 |
| `systemPrompt` | string | 否 | 仅对 `chat` 常用；需后端允许 `allow-client-system-prompt`。 |
| `model` | string | 否 | 仅在后端配置了 `allowed-models` 且命中白名单时生效。 |

响应示例：

```json
{
  "success": true,
  "result": "你好世界"
}
```

### `POST /ai-assistant/stream`

SSE 流式输出，参数与 `/chat` 基本一致。响应类型为 `text/event-stream`，适合浏览器打字机效果。

### `GET /ai-assistant/models`

返回可供前端选择的模型列表。未配置 `allowed-models` 时，通常只返回当前默认模型；配置白名单后返回白名单列表。

## 文件和链接

### `POST /ai-assistant/file/summarize`

上传文件并生成摘要。

| 参数 | 类型 | 说明 |
| --- | --- | --- |
| `file` | multipart | 上传的文件。 |

支持文本、Markdown、CSV、PDF、Word、Excel、JSON、XML、HTML、YAML 等常见格式。上传大小由 Spring multipart 配置和 `file-max-extracted-chars` 等限制共同控制。

### `POST /ai-assistant/file/translate`

上传文件并翻译。

| 参数 | 类型 | 说明 |
| --- | --- | --- |
| `file` | multipart | 上传的文件。 |
| `targetLang` | string | 目标语言，默认 `zh`。 |

### `GET /ai-assistant/url-preview?url=...`

从指定 `http(s)` 页面提取标题、短摘要和图片。该接口受 URL 抓取安全策略控制；如果关闭 `url-fetch-enabled`，接口会返回失败。

响应示例：

```json
{
  "success": true,
  "title": "Example",
  "summary": "Lead paragraph ...",
  "imageUrl": "https://example.com/hero.png",
  "imageUrls": ["https://example.com/hero.png"]
}
```

生产环境应保持 `url-fetch-ssrf-protection=true`，并限制抓取大小、超时和注入模型的字符数。

## 导出

### `POST /ai-assistant/export`

把一组消息导出为 `xlsx`、`docx` 或 `pdf`。

```json
{
  "format": "xlsx",
  "title": "AI Assistant",
  "messages": [
    { "role": "user", "content": "hi" },
    { "role": "assistant", "content": "hello" }
  ]
}
```

| 字段 | 说明 |
| --- | --- |
| `format` | `xlsx`、`docx` 或 `pdf`。 |
| `title` | 导出标题。 |
| `messages` | 需要导出的消息数组。 |

跨域下载时，后端会暴露 `Content-Disposition`，便于前端读取建议文件名。

## 健康、统计和运行状态

### `GET /ai-assistant/health`

轻量健康检查，默认不需要鉴权。

### `GET /ai-assistant/stats`

返回调用次数、错误数、按 action 和日期聚合的基础统计。

### `GET /ai-assistant/runtime/config`

返回不含密钥的运行时配置摘要，用于排查上下文路径、功能开关和限制值。生产环境仍建议只在可信网络或鉴权后访问。

## 能力与管理接口

- 能力发现接口见 [Capabilities API](./capabilities)。
- 管理接口见 [Admin API](./admin)。
- 聊天接口的更多错误码说明见 [Chat API](./chat)。
