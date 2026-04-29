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
  "content": "你好，有什么可以帮你？"
}
```

## POST `/stream`

SSE 流式接口。适合前端打字机效果。

请求示例：

```json
{
  "action": "summarize",
  "text": "需要总结的正文"
}
```

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

