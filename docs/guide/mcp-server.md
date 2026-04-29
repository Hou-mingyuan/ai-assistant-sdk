# MCP Server

MCP Server 用于把 AI Assistant SDK 的能力暴露给支持 Model Context Protocol 的客户端或 Agent。

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

- 让外部 Agent 查询小助手能力列表。
- 将业务连接器能力暴露为标准工具。
- 与低代码平台或内部自动化平台集成。

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
