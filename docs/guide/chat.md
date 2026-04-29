# 对话与流式输出

AI Assistant SDK 提供普通对话和 SSE 流式对话两种后端接口。前端组件默认使用流式接口，以获得逐字输出体验。

## 普通对话

```bash
curl -X POST http://localhost:8080/ai-assistant/chat \
  -H "Content-Type: application/json" \
  -H "X-AI-Token: change-me" \
  -d '{"action":"chat","text":"你好，请介绍一下这个系统"}'
```

普通对话适合服务端集成、批处理和不需要实时展示的场景。

## 流式对话

```bash
curl -N -X POST http://localhost:8080/ai-assistant/stream \
  -H "Content-Type: application/json" \
  -H "X-AI-Token: change-me" \
  -d '{"action":"chat","text":"用三点总结这段文字"}'
```

流式接口基于 Server-Sent Events，适合浏览器端打字机效果。

## 常见 action

| action | 用途 |
| --- | --- |
| `chat` | 自由对话。 |
| `translate` | 翻译文本。 |
| `summarize` | 总结文本或文件内容。 |

## 前端组件行为

`AiAssistant` 组件会根据模式和输入内容构造请求，并自动处理：

- 流式文本拼接。
- Markdown 渲染。
- 代码块复制。
- 多会话本地持久化。
- 错误提示和重试入口。

## 排障建议

- 返回 401 时，检查 `accessToken` 是否与后端 `access-token` 一致。
- 返回 429 时，检查 `rate-limit` 或网关限流。
- 流式输出中断时，检查代理、网关和浏览器是否支持 SSE。

