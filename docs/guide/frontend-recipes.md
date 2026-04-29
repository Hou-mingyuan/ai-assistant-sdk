# 前端集成配方

本页整理 Vue 组件和 Web Component 的常见接入方式。后端接口、鉴权和 CORS 先按 [配置说明](./configuration) 完成，再回到本页配置前端。

## 基础接入

### 模板中手动放置组件

适合你希望控制组件所在位置，或只在某些页面展示助手。

```ts
import { createApp } from 'vue'
import App from './App.vue'
import AiAssistant from '@ai-assistant/vue'
import '@ai-assistant/vue/dist/style.css'

createApp(App)
  .use(AiAssistant, {
    baseUrl: '/ai-assistant',
    accessToken: 'change-me',
    locale: 'zh',
    theme: 'auto',
  })
  .mount('#app')
```

```vue
<template>
  <AiAssistant />
</template>
```

### 自动挂载到页面

适合低侵入接入，不想修改根组件模板时使用。

```ts
app.use(AiAssistant, {
  baseUrl: '/ai-assistant',
  accessToken: 'change-me',
  autoMountToBody: true,
})
```

开启 `autoMountToBody` 后，不要再在模板里写 `<AiAssistant />`，否则会出现两个悬浮球。

## 常用配置配方

### 同源后端

前端和后端部署在同一个域名下时，推荐使用相对路径：

```ts
app.use(AiAssistant, {
  baseUrl: '/ai-assistant',
  accessToken: window.__AI_ASSISTANT_TOKEN__,
})
```

这种方式最少触发跨域问题，也方便通过网关统一鉴权。

### 连接独立服务

如果助手后端是独立服务，`baseUrl` 指向服务公开地址：

```ts
app.use(AiAssistant, {
  baseUrl: 'https://assistant.example.com/ai-assistant',
  accessToken: shortLivedToken,
})
```

独立服务需要把前端域名加入 `AI_ASSISTANT_ALLOWED_ORIGINS`。更完整说明见 [前端连接独立服务](./frontend-standalone)。

### 主题和语言

```ts
app.use(AiAssistant, {
  baseUrl: '/ai-assistant',
  locale: 'zh',
  theme: 'auto',
  primaryColor: '#6366f1',
  position: 'bottom-right',
})
```

`theme: 'auto'` 会跟随系统主题；`position` 可选 `bottom-right`、`bottom-left`、`top-right`、`top-left`。

## 快捷输入和 Prompt 模板

### 快捷短语

`quickPrompts` 只在对话模式下展示。点击后会把文本填入输入框，不会自动发送。

```ts
app.use(AiAssistant, {
  baseUrl: '/ai-assistant',
  quickPrompts: [
    { label: '会议纪要', text: '请把上文整理成会议纪要：' },
    { label: '风险点', text: '请列出这段内容里的风险点：' },
  ],
})
```

### 带变量的 Prompt 模板

`promptTemplates` 支持 `{{var}}` 占位符。点击模板后，组件会展示变量表单，再把渲染后的内容发送给助手。

```ts
app.use(AiAssistant, {
  baseUrl: '/ai-assistant',
  promptTemplates: [
    {
      label: '生成周报',
      template: '请基于以下信息生成{{team}}团队周报，语气{{tone}}：\n{{content}}',
      variables: [
        { name: 'team', label: '团队', default: '研发' },
        { name: 'tone', label: '语气', default: '简洁专业' },
        { name: 'content', label: '原始内容' },
      ],
    },
  ],
})
```

## 事件和错误监控

组件会对外触发以下事件：

| 事件 | 触发时机 | 载荷 |
| --- | --- | --- |
| `send` | 用户发送请求时 | `{ action, text }` |
| `response` | 收到助手回复时 | `content` |
| `error` | 请求或组件内部处理失败时 | `message` |
| `feedback` | 用户点击赞或踩时 | `{ index, value }`，`value` 为 `up`、`down` 或 `null` |

模板中监听：

```vue
<AiAssistant
  @send="trackSend"
  @response="trackResponse"
  @error="reportError"
  @feedback="trackFeedback"
/>
```

也可以用 `onAssistantError` 接入统一监控。它和 `error` 事件并行，不会阻止组件展示错误提示。

```ts
app.use(AiAssistant, {
  baseUrl: '/ai-assistant',
  onAssistantError(payload) {
    console.warn('[assistant]', payload.source, payload.message)
  },
})
```

## 代码块打开 IDE

传入 `openCodeInIde` 后，代码块旁会展示 IDE 按钮。组件只负责把代码和语言回传给宿主，真正打开 VS Code、Cursor 或企业内部工具的逻辑由宿主实现。

```ts
app.use(AiAssistant, {
  baseUrl: '/ai-assistant',
  openCodeInIde({ code, language }) {
    console.log('open in IDE', language, code)
  },
})
```

## 会话和内存限制

浏览器侧默认只在内存中保留有限消息，避免长会话拖慢页面：

```ts
app.use(AiAssistant, {
  baseUrl: '/ai-assistant',
  persistHistory: false,
  maxMessagesInMemory: 200,
  maxTotalCharsInMemory: 4_000_000,
  maxUserMessageChars: 120_000,
})
```

如果业务内容敏感，建议保持 `persistHistory: false`。如果需要浏览器本地恢复历史，再显式开启。

## 模型选择和 System Prompt

```ts
app.use(AiAssistant, {
  baseUrl: '/ai-assistant',
  showModelPicker: true,
  selectedModelStorageKey: 'ai-assistant-selected-model',
  showSystemPromptEditor: true,
  systemPromptMaxInputChars: 4000,
})
```

后端只有配置了 `allowed-models` 时，前端选择的模型才会生效。生产环境如果要统一助手角色，可以在后端配置 `system-prompt` 并关闭 `allow-client-system-prompt`，同时前端设置 `showSystemPromptEditor: false`。

## Web Component 配方

Web Component 适合 React、Vue 2、Angular、原生 HTML 或低代码平台：

```html
<script type="module" src="/assets/ai-assistant-wc.mjs"></script>

<ai-assistant
  base-url="/ai-assistant"
  access-token="change-me"
  locale="zh"
  theme="auto"
  show-model-picker="true">
</ai-assistant>
```

常用属性和 Vue 配置基本一一对应，只是命名从 camelCase 变成 kebab-case，例如 `baseUrl` 对应 `base-url`，`accessToken` 对应 `access-token`。

## 常见踩坑

- 出现两个悬浮球：同时开启了 `autoMountToBody`，又在模板中写了 `<AiAssistant />`。
- 请求 401：前端 `accessToken` 和后端 `access-token` 或 `AI_ASSISTANT_ACCESS_TOKEN` 不一致。
- 浏览器跨域失败：后端 `allowed-origins` 或 `AI_ASSISTANT_ALLOWED_ORIGINS` 没有包含当前页面源。
- 模型下拉看得到但切换无效：后端没有配置 `allowed-models` 白名单。
- 生产包泄漏长期 Token：不要把高权限长期 Token 直接写入公开前端包，优先由业务后端或网关签发短期 Token。
