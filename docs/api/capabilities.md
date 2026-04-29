# Capabilities API

Capabilities API 用于让前端或宿主系统发现当前服务启用的能力。

## 典型用途

- 判断是否启用文件上传。
- 判断是否启用 WebSocket。
- 判断是否启用 RAG、MCP、插件或管理能力。
- 根据后端能力动态展示前端入口。

## 请求

```bash
curl http://localhost:8080/ai-assistant/capabilities \
  -H "X-AI-Token: change-me"
```

## 响应内容

实际字段会随版本和配置变化，通常包括能力开关、限制值和可用功能标识。

前端集成时建议：

- 对未知字段保持兼容。
- 对缺失字段使用安全默认值。
- 不要仅依赖前端隐藏入口来实现安全控制，后端仍需校验权限。

