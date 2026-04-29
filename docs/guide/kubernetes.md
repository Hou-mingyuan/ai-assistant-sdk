# Kubernetes 部署

本项目提供 Helm 目录作为 Kubernetes 部署起点。生产部署前请结合你的集群网关、密钥管理、日志和监控体系调整。

## 部署前检查

- 已准备可用镜像。
- 已通过 Secret 注入 `AI_ASSISTANT_API_KEY`。
- 已配置明确的 CORS 白名单。
- 已设置 `AI_ASSISTANT_ACCESS_TOKEN`。
- 已确认服务只暴露必要端口。

## 推荐配置

```text
AI_ASSISTANT_ACCESS_TOKEN=change-me
AI_ASSISTANT_ALLOWED_ORIGINS=https://your-frontend.example.com
AI_ASSISTANT_RATE_LIMIT=60
SPRING_PROFILES_ACTIVE=prod
```

## 健康检查

建议使用：

```text
/actuator/health
```

如果修改了 `AI_ASSISTANT_CONTEXT_PATH`，请同步检查 Ingress、探针和前端 `baseUrl`。

## 生产注意事项

- API Key 和访问令牌应使用 Secret 管理，不要写入镜像或 ConfigMap 明文。
- 多副本部署时，内存会话和进程内限流不是全局一致的。
- 需要全局会话、配额或限流时，建议接入 Redis、数据库或网关层能力。
- 只在受保护环境暴露 Actuator 详细端点。
