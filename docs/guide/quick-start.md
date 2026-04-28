# 快速开始

## 1. 添加依赖

```xml
<dependency>
    <groupId>com.aiassistant</groupId>
    <artifactId>ai-assistant-spring-boot-starter</artifactId>
    <version>1.0.0-SNAPSHOT</version>
</dependency>
```

## 2. 配置

在 `application.yml` 中添加：

```yaml
ai-assistant:
  api-key: sk-your-api-key
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
| `/ai-assistant/mcp` | POST | MCP Server 端点，需显式启用 `ai-assistant.mcp-server-enabled=true` |
| `/ai-assistant/admin/overview` | GET | 管理面板 |

## 4. 前端集成

```bash
npm install ai-assistant-ui
```

```vue
<template>
  <AiAssistant :api-base="'/ai-assistant'" />
</template>
```
