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

## 公共 API 分层

`@ai-assistant/vue` 的主入口导出较多。为避免下游误把所有工具都当成同等稳定的核心 API，建议按下面的层级使用：

| 层级 | 适合使用者 | 典型导出 | 稳定性建议 |
| --- | --- | --- | --- |
| 主接入层 | 绝大多数业务前端 | 默认插件、`AiAssistant`、`useAiAssistant`、`@ai-assistant/vue/dist/style.css`、`@ai-assistant/vue/wc` | 最稳定，文档和 README 示例优先使用这一层。 |
| 后端 API helper | 需要自定义 UI，但复用官方后端协议的宿主 | `postServerExport`、`fetchModels`、`fetchUrlPreview`、`fetchRuntimeModelConfig`、`ChatPayload`、`ChatResult` | 稳定，但应跟后端版本一起升级。 |
| 管理与扩展层 | 自建管理台、插件系统、MCP 集成 | `adminApi` 相关方法、`usePluginRegistry`、`useMcpClient`、`useMcpAutoPlugin`、`useMcpStream` | 面向高级集成，生产环境必须配合 admin token、网关和权限边界。 |
| UI 工具层 | 需要复用局部交互能力的高级宿主 | `useMultiSession`、`useTextToSpeech`、`usePromptTemplateLibrary`、`useMessageVirtualScroll`、`useCommandPalette` | 尽量保持兼容，但更容易随组件内部演进调整。 |
| 低层算法 / 实验层 | 想复用具体算法或自行组装能力的宿主 | `diffLines`、`useIdleScheduler`、`useRafBatch`、`useMarkdownWorker`、`formAutoFill` parser / matcher / filler | 可以使用，但建议锁定版本并先写宿主侧适配测试。 |

新增对外导出时，优先判断它属于哪一层：如果只是 `AiAssistant.vue` 内部拆分出来的实现细节，不要默认从主入口 re-export；只有宿主项目确实需要独立复用时再公开。

### 推荐导入路径

主入口继续保留历史导出以兼容已接入项目，但新项目建议按能力选择更窄的二级入口：

| 能力 | 推荐导入 | 说明 |
| --- | --- | --- |
| 主组件 / Vue 插件 | `@ai-assistant/vue` | 默认插件、`AiAssistant`、`useAiAssistant` 和样式仍从主入口接入。 |
| 核心接入瘦身入口 | `@ai-assistant/vue/core` | 只暴露核心插件、主组件、`useAiAssistant` 和核心类型，适合不需要高级工具导出的宿主。 |
| Admin SDK | `@ai-assistant/vue/admin` | 避免把管理面 helper 混进普通业务组件依赖。 |
| MCP client / auto plugin | `@ai-assistant/vue/mcp` | 面向高级工具集成，生产需配合后端 MCP 开关和权限边界。 |
| 表单自动填充工具 | `@ai-assistant/vue/form-fill` | 适合只复用 parser / matcher / filler 的宿主。 |
| 截图能力 | `@ai-assistant/vue/screenshot` | 适合独立页面截图或屏幕捕获集成。 |
| Web Component | `@ai-assistant/vue/wc` | React / Angular / 原生 HTML 集成时使用。 |

### 收窄主入口路线

后续版本应遵循“先迁移、再标注、最后移除”的顺序：

1. **迁移文档示例**：新增示例优先使用二级入口，README 只展示主组件和最常见 API。
2. **保持主入口兼容**：现有主入口导出不在小版本中删除，只通过注释和文档标注稳定性层级。
3. **新增导出默认走子路径**：Admin、MCP、Form Fill、Screenshot 等能力的新 helper 优先加入对应 entry，不再默认加入 `src/index.ts`。
4. **大版本再清理**：如果要从主入口移除高级工具，必须在 changelog 中列出替代导入路径，并提供至少一个版本的迁移窗口。

## 常见踩坑

- 出现两个悬浮球：同时开启了 `autoMountToBody`，又在模板中写了 `<AiAssistant />`。
- 请求 401：前端 `accessToken` 和后端 `access-token` 或 `AI_ASSISTANT_ACCESS_TOKEN` 不一致。
- 浏览器跨域失败：后端 `allowed-origins` 或 `AI_ASSISTANT_ALLOWED_ORIGINS` 没有包含当前页面源。
- 模型下拉看得到但切换无效：后端没有配置 `allowed-models` 白名单。
- 生产包泄漏长期 Token：不要把高权限长期 Token 直接写入公开前端包，优先由业务后端或网关签发短期 Token。
