# 快速开始

## 后端集成

```xml
<dependency>
  <groupId>com.aiassistant</groupId>
  <artifactId>ai-assistant-spring-boot-starter</artifactId>
  <version>1.0.0-SNAPSHOT</version>
</dependency>
```

```yaml
ai-assistant:
  api-key: sk-xxx
  provider: deepseek
```

## 前端集成

```bash
npm install @ai-assistant/vue
```

```ts
import AiAssistantPlugin from '@ai-assistant/vue'
import '@ai-assistant/vue/dist/style.css'

app.use(AiAssistantPlugin, {
  baseUrl: '/ai-assistant',
  locale: 'zh',
  theme: 'auto',
})
```

```vue
<template>
  <AiAssistant />
</template>
```
