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
| `GET` | `/admin/overview` | 系统概览。 |
| `GET` | `/admin/tokens` | 查询 Token 用量。 |
| `POST` | `/admin/tokens/quota` | 设置租户每日配额。 |
| `GET` | `/admin/prompts` | 查看 Prompt 模板。 |
| `POST` | `/admin/prompts` | 注册 Prompt 模板。 |
| `GET` | `/admin/tools` | 查看已注册工具。 |
| `POST` | `/admin/rag/ingest` | 录入 RAG 文档。 |
| `GET` | `/admin/rag/stats` | 查询 RAG 统计。 |
| `POST` | `/admin/ab-test` | 配置 A/B 测试。 |

## 安全建议

- 生产环境必须设置 `access-token`。
- Admin API 建议只在内网、网关或管理后台后方暴露。
- 涉及配额、Prompt、RAG 文档写入的接口应记录审计日志。
- 不要把 Admin API 暴露给普通终端用户。
