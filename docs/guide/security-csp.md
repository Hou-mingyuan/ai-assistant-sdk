# 安全：CSP 与浏览器策略指引

把 AI Assistant 嵌入到企业内部门户、SaaS 仪表板或公开网站时，浏览器侧
的内容安全策略（CSP）是**最容易被忽略但又最容易踩雷**的环节。本文整理
SDK 实际触发的浏览器能力，给出可直接 copy 的 CSP 头建议、常见报错排查、
以及与其他安全头（COEP / COOP / Permissions-Policy）的配合。

## SDK 实际使用的浏览器能力

| 能力 | 使用场景 | 触发的 CSP 指令 |
| --- | --- | --- |
| 主对话 / 流式输出 | `fetch` 到 `options.baseUrl` 的 `/chat` `/stream` | `connect-src` |
| WebSocket fallback | `useStreamWithFallback` 在 SSE 不可用时 fallback | `connect-src` (ws/wss 协议) |
| Markdown 渲染 / DOMPurify | 助手回复的 HTML | `script-src 'unsafe-inline'` **不需要**（已用 trusted-types-compatible 的 DOMPurify）|
| 代码高亮 | `highlight.js` 静态 CSS | `style-src` |
| Mermaid 图表 | `import('mermaid')` 动态加载 + SVG 渲染 | `script-src` (含 wasm-unsafe-eval 见下) + `worker-src` |
| 流式 SSE | `EventSource` / `fetch` ReadableStream | `connect-src` |
| 复制到剪贴板 | `navigator.clipboard.writeText` | 无 CSP 限制（需要安全上下文） |
| 屏幕截图 / 图像 | `<img>` 加载用户消息中的图片 URL | `img-src` |
| URL preview | 后端 `/url-preview` 抓取图片 → 前端展示 | `img-src` |
| 文件下载导出 | `Blob` URL `download` 属性 | 无 CSP 限制 |
| 主题色注入 | inline `<style>` (theme) | `style-src 'unsafe-inline'` 或用 nonce |
| 头像 / 滑动等 CSS 动画 | 纯 CSS keyframes | 无额外指令 |

## 推荐的最小可行 CSP

> ⚠️ **必须根据宿主页面情况调整**，下面给出的是仅看 AI Assistant SDK
> 自身需求的 CSP 片段，宿主原有的 CSP 需要做并集而不是覆盖。

```http
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'wasm-unsafe-eval';
  style-src 'self' 'unsafe-inline';
  font-src 'self' data:;
  img-src 'self' data: blob: https:;
  connect-src 'self' https://api.your-llm-gateway.example.com wss://api.your-llm-gateway.example.com;
  worker-src 'self' blob:;
  frame-ancestors 'none';
  base-uri 'self';
  form-action 'self';
  object-src 'none';
  upgrade-insecure-requests
```

### 关键点说明

1. **`script-src 'wasm-unsafe-eval'`**
   - 如启用 Mermaid（`import('mermaid')` peer）：mermaid 内部的 elk
     layout 用 WebAssembly。
   - 未启用 Mermaid 可移除此 token。

2. **`style-src 'unsafe-inline'`**
   - 主题色通过 inline `<style>` 注入；highlight.js 主题 CSS 也是
     inline class style。
   - 想严格禁 inline → 把 SDK 的 `primaryColor` 改为预生成 CSS 变量，
     并 nonce 化所有 highlight.js 主题片段（工作量较大，仅高安全场景
     考虑）。

3. **`img-src https:`**
   - URL preview / 用户粘贴图片可能引用任意 HTTPS 域名。
   - 想严格 → 白名单已知图床（`https://*.cdn.example.com`）。

4. **`connect-src`**
   - 必须列出 `options.baseUrl` 实际指向的域名（含 `https:` 和 `wss:`）。
   - 多区域部署可用 `https://*.your-domain.com`，但**不要**用 `*`。

5. **`frame-ancestors 'none'`**
   - SDK 是嵌入式悬浮球，不应被任何外部页面 iframe 包裹。
   - 防御 clickjacking。

## 配合的其他安全头

