# API 概览

AI Assistant SDK 提供以下 REST API 分组：

## 核心 API

- `POST /ai-assistant/chat` — 同步对话 / 翻译 / 摘要
- `POST /ai-assistant/stream` — SSE 流式输出
- `POST /ai-assistant/sse` — 标准化 SSE（带 event 类型）
- `GET /ai-assistant/health` — 健康检查
- `GET /ai-assistant/models` — 可用模型列表

## 能力 API

- `GET /ai-assistant/capabilities` — 列出所有能力
- `POST /ai-assistant/capabilities/{name}/invoke` — 调用指定能力

## MCP API

- `POST /ai-assistant/mcp` — JSON-RPC MCP 端点。生产默认关闭，需显式配置 `ai-assistant.mcp-server-enabled=true`。
  - `initialize` — 握手
  - `tools/list` — 工具发现
  - `tools/call` — 工具调用

## 模板 API

- `GET /ai-assistant/templates` — 列出模板
- `POST /ai-assistant/templates` — 创建模板
- `POST /ai-assistant/templates/{name}/render` — 渲染模板

## 管理 API

- `GET /ai-assistant/admin/overview` — 总览
- `GET /ai-assistant/admin/tokens` — Token 用量
- `POST /ai-assistant/admin/tokens/quota` — 设置配额
- `GET /ai-assistant/admin/system` — 系统信息
- `GET /ai-assistant/admin/plugins` — 插件列表
- `POST /ai-assistant/admin/fallback-chain` — 配置降级链
