# MCP Server（experimental）

该端点把 AI Assistant SDK 的能力暴露为 HTTP JSON-RPC 工具。当前只实现 `initialize`、`tools/list`、`tools/call` 三个方法，不包含其它 MCP 方法、stdio/SSE transport、资源、Prompt、订阅、会话协商或完整客户端兼容认证，因此不承诺符合完整 MCP 规范。

## 启用

在后端配置中开启：

```yaml
ai-assistant:
  mcp-server-enabled: true
```

独立服务可使用环境变量：

```text
AI_ASSISTANT_MCP_SERVER_ENABLED=true
```

## 适用场景

- 在受控网络内验证工具发现和工具调用协议。
- 由宿主针对目标客户端补契约测试后，接入内部自动化平台。
- 不应仅凭本端点存在就宣称某个第三方 MCP 客户端已经兼容。

## 安全建议

- MCP Server 不应在公网裸露。
- 与业务数据相关的工具需要做租户和权限校验。
- 生产环境应放在内网、网关或鉴权代理之后。
- 记录关键工具调用日志，便于排障和审计。

## 后续扩展

如果需要对接新的 MCP 客户端，建议先确认：

1. 传输方式。
2. 鉴权方式。
3. 暴露的工具范围。
4. 工具调用是否允许副作用。
5. 错误和超时如何反馈给客户端。

需要完整 MCP 兼容时，应先补齐目标规范版本、transport、生命周期、鉴权和官方互操作测试；在此之前该能力保持 `experimental`。
