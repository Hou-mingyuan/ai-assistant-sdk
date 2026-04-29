# 前端连接独立服务

独立服务模式下，前端不需要再依赖业务后端集成 Starter，只要把助手组件的 `baseUrl` 指向独立服务即可。

## 1. 服务端先准备好

本地 Docker 服务默认地址：

```text
http://localhost:8080/ai-assistant
```

生产环境建议至少配置：

```text
AI_ASSISTANT_API_KEY=sk-your-key
AI_ASSISTANT_ACCESS_TOKEN=change-me
AI_ASSISTANT_ALLOWED_ORIGINS=https://your-frontend.example.com
AI_ASSISTANT_RATE_LIMIT=60
SPRING_PROFILES_ACTIVE=prod
```

如果前端本地开发地址是 `http://localhost:5173`，需要把它加入 `AI_ASSISTANT_ALLOWED_ORIGINS`。

## 2. Vue 3 插件接入

```ts
import { createApp } from 'vue'
import App from './App.vue'
import AiAssistant from '@ai-assistant/vue'
import '@ai-assistant/vue/dist/style.css'

createApp(App)
  .use(AiAssistant, {
    baseUrl: 'http://localhost:8080/ai-assistant',
    accessToken: 'change-me',
    locale: 'zh',
    theme: 'light',
    autoMountToBody: true,
  })
  .mount('#app')
```

如果使用 `autoMountToBody: true`，不需要再在模板里写 `<AiAssistant />`，否则会出现两个悬浮球。

## 3. 用环境变量区分本地和生产

Vite 项目可以使用：

```text
VITE_AI_ASSISTANT_BASE_URL=http://localhost:8080/ai-assistant
VITE_AI_ASSISTANT_ACCESS_TOKEN=change-me
```

代码里读取：

```ts
const assistantBaseUrl = import.meta.env.VITE_AI_ASSISTANT_BASE_URL || '/ai-assistant'
const assistantAccessToken = import.meta.env.VITE_AI_ASSISTANT_ACCESS_TOKEN || undefined

app.use(AiAssistant, {
  baseUrl: assistantBaseUrl,
  accessToken: assistantAccessToken,
})
```

生产环境不建议把长期固定的高权限 Token 写死到公开前端包里。更安全的做法是由业务后端或网关签发短期 Token，再传给前端组件。

## 4. Web Component 接入

Web Component 适合 Vue 以外的页面或低代码平台：

```html
<script type="module" src="/assets/ai-assistant-wc.mjs"></script>

<ai-assistant
  base-url="http://localhost:8080/ai-assistant"
  access-token="change-me"
  locale="zh"
  theme="light">
</ai-assistant>
```

等价属性：

| 属性 | 说明 |
|------|------|
| `base-url` / `endpoint` | 独立服务地址 |
| `access-token` / `token` | 对应服务端 `AI_ASSISTANT_ACCESS_TOKEN` |
| `locale` | `zh`、`en`、`ja`、`ko` |
| `theme` | `light`、`dark`、`auto` |
| `show-model-picker` | 是否显示模型选择器 |
| `show-system-prompt` | 是否显示 system prompt 编辑区 |

## 5. 本地开发代理

如果不想在浏览器里直接跨域访问 `localhost:8080`，可以在 Vite 里代理到独立服务：

```ts
// vite.config.ts
import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    proxy: {
      '/ai-assistant': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
})
```

然后前端配置：

```ts
app.use(AiAssistant, {
  baseUrl: '/ai-assistant',
  accessToken: 'change-me',
})
```

这种方式下浏览器请求同源路径，跨域问题由 Vite 开发服务器代理处理。

## 6. 生产反向代理接入

生产环境更推荐让浏览器访问同源路径，再由 Nginx、Caddy、Ingress 或 API Gateway
转发到独立服务：

```text
https://app.example.com/ai-assistant  ->  http://ai-assistant:8080/ai-assistant
```

前端配置保持为相对路径：

```ts
app.use(AiAssistant, {
  baseUrl: '/ai-assistant',
  accessToken: shortLivedToken,
})
```

这种方式的优点是部署迁移时前端不用关心容器内地址，也可以减少跨域配置面。
代理层如果已经做了统一鉴权，仍建议保留 `AI_ASSISTANT_ACCESS_TOKEN`，
把它作为服务到服务之间的二次保护。

如果前端和独立服务必须使用不同域名，则服务端至少需要配置：

```text
AI_ASSISTANT_ALLOWED_ORIGINS=https://app.example.com
AI_ASSISTANT_ALLOW_QUERY_TOKEN_AUTH=false
```

## 7. 常见问题

### 请求返回 401

说明服务端配置了 `AI_ASSISTANT_ACCESS_TOKEN`，但前端没有传 `accessToken`，或者值不一致。前端最终会发送：

```http
X-AI-Token: change-me
```

### 浏览器跨域失败

检查服务端：

```text
AI_ASSISTANT_ALLOWED_ORIGINS=http://localhost:5173,https://your-frontend.example.com
```

生产环境不要使用 `*`。服务端启动时会对 `AI_ASSISTANT_ALLOWED_ORIGINS=*` 且未配置访问 Token 的组合输出风险提示。

### 修改了服务上下文路径后无法访问

如果服务端修改：

```text
AI_ASSISTANT_CONTEXT_PATH=/assistant
```

前端也要同步修改：

```ts
app.use(AiAssistant, {
  baseUrl: 'http://localhost:8080/assistant',
})
```

健康检查路径也会变为：

```text
GET http://localhost:8080/assistant/health
```
