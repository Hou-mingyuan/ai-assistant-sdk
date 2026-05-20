# Chat API

聊天 API 提供普通响应和流式响应两种形式。

## POST `/chat`

普通对话接口。

请求示例：

```json
{
  "action": "chat",
  "text": "你好",
  "sessionId": "default"
}
```

响应示例：

```json
{
  "success": true,
  "result": "你好，有什么可以帮你？"
}
```

## POST `/stream`

兼容流式接口。响应类型为 `text/event-stream`，每个未命名 SSE `data:` 帧承载一段文本增量。

官方 Vue 组件、Java Client 和当前 E2E 测试默认使用此端点，因此它是最稳定的客户端集成入口。前端通常用 `fetch()` + `ReadableStream` 读取，而不是浏览器原生 `EventSource`。

请求示例：

```json
{
  "action": "summarize",
  "text": "需要总结的正文"
}
```

流片段示例：

```text
data: 第一段

data:  第二段保留前导空格

data: [DONE]
```

## POST `/sse`

标准化 SSE 端点。参数与 `/stream` 相同，但事件带类型：

```text
event: message
data: 第一段

event: done
data: [DONE]
```

适合希望显式区分 `message`、`done`、`error` 的自定义客户端。若只是接入官方 SDK，优先使用 `/stream`。

## 鉴权

如果后端配置了 `ai-assistant.access-token`，请求必须携带：

```text
X-AI-Token: your-access-token
```

## 常见错误

| 状态码 | 含义 | 建议 |
| --- | --- | --- |
| 400 | 请求参数不合法 | 检查 `action` 和 `text`。 |
| 401 | 未授权 | 检查 `X-AI-Token`。 |
| 429 | 触发限流 | 调整 `rate-limit` 或网关限流。 |
| 500 | 服务端调用失败 | 检查模型供应商、网络和日志。 |