```http
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: clipboard-write=(self), microphone=(), camera=()
Strict-Transport-Security: max-age=31536000; includeSubDomains
```

- `Permissions-Policy: clipboard-write=(self)`：允许复制代码块；其它
  权限禁掉。
- `clipboard-read` 默认不开（粘贴图片用 `paste` 事件而非 API）。
- `microphone=()`：除非启用语音输入（`voiceSupported`），否则禁掉。

## 常见 CSP 报错与排查

| 浏览器控制台错误 | 触发条件 | 修复 |
| --- | --- | --- |
| `Refused to connect to 'https://api...' because it violates CSP directive: "connect-src 'self'"` | 模型 / 后端域名未列入 `connect-src` | 把 baseUrl 域名加进 `connect-src` |
| `Refused to load script ... because it violates ... script-src` | 启用了 Mermaid 但 CSP 没 `'wasm-unsafe-eval'` | 加 token 或禁用 Mermaid 功能 |
| `Refused to apply inline style ...` | 主题色 inline `<style>` 被禁 | `style-src 'unsafe-inline'` 或用 nonce |
| `Refused to load image ... img-src` | URL preview 抓到陌生域名图片 | 放宽 `img-src https:` 或后端代理图片 |
| `EventSource cannot connect ... connect-src` | SSE 流式被 CSP 拦 | 同 connect-src 修复 |

## Nonce 模式（更严格）

若想避免 `'unsafe-inline'`，可让后端每次响应生成随机 nonce 并注入：

```http
Content-Security-Policy:
  script-src 'self' 'nonce-${REQUEST_NONCE}';
  style-src 'self' 'nonce-${REQUEST_NONCE}';
```

并修改宿主页面所有 inline `<style>` 和 `<script>` 加 `nonce`：

```html
<style nonce="${REQUEST_NONCE}">/* highlight.js theme */</style>
```

> SDK 本身不会 hard-code inline `<style>`（除了主题色 CSS 变量注入），
> 因此对接 nonce 主要是宿主页面侧的工作。

## 渲染模型输出的安全边界（XSS）

模型输出是**不可信内容**，渲染到 HTML 上下文前必须净化。本 SDK 的分层约定：

- **官方 Vue 组件 / Web Component 默认安全**：助手回复经 `useAiMarkdownRenderer`
  的 DOMPurify（严格配置，仅放行 `button`/`mark` 标签与少量 `data-*`/`aria-*`
  属性，默认拦截 `<script>`、`on*` 事件、`javascript:` URL）后才插入 DOM。
- **后端有意不对模型输出做 HTML 转义**：`/chat`、`/stream`、`/sse` 返回的是
  **未净化的模型原文（markdown）**。这是刻意设计——若后端转义 HTML 会破坏
  markdown 与代码块渲染；净化职责放在渲染层。
- **自建渲染器 / 直连 REST API 的宿主必须自己净化**：如果你不使用官方组件，
  而是把响应通过 `v-html`、`innerHTML`、`dangerouslySetInnerHTML` 等注入 DOM，
  **必须自行做等价净化**（DOMPurify 或服务端模板转义），否则存在存储型/反射型
  XSS 风险。`ai-assistant-client`（Java）消费方同理：渲染到任何 HTML 上下文前需净化。

> 一句话：把模型输出当成"用户输入"。官方 UI 已替你净化；任何绕过官方 UI 的
> 渲染路径都要自己补上净化这一步。

## 与服务端安全的关系

CSP 是**浏览器侧的纵深防御**，不能替代下列服务端措施：

- `AdminAuthFilter`（SDK 自带）：保护 `/admin/**`
- `ContentFilter`：PII 脱敏
- `SsrfPolicy` / `UrlFetchSafety`：URL 预览/抓取防 SSRF
- 后端 CORS：浏览器同源策略的服务端补充

详见 [生产上线清单](./production-checklist.md)。

## 进一步阅读

- [MDN: Content Security Policy reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- [OWASP CSP Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html)
- [CSP Evaluator](https://csp-evaluator.withgoogle.com/) — 在线检查 CSP 头是否漏了关键指令
