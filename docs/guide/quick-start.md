# 快速开始

本页用于跑通最小可用链路。开始前请先确认你选择的是哪种接入方式：

- **Starter 集成**：已有 Spring Boot 后端，想让业务系统自己暴露 `/ai-assistant/*` 接口。
- **独立服务部署**：不改业务后端，直接运行 `ai-assistant-service`，前端或其他系统通过 HTTP 调用它。

下面的步骤默认使用 Starter 集成。如果你还没决定部署形态，请先看 [部署路径检查清单](./deployment-checklists)。如果你选择独立服务，请直接阅读 [独立服务部署](./standalone-service) 和 [前端连接独立服务](./frontend-standalone)。

## 1. 添加依赖

```xml
<dependency>
    <groupId>com.aiassistant</groupId>
    <artifactId>ai-assistant-spring-boot-starter</artifactId>
    <version>1.0.1</version>
</dependency>
```

## 2. 配置

先用零密钥 Demo 跑通真实 REST/SSE 链路：

```yaml
ai-assistant:
  provider: demo
```

Demo 响应会明确标识为确定性本地输出。切换真实 Provider 时改为：

```yaml
ai-assistant:
  api-key: ${AI_ASSISTANT_API_KEY}
  provider: openai        # openai / deepseek / qwen / glm / gemini
  model: gpt-4o
```

## 3. 启动

启动 Spring Boot 应用后，以下端点自动可用：

| 端点 | 方法 | 说明 |
|------|------|------|
| `/ai-assistant/chat` | POST | 同步对话 |
| `/ai-assistant/stream` | POST | SSE 流式 |
| `/ai-assistant/sse` | POST | 标准化 SSE（带事件类型） |
| `/ai-assistant/health` | GET | 健康检查 |
| `/ai-assistant/capabilities` | GET | 能力发现 |
| `/ai-assistant/mcp` | POST | 实验性 MCP JSON-RPC 子集；默认关闭，需显式启用 |
| `/ai-assistant/admin/overview` | GET | 实验性管理端点；默认关闭，需管理令牌 |

## 4. 前端集成

```bash
npm install @ai-assistant/vue
```

```ts
import AiAssistant from '@ai-assistant/vue'
import '@ai-assistant/vue/dist/style.css'

app.use(AiAssistant, { baseUrl: '/ai-assistant', locale: 'zh' })
```

然后在模板里放置 `<AiAssistant />`；如果不想改根组件模板，也可以配置 `autoMountToBody: true` 自动挂载。

## 下一步

- 需要完整配置项：阅读 [配置说明](./configuration)。
- 需要在 Starter 和独立服务之间做选择：阅读 [部署路径检查清单](./deployment-checklists)。
- 需要对接远程独立服务：阅读 [前端连接独立服务](./frontend-standalone)。
- 需要确认接口契约：阅读 [聊天 API](../api/chat) 和 [能力发现 API](../api/capabilities)。
- 准备生产上线：阅读 [生产上线清单](./production-checklist)。
- 核对稳定与实验能力：[能力矩阵](../CAPABILITY-MATRIX)。
