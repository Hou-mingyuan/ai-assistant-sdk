# Admin API

Admin API 用于管理后台能力，包括系统概览、Token 用量、Prompt 模板、工具、RAG 文档和 A/B 测试配置。

## 启用

默认关闭，需要显式开启：

```yaml
ai-assistant:
  admin-enabled: true
  access-token: change-me
```

独立服务环境变量：

```text
AI_ASSISTANT_ADMIN_ENABLED=true
AI_ASSISTANT_ACCESS_TOKEN=change-me
```

## 常用端点

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/ai-assistant/admin/overview` | 系统概览。 |
| `GET` | `/ai-assistant/admin/tokens` | 查询 Token 用量。 |
| `POST` | `/ai-assistant/admin/tokens/quota` | 设置租户每日配额。 |
| `GET` | `/ai-assistant/admin/prompts` | 查看 Prompt 模板。 |
| `POST` | `/ai-assistant/admin/prompts` | 注册 Prompt 模板。 |
| `GET` | `/ai-assistant/admin/tools` | 查看已注册工具。 |
| `POST` | `/ai-assistant/admin/rag/ingest` | 录入 RAG 文档。仅在 RAG 显式启用后可用。 |
| `GET` | `/ai-assistant/admin/rag/stats` | 查询 RAG 统计。仅在 RAG 显式启用后可用。 |
| `POST` | `/ai-assistant/admin/ab-test` | 配置 A/B 测试。 |
| `GET` | `/ai-assistant/admin/runtime/model-config` | 查看运行时模型供应商配置（不返回 API key）。 |
| `POST` | `/ai-assistant/admin/runtime/model-config` | 更新运行时模型供应商配置。 |
| `POST` | `/ai-assistant/admin/runtime/model-config/discover-models` | 使用当前运行时配置检测上游模型列表。 |

## 安全建议

- 生产环境必须设置 `access-token`。
- 如果需要独立管理权限，设置 `admin-token` 或环境变量 `AI_ASSISTANT_ADMIN_TOKEN`，前端通过 `adminToken` / Web Component `admin-token` 传入。
- `runtime-config-secret-key` 为空时，运行时更新的模型 API key 只保存在内存；配置该 secret 后才会以 AES-GCM 加密形式持久化。
- Admin API 建议只在内网、网关或管理后台后方暴露。
- 涉及配额、Prompt、RAG 文档写入的接口应记录审计日志。
- 不要把 Admin API 暴露给普通终端用户。

表中使用默认 `context-path=/ai-assistant`。如果修改了 `ai-assistant.context-path`，所有路径的前缀随之变化。
