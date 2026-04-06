# AI Assistant SDK

可嵌入任何 Java + Vue 项目的 AI 小助手，支持一键翻译、全文摘要、自由对话。

## 特性

- 即插即用 — Spring Boot Starter + Vue 插件，引入即用
- 多模型支持 — 7 家供应商内置（OpenAI / DeepSeek / 通义 / 智谱 / 火山 / MiniMax / Kimi）
- 一键翻译 — 中/英/日互译（面板内切换模式后输入或粘贴文本）
- 全文摘要 — 粘贴文本或上传文件（PDF/Word/Excel/CSV）
- 自由对话 — 多轮上下文记忆，自定义 system prompt
- SSE 流式 — 打字机效果逐字显示
- Markdown 渲染 — 代码语法高亮（内置常用语言子集以控制包体，未收录语言按纯文本块显示）+ 复制按钮
- 暗色主题 — 支持 light / dark / auto（跟随系统）
- 多语言 UI — 中/英切换
- 对话持久化 — localStorage 保存历史
- 安全 — API Key 轮询 / Token 鉴权 / IP 限流
- 用量统计 — 按 action、日期统计调用次数
- **链接正文抓取（服务端）** — 用户消息中含 `http(s)` 链接时，由 **Spring 后端**拉取页面、抽取纯文本并拼入模型上下文（可关闭、可限流大小；可选短 TTL 内存缓存减轻重复抓取）

---

## 架构与扩展点

**后端（`ai-assistant-server`）**

| 组件 | 职责 |
|------|------|
| `LlmService` | 业务 prompts、`buildRequestBody`、URL  enrich 后拼入 user 内容 |
| `ChatCompletionClient` | 与供应商无关的网关：**非流式 / SSE 流** 各一条抽象；默认 Bean 为 `OpenAiCompatibleChatClient`（`POST .../chat/completions`） |
| `UrlFetchService` | 外网抓取、SSRF 粗检、HTML 缓存与摘要 |
| `ConversationExportService` | 会话导出 XLSX/DOCX/PDF |

宿主只需声明自定义 `ChatCompletionClient` Bean（`@ConditionalOnMissingBean` 已让位），即可接入自建代理、工具调用协议或 RAG 改写后的请求体；若需改 prompt/消息结构，仍可替换 `LlmService`。

**前端（`ai-assistant-ui`）**

| 资产 | 说明 |
|------|------|
| `components/AiAssistant.vue` | 主挂件逻辑与模板 |
| `components/AiAssistant.styles.css` | 原先 SFC 内 **scoped** 样式（构建时仍由 Vue 做 scoped 处理） |
| `composables/useAiMarkdownRenderer.ts` | Markdown + 高亮 + DOMPurify + 代码块按钮 |
| `utils/api.ts` | REST /export、url-preview、chat、上传 |
| `utils/pageContextDom.ts` | 按选择器采集页面区块文本（`pageContextBlocks`） |

**限流**：Starter 内为**进程内**计数；多实例部署请在 API 网关或 Redis 侧做统一配额。

---

## 开发与测试

```bash
# 前端（Vitest）
cd ai-assistant-ui && npm test

# 后端（JUnit 5）
cd ai-assistant-server && mvn test
```

---

## 快速开始

### 1. 后端集成（Java / Spring Boot 3.x）

**添加 Maven 依赖：**

```xml
<dependency>
  <groupId>com.aiassistant</groupId>
  <artifactId>ai-assistant-spring-boot-starter</artifactId>
  <version>1.0.0-SNAPSHOT</version>
</dependency>
```

**确保宿主项目包含以下依赖**（通常已有 web，需额外加 webflux）：

```xml
<dependency>
  <groupId>org.springframework.boot</groupId>
  <artifactId>spring-boot-starter-web</artifactId>
</dependency>
<dependency>
  <groupId>org.springframework.boot</groupId>
  <artifactId>spring-boot-starter-webflux</artifactId>
</dependency>
```

**最小配置 `application.yml`：**

```yaml
ai-assistant:
  provider: deepseek
  api-key: sk-your-key-here
```

启动项目，访问 `GET /ai-assistant/health` 返回 `{"success":true,"result":"AI Assistant is running"}` 即集成成功。

### 2. 前端集成（Vue 3）

```bash
npm install @ai-assistant/vue
```

```ts
// main.ts
import AiAssistant from '@ai-assistant/vue'
import '@ai-assistant/vue/dist/style.css'

app.use(AiAssistant, {
  baseUrl: '/ai-assistant',
  primaryColor: '#6366f1',
  position: 'bottom-right',
  // 多页 SPA：无需在模板里写组件，安装后自动挂到 body（不要与下方 <AiAssistant /> 同时使用）
  // autoMountToBody: true,
  // 发送前把固定区域正文拼进请求（用户仍只要自然语言指「新闻区」等）
  // pageContextBlocks: [{ selector: '#app-news-panel', label: '新闻区' }],
  // pageContextMaxChars: 12000,
  // quickPrompts: [{ label: '纪要', text: '请把上文整理成会议纪要：' }],
})
```

```vue
<!-- App.vue 根布局：与 router-view 并列，全站各路由共用同一悬浮球（推荐） -->
<template>
  <router-view />
  <AiAssistant />
</template>
```

若已在 `app.use` 里开启 **`autoMountToBody: true`**，则不要再放 `<AiAssistant />`，否则会出现两个球。页面右下角出现悬浮球即成功。

---

## 配置参考

### 后端配置项（application.yml）

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `ai-assistant.provider` | string | `openai` | 模型供应商（见支持列表） |
| `ai-assistant.api-key` | string | **必填** | 模型 API Key |
| `ai-assistant.api-keys` | list | - | 多个 API Key（轮询负载均衡） |
| `ai-assistant.model` | string | 按 provider 自动 | 指定模型名称 |
| `ai-assistant.base-url` | string | 按 provider 自动 | 自定义 API 地址 |
| `ai-assistant.context-path` | string | `/ai-assistant` | REST 接口前缀 |
| `ai-assistant.max-tokens` | int | `2048` | 单次最大 token |
| `ai-assistant.temperature` | double | `0.7` | 生成随机性（0~2） |
| `ai-assistant.timeout-seconds` | int | `60` | 请求超时（秒），范围 1~600 |
| `ai-assistant.allowed-origins` | string | `*` | CORS 域名，逗号分隔 |
| `ai-assistant.system-prompt` | string | - | 自定义对话角色提示词 |
| `ai-assistant.access-token` | string | - | 接口鉴权 Token（不配=不鉴权） |
| `ai-assistant.rate-limit` | int | `0` | 每分钟每 IP/Token 请求上限（0=不限） |
| `ai-assistant.chat-max-total-chars` | int | `300000` | `/chat`、`/stream` 允许的输入总字符：`text` + `history` 各条 `content` 之和（`0`=不限制，生产不建议） |
| `ai-assistant.url-fetch-enabled` | boolean | `true` | 是否在调用模型前抓取用户消息中 **首个** http(s) URL 的正文 |
| `ai-assistant.url-fetch-max-bytes` | int | `524288` | 单次抓取的 HTML 响应体最大字节（约 512KB） |
| `ai-assistant.url-fetch-timeout-seconds` | int | `15` | 单次抓取超时（秒） |
| `ai-assistant.url-fetch-max-chars-injected` | int | `24000` | 注入模型前的纯文本最大字符，超出截断 |
| `ai-assistant.url-fetch-cache-ttl-seconds` | int | `90` | 同一 URL 的**截断正文**与**原始 HTML**内存缓存有效期（秒），`0` 表示关闭 |
| `ai-assistant.url-fetch-cache-max-entries` | int | `32` | 截断正文缓存最大条数；**HTML 缓存条数上限为 min(8, 本值)**，超出时淘汰 |
| `ai-assistant.url-preview-max-summary-chars` | int | `900` | `/url-preview` 返回的页面纯文本摘要最大长度（由 HTML 转文本后截取） |
| `ai-assistant.export-max-messages` | int | `2000` | `POST /export` 允许的最大消息条数（上限再夹紧到 50000） |
| `ai-assistant.export-max-total-chars` | int | `2000000` | `POST /export` 所有 `content` 字符总和上限（防爆内存，硬上限 20M） |
| `ai-assistant.export-pdf-unicode-font` | string | `classpath:/fonts/NotoSansSC_400Regular.ttf` | PDF 嵌入 **Noto Sans SC** TrueType（SIL OFL，字源 [expo/google-fonts](https://github.com/expo/google-fonts)）；**PDFBox 3.x 需 glyf 的 .ttf**，不要用常见 CJK **.otf（CFF）**；可改为 `file:///...` 或设 **`""` 清空**以退回 Helvetica（中文变空格） |
| `ai-assistant.chat-history-max-chars` | int | `48000` | 实际发往 LLM 的 `history` 各条 `content` 累计上限（从**最新**往前保留）；`0` 表示不截断 |
| `ai-assistant.url-preview-max-images` | int | `10` | `/url-preview` 返回的图片 URL 最大条数（服务端再夹紧到 ≤30） |

**完整配置示例：**

```yaml
ai-assistant:
  provider: deepseek
  api-key: sk-main
  api-keys:
    - sk-backup-1
    - sk-backup-2
  model: deepseek-chat
  context-path: /ai-assistant
  max-tokens: 4096
  temperature: 0.5
  timeout-seconds: 120
  allowed-origins: http://localhost:3000,https://your-domain.com
  system-prompt: "你是一个专业的技术顾问"
  access-token: my-secret-token
  rate-limit: 60
  # 链接抓取（可选）
  url-fetch-enabled: true
  url-fetch-timeout-seconds: 15
  url-fetch-max-chars-injected: 24000
```

### 链接正文抓取与重启后端（任意 Spring Boot 宿主）

本能力在 **`ai-assistant-server`** 模块内实现：只要你的业务已经引入 **`ai-assistant-spring-boot-starter`**，行为与是否使用本仓库的 demo **无关**。

1. **何时需要重启**  
   升级 Starter 版本、或修改了与 `ai-assistant` 相关的配置（含 `url-fetch-*`）后，必须让**宿主 Spring Boot 进程重新加载**：仅改前端或仅重建 jar 而不重启进程，**不会**生效。

2. **在任意服务里怎么重启（按你的部署方式选一）**  
   - **本地开发**：在 IDE 或终端 **停止**当前运行的 Java 进程，再重新 `Run` 主类，或重新执行 `mvn spring-boot:run` / `./gradlew bootRun`。  
   - **可执行 jar**：`mvn clean package` 生成新 jar → 替换部署目录中的 jar → 对服务执行 **先停后启**（Windows 服务、Linux `systemd`、自建脚本等均可）。  
   - **Docker / K8s**：构建新镜像并 **重新创建容器** 或 `kubectl rollout restart deployment/...`，使 Pod 使用新镜像/新配置。  
   - Spring Boot **DevTools** 在部分环境下会自动重启；涉及 Starter 类变更时，仍建议 **完整停止再启动** 一次，避免旧类缓存。

3. **关闭抓取**（例如内网不可出网、或安全审计要求）  

```yaml
ai-assistant:
  url-fetch-enabled: false
```

重启后生效。

4. **性能**：同一 URL 在缓存 TTL 内会复用已截断的正文（见 `url-fetch-cache-*`）；**同一 TTL 内也会复用原始 HTML 响应**（条数上限更严），便于 **LLM 抓取**与 **`/url-preview`** 紧挨着调用时只下载一次页面。对同一主机名的 SSRF DNS 判定有约 **5 分钟**进程内缓存。

### 前端配置项（app.use 选项）

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `baseUrl` | string | `/ai-assistant` | 后端接口地址前缀 |
| `primaryColor` | string | `#6366f1` | 主题色（十六进制） |
| `position` | string | `bottom-right` | 悬浮球位置 |
| `theme` | string | `light` | 主题：`light` / `dark` / `auto`（跟随系统） |
| `locale` | string | `en` | 界面语言：`en` / `zh` |
| `persistHistory` | boolean | `false` | 是否 localStorage 持久化对话历史 |
| `persistFabPosition` | boolean | `true` | 是否持久化悬浮球像素位置与贴边（`localStorage`） |
| `onAssistantError` | function | - | 错误回调（与 `@error` 并行），便于接入监控；参数 `{ source, message }` |
| `quickPrompts` | `{ label, text }[]` | - | 仅 **对话模式**：在输入框上方显示快捷按钮，点击将 `text` 填入输入框（不自动发送） |
| `openCodeInIde` | function | - | 可选；代码块显示 IDE 按钮，回调参数 `{ code, language? }` |
| `autoMountToBody` | boolean | `false` | 为 `true` 时插件在 `document.body` 下自动挂载助手（不需模板里的 `<AiAssistant />`）；勿与手动组件并用 |
| `enableSessionExport` | boolean | `false` | **已废弃**（保留字段避免配置报错）：单条导出已改为助手气泡**右键菜单**；配置项无实际作用 |
| `pageContextBlocks` | `{ selector, label? }[]` | - | 每次发消息前，用 `document.querySelector` 采集匹配元素的 **innerText**，按块拼入发给模型的 `text` 尾部（界面气泡仍只显示用户原话） |
| `pageContextMaxChars` | number | `12000` | 上述页面上下文最大总字符，超出截断 |
| `smartPageContext` | boolean | `true` | **常用**：未配置 `pageContextBlocks` 时，自动按 `main` → `[role=main]` → `article` → `#app` 取正文；`#app` 会克隆后移除 `.ai-assistant-wrapper` 等，避免把助手面板当页面。设为 `false` 可关闭（大型站点省 token） |
| `pageContextMinUserChars` | number | `12` | 用户输入短于该字数时**不**加 smart 页面上下文，避免只说「你好」也把整页说明发给模型导致长篇跑题；**不影响**手工配置的 `pageContextBlocks` |
| `maxMessagesInMemory` | number | `200` | 会话在浏览器内存中最多保留的消息条数，超出则丢弃最旧；`0` 表示不限制（长会话单页慎用） |
| `maxTotalCharsInMemory` | number | `4000000` | 所有消息 `content` 总字符上限，超出从头部丢整句；仅剩一条时才会硬裁该条；`0` 不限制 |
| `maxUserMessageChars` | number | `120000` | 用户单次发送正文最大字符，超出截断并加省略；`0` 不限制 |

**样式文件丢失时**：构建若报找不到 `AiAssistant.styles.css`，可在 `ai-assistant-ui` 目录执行 `py scripts/rebuild_styles.py`（依赖现成的 `dist/style.css` 会重写 `src/components/AiAssistant.styles.css`），再 `npm run build`。

**注意事项与调优（`autoMountToBody` / `pageContextBlocks`）：**

- **勿重复挂载**：`autoMountToBody: true` 时不要同时在模板里再写 `<AiAssistant />`，否则会出现两个悬浮球。
- **选择器语义**：每个配置项只对 **`document.querySelector(selector)` 的第一个匹配节点** 生效；需要多块内容请配置多条 `pageContextBlocks`。选择器写错或节点尚未渲染时，该块**静默跳过**（不抛错）。
- **体积与配额**：拼接后的全文会进入 `POST /chat`、`/stream` 的 `text`，需同时考虑后端 **`ai-assistant.chat-max-total-chars`** 与模型 **token**；页面很大时请**降低** `pageContextMaxChars`、设 **`smartPageContext: false`** 或收窄 `pageContextBlocks`。
- **显式优先**：只要配置了 `pageContextBlocks`，**不再**走 `smartPageContext` 自动探测。
- **短问候不带整页**：默认 `pageContextMinUserChars: 12`，避免只发「你好」时仍把演示页说明全文拼进请求，模型容易对着说明长篇发挥；需要短问题也带正文时可调低该阈值或改用 `pageContextBlocks`。
- **SSR**：`pageContext*` 与 `autoMountToBody` 依赖浏览器 `document`；若站点带服务端渲染，请仅在**客户端已挂载真实 DOM** 之后依赖上述能力（或关闭 SSR 测试相关路径、改用语根模板挂载 `<AiAssistant />`）。

**悬浮球与面板（`@ai-assistant/vue`）交互概要：**

- 打开面板时按悬浮球所在**视口象限**向对向胀开；标题栏可拖动；面板可从**边与角**缩放（顶角热区在标题栏下方，避免与按钮冲突）。若本会话**拖过缩放手柄**，关闭面板后悬浮球会**回到打开前的位置**（未拖动缩放则保留移动后的球位）。关闭后**恢复**打开前的左/右贴边或浮动状态。
- **`Esc`**：先关右键菜单，再关面板。
- **右键菜单**：贴左/贴右 / 取消贴边；已贴边时**隐藏**对应侧贴边项。
- **翻译 / 摘要 / 对话** 下发消息时，只要内容里带 **http(s) 链接**：**直连图片**会在用户气泡里 Markdown **出图**；**首个非图片链接**会请求 **`GET .../url-preview`**，预览图与摘要多挂在**助手**侧（用户气泡保持原文）；配图数量由后端 `url-preview-max-images` 控制（默认 10，上限 30）。与后端注入 LLM 的 URL 正文抓取相互独立。
- **单条导出 / 选区**：在**助手**气泡上**右键**：**复制选中**、**翻译选中**需在气泡内先划选文字；**翻译选中**在点击处以浮层流式显示译文（可选中文本），点空白或 **Esc** 关闭；**删除该条**删整句；若已配置 **`baseUrl`**，导出 Word / PDF / Excel 的正文取自**与界面一致的可见文本**（`innerText`）并附带气泡内 `<img>` 地址转成 `![](url)` 供服务端拉图（`blob:` 等本地地址服务端无法拉取）。
- **拖拽上传**：翻译/摘要模式下将文件**拖入对话区域**即可上传（与点选上传等价）；对话模式仍仅文本。
- **会话内搜索**：标题下方搜索框按正文**过滤消息**（流式生成中临时显示全部，避免卡住当前回复）。
- **代码块 IDE**：`app.use` 传入 `openCodeInIde({ code, language })` 时，代码块旁显示 **IDE** 按钮，由宿主自行打开本地协议或桌面端。

### 支持的模型

| Provider | 配置值 | 默认模型 | 默认 API 地址 |
|----------|--------|---------|---------------|
| OpenAI | `openai` | gpt-4o-mini | https://api.openai.com/v1 |
| DeepSeek | `deepseek` | deepseek-chat | https://api.deepseek.com/v1 |
| 通义千问 | `tongyi` 或 `qwen` | qwen-turbo | https://dashscope.aliyuncs.com/compatible-mode/v1 |
| 智谱 | `zhipu` | glm-4-flash | https://open.bigmodel.cn/api/paas/v4 |
| 火山引擎/豆包 | `volcengine` 或 `doubao` | 需手动指定 model | https://ark.cn-beijing.volces.com/api/v3 |
| MiniMax | `minimax` | MiniMax-Text-01 | https://api.minimax.chat/v1 |
| Kimi/月之暗面 | `kimi` 或 `moonshot` | moonshot-v1-8k | https://api.moonshot.cn/v1 |

---

## API 接口文档

### POST /ai-assistant/chat

同步调用 AI。

**请求体：**

```json
{
  "action": "translate",
  "text": "Hello world",
  "targetLang": "zh"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `action` | string | 否 | `translate` / `summarize` / `chat`（默认 chat） |
| `text` | string | 是 | 输入文本 |
| `targetLang` | string | 否 | 翻译目标语言：`zh` / `en` / `ja`（默认 zh） |
| `history` | array | 否 | 多轮对话历史（仅 chat），格式 `[{role, content}]` |

**响应：**

```json
{
  "success": true,
  "result": "你好世界"
}
```

**错误响应：**

```json
{
  "success": false,
  "error": "LLM call failed: ..."
}
```

### POST /ai-assistant/stream

SSE 流式输出，参数同 `/chat`。

返回 `text/event-stream`，每个事件是一段文本片段，拼接后即完整结果。

### POST /ai-assistant/file/summarize

上传文件并生成摘要。

| 参数 | 类型 | 说明 |
|------|------|------|
| `file` | multipart | 上传的文件 |

支持格式：`.txt` `.md` `.csv` `.pdf` `.docx` `.doc` `.xlsx` `.xls` `.json` `.xml` `.html` `.yml`，最大 10MB。对 **PDF / ZIP 系 Office（docx、xlsx）/ 老版 OLE（doc、xls）** 会做**文件头魔数**校验，扩展名与内容不符将直接拒绝，避免误触发重型解析。

### POST /ai-assistant/file/translate

上传文件并翻译。

| 参数 | 类型 | 说明 |
|------|------|------|
| `file` | multipart | 上传的文件 |
| `targetLang` | string | 目标语言（默认 zh） |

### GET /ai-assistant/url-preview?url=

从指定 **http(s)** 页面提取 **短摘要**（HTML→纯文本后截取，非 LLM 生成）、**og:title / &lt;title&gt;**、以及至多 **N 张**通过安全校验的图片（默认 **10**，配置项 `url-preview-max-images`，服务端硬顶 30；会过滤明显装饰图/分割线等）。优先 **twitter:image / og:image**，再按文档顺序扫 **&lt;img&gt;**。**兼容性**：`imageUrl` 字段仍等于 `imageUrls[0]`。

需与 URL 抓取相同的安全策略；`ai-assistant.url-fetch-enabled: false` 时本接口返回失败。

**成功示例：**

```json
{
  "success": true,
  "title": "Example",
  "summary": "Lead paragraph …",
  "imageUrl": "https://example.com/hero.png",
  "imageUrls": ["https://example.com/hero.png"]
}
```

**失败示例：**

```json
{ "success": false, "error": "no extractable summary or images" }
```

配置了 `access-token` 时须携带 `X-AI-Token`。

### POST /ai-assistant/export

将 **一组消息**导出为 **真 XLSX / DOCX / PDF**；响应头使用纯 ASCII `filename="..."`，减少浏览器「另存为」乱码。嵌入 UI 在助手气泡**右键**里通常只传**单条** `assistant`。仅当 classpath **同时**存在 **POI OOXML**（`XSSFWorkbook`）与 **PDFBox**（`PDDocument`）时自动注册该 Bean；否则 **404**（需依赖 `poi-ooxml` / `pdfbox`，见「文件上传」小节）。正文里 `![](http(s)://...)` 会在 DOCX/PDF 尝试拉图（SSRF 校验与体积上限）；`blob:` 等地址无法服务端拉取。

**请求体 JSON：**

```json
{
  "format": "xlsx",
  "title": "AI Assistant",
  "messages": [{ "role": "user", "content": "hi" }, { "role": "assistant", "content": "hello" }]
}
```

`format`：`xlsx` | `docx` | `pdf`。**PDF**：Starter **默认**嵌入 **NotoSansSC_400Regular.ttf**（[expo/google-fonts](https://github.com/expo/google-fonts/tree/main/font-packages/noto-sans-sc)，SIL OFL；**PDFBox 3.x 仅可靠支持 TrueType glyf**）。将 **`export-pdf-unicode-font`** 设为 **`""`** 则退回 Helvetica（中文成空格），或改为 `file:///...` 使用本机 .ttf。字体加载失败会打 WARN 并同样退回 Helvetica，避免整单 500。

配置了 `access-token` 时须携带 `X-AI-Token`。跨域时 Starter 已 **`Access-Control-Expose-Headers: Content-Disposition`**，便于前端 `fetch` 取建议文件名并触发浏览器下载。

### GET /ai-assistant/health

健康检查（不需要鉴权），返回 `{"success":true,"result":"AI Assistant is running"}`。

### GET /ai-assistant/stats

用量统计，返回示例：

```json
{
  "totalCalls": 42,
  "totalErrors": 2,
  "callsByAction": { "translate": 20, "chat": 15, "summarize": 7 },
  "callsByDate": { "2026-04-05": 42 }
}
```

---

## 使用指南

### Composable API（高级定制）

不使用悬浮球组件，直接在任意 Vue 组件中调用 AI：

```ts
import { useAiAssistant } from '@ai-assistant/vue'

const { loading, result, error, translate, summarize, chat, stream } = useAiAssistant()

// 翻译
await translate('Hello world', 'zh')
console.log(result.value) // "你好世界"

// 摘要
await summarize('很长的文章内容...')
console.log(result.value) // "摘要结果"

// 自由对话
await chat('什么是 Spring Boot?')
console.log(result.value)

// 流式调用
await stream('翻译这段话', { action: 'translate', targetLang: 'en' })
// result.value 会实时更新
```

### 监听组件事件

```vue
<template>
  <AiAssistant
    @send="onSend"
    @response="onResponse"
    @error="onError"
  />
</template>

<script setup>
function onSend({ action, text }) {
  console.log('用户发送:', action, text)
}
function onResponse(content) {
  console.log('AI 回复:', content)
}
function onError(message) {
  console.error('出错:', message)
}
</script>
```

### 程序化控制组件

```vue
<template>
  <AiAssistant ref="assistant" />
  <button @click="assistant.isOpen = true">打开助手</button>
</template>

<script setup>
import { ref } from 'vue'
const assistant = ref()
</script>
```

`defineExpose` 暴露的属性：`isOpen`、`messages`、`mode`、`targetLang`、`clearMessages`。

### 自定义 Provider

如果使用的模型 API 兼容 OpenAI 格式，只需配置 `base-url`：

```yaml
ai-assistant:
  provider: openai
  api-key: sk-xxx
  base-url: https://your-custom-api.com/v1
  model: your-model-name
```

### 鉴权配置

配置 `access-token` 后，所有接口（除 `/health`）需要携带 Token：

```yaml
ai-assistant:
  access-token: my-secret-token
```

前端请求方式：
- Header: `X-AI-Token: my-secret-token`
- 或 URL 参数: `?token=my-secret-token`

### API Key 轮询

配置多个 Key 自动负载均衡：

```yaml
ai-assistant:
  api-key: sk-main
  api-keys:
    - sk-key-1
    - sk-key-2
```

每次请求按 Round-Robin 方式切换 Key，均匀分摊额度。

### 速率限制

```yaml
ai-assistant:
  rate-limit: 60  # 每分钟每 IP 最多 60 次
```

超限返回 HTTP 429。按 IP 或 `X-AI-Token` 区分客户端。启用后 **`GET .../url-preview`** 与 **POST** 类接口一样计入配额（**`GET /health`**、**`GET /stats`** 及其余 GET 仍 exempt）。

### 文件上传

前端翻译/摘要模式下点击上传按钮选择文件。支持格式：

| 格式 | 需要依赖 |
|------|---------|
| TXT/MD/CSV/JSON/XML/HTML/YAML | 无需 |
| PDF | `org.apache.pdfbox:pdfbox:3.0.2` |
| DOCX/XLSX | `org.apache.poi:poi-ooxml:5.2.5` |
| DOC | `org.apache.poi:poi-scratchpad:5.2.5` |

### Demo 验证

本仓库 **Git 中不包含** `ai-assistant-demo`（见根目录 `.gitignore`）。集成后请在你的业务 Spring Boot 里引入 Starter 并配置 `ai-assistant.*`；若仍想在本地跑一份最小 Demo，可自行新建模块或从备份拷贝该目录。

历史上常用的本地命令示例（**仅当你的工作区里存在 `ai-assistant-demo` 目录时**）：

```bash
cd ai-assistant-server && mvn clean install
cd ../ai-assistant-demo
set GEMINI_API_KEY=你的密钥
mvn spring-boot:run
```

若 Demo 未改端口，可访问 `http://localhost:8080/`；**实际以你的服务为准**。

### 悬浮球 Playground（`ai-assistant-vue-playground`）

**此目录默认也不进入 Git**（`.gitignore`），需要时在本地自建或拷贝。Playground 是最小 **Vite + Vue 3** 壳，用于调试 **`@ai-assistant/vue`**；业务集成仍以 `app.use(AiAssistant, { baseUrl: '...' })` 为准。

**首次准备：**

```bash
cd ai-assistant-ui
npm install
npx vite build

cd ../ai-assistant-vue-playground
npm install
```

**与后端联调：**

1. 先启动**任意已集成 `ai-assistant-spring-boot-starter`** 的 Web 服务，并保证浏览器能访问到与插件 **`baseUrl`** 一致的接口（默认前缀为 **`/ai-assistant`**，也可在配置中改成别的路径）。
2. 若开发时通过 Vite 代理转发请求，请把 **`ai-assistant-vue-playground/vite.config.ts`** 里 `server.proxy['/ai-assistant'].target`**改成你的后端实际 origin**（本仓库自带的 `ai-assistant-demo` 仅为示例，可不必使用）。
3. 再启动 Playground：

```bash
cd ai-assistant-vue-playground
npm run dev
```

终端会打印本机地址与端口（默认 **5173**）。若发现端口变成 **5174、5175…**，通常是本机还有**未结束的旧** `npm run dev` 占用了端口，请在对应终端 **Ctrl+C** 结束后再启动；**以终端实际输出为准**。

**修改了 `ai-assistant-ui` 源码后（悬浮球组件、样式等）：**

1. 重新构建 UI 库：

```bash
cd ai-assistant-ui
npx vite build
```

2. **重启** Playground：在运行 `npm run dev` 的终端按 **Ctrl+C** 结束，再执行 `npm run dev`。

Playground 通过 `file:../ai-assistant-ui` 引用本地 **`dist`**；**未重新执行 `vite build` 则仍是旧构建**。

### 覆盖默认 Bean

宿主项目可以替换任意 Bean。`@ConditionalOnMissingBean` 下自定义 Bean 优先级高于自动装配。

若自定义 **`LlmService`**，构造方法需与 Starter 一致，注入 **`UrlFetchService`** 与 **`ChatCompletionClient`**（或在你自己的实现内自行发 HTTP、忽略 client）：

```java
@Bean
public LlmService llmService(AiAssistantProperties properties,
                             UrlFetchService urlFetchService,
                             ChatCompletionClient chatCompletionClient) {
    return new MyCustomLlmService(properties, urlFetchService, chatCompletionClient);
}
```

**导出（`/export`）与宿主自有组件**

- Starter 默认提供 `ConversationExportController` + `ConversationExportService`（POI + PDFBox，纯 Java，无 Pandoc/Chromium）。若宿主已有 **Word/PDF 流水线**（如基于模板、OpenHTML、LibreOffice、自研微服务），推荐：
  1. **保留契约**：仍对外提供 `POST {context-path}/export`，请求体为 `ExportConversationRequest`（`format`、`title`、`messages`），与前端 `postServerExport` 一致。
  2. **覆盖实现**：在宿主声明同路径的 `@RestController`，或 `@Bean @Primary ConversationExportService` / 自定义 `ConversationExportController`（视是否在自动装配中 `ConditionalOnMissingBean` 而定；必要时排除 Starter 中导出相关的 `@Configuration`）。
  3. **完全自建**：排除导出自动配置类，由宿主独占 `/export`，前端无需改（只要 URL 与 JSON 字段兼容）。

当前实现刻意避免「中间层」依赖，以降低部署复杂度；需要版式与字体完全一致时，以宿主侧成熟导出能力替换为宜。

---

## 项目结构

```
ai-assistant-sdk/
├── ai-assistant-server/       # Java Spring Boot Starter
│   ├── pom.xml
│   └── src/main/java/com/aiassistant/
│       ├── autoconfigure/     # 自动装配
│       ├── config/            # 配置属性 + CORS + 鉴权 + 限流
│       ├── controller/        # REST 接口（chat/stream/file/stats/health）
│       ├── model/             # 请求/响应 POJO
│       ├── service/           # LlmService、文件解析、URL 抓取；子包 llm（ChatCompletionClient）
│       └── stats/             # 用量统计
├── ai-assistant-ui/           # Vue 3 npm 包
│   ├── package.json
│   └── src/
│       ├── index.ts           # 插件入口
│       ├── components/        # AiAssistant.vue + AiAssistant.styles.css（scoped 样式，勿删）
│       ├── scripts/           # rebuild_styles.py：从 dist/style.css 反推样式源（应急）
│       ├── composables/       # useAiAssistant、useSessionSearch、useAiMarkdownRenderer
│       └── utils/             # HTTP / SSE / i18n、Markdown 代码块、客户端导出
├── ai-assistant-demo/         # （默认 .gitignore）本地 Demo，可选
├── ai-assistant-vue-playground/  # （默认 .gitignore）本地 Playground，可选
└── README.md
```

---

## 构建与发布

### 后端

```bash
cd ai-assistant-server
mvn clean install
```

安装到本地 Maven 仓库后，其他项目即可通过 `<dependency>` 引入。

发布到私有仓库：

```bash
mvn deploy -DaltDeploymentRepository=your-repo::default::https://your-nexus.com/repository/maven-releases/
```

### 前端

```bash
cd ai-assistant-ui
npm install
npm run build        # 构建 JS + CSS + 类型声明
```

发布到 npm：

```bash
npm publish --access public
```

---

## 常见问题

### Q: 文件上传报 `MaxUploadSizeExceededException`

Spring Boot 默认文件上传限制 1MB，需要增大：

```yaml
spring:
  servlet:
    multipart:
      max-file-size: 10MB
      max-request-size: 10MB
```

### Q: 上传 PDF/Word/Excel 报 `requires xxx dependency`

文件解析依赖标记为 `optional`，需要手动加入宿主项目：

```xml
<!-- PDF -->
<dependency>
  <groupId>org.apache.pdfbox</groupId>
  <artifactId>pdfbox</artifactId>
  <version>3.0.2</version>
</dependency>

<!-- Word (.docx) + Excel (.xlsx) -->
<dependency>
  <groupId>org.apache.poi</groupId>
  <artifactId>poi-ooxml</artifactId>
  <version>5.2.5</version>
</dependency>

<!-- Word (.doc 旧格式) -->
<dependency>
  <groupId>org.apache.poi</groupId>
  <artifactId>poi-scratchpad</artifactId>
  <version>5.2.5</version>
</dependency>
```

### Q: 启动报 `ai-assistant.api-key must be configured`

确保 `application.yml` 中配置了 `ai-assistant.api-key`。未配置时 Starter 不会加载（`@ConditionalOnProperty`），配置了空值则报此错。

### Q: 启动后 `/ai-assistant/health` 返回 404

1. 检查是否同时引入了 `spring-boot-starter-web` 和 `spring-boot-starter-webflux`
2. 检查 `ai-assistant.api-key` 是否已配置（未配置 = 自动装配不生效）
3. 检查是否有自定义 `context-path` 导致路径变更

### Q: 调用 AI 返回 `LLM call failed: Connection refused`

1. 检查 `provider` 和 `base-url` 是否正确
2. 检查服务器是否能访问对应的 API 域名（可能需要代理）
3. 国内服务器访问 OpenAI 需要配置代理或使用 `base-url` 指向代理地址

### Q: 调用超时

增大超时时间：

```yaml
ai-assistant:
  timeout-seconds: 180
```

或检查网络到 API 服务商的连通性。

### Q: 前端悬浮球不显示

1. 确认导入了 CSS：`import '@ai-assistant/vue/dist/style.css'`
2. 确认注册了插件：`app.use(AiAssistant, { ... })`
3. 确认**二选一**：模板中有 `<AiAssistant />`，**或** `app.use` 配置了 `autoMountToBody: true`（不要同时使用）
4. 检查浏览器控制台是否有 Vue 报错

### Q: 跨域报错

配置后端 CORS：

```yaml
ai-assistant:
  allowed-origins: http://localhost:5173,https://your-domain.com
```

或在开发环境使用 Vite 代理：

```ts
// vite.config.ts
export default defineConfig({
  server: {
    proxy: {
      '/ai-assistant': 'http://localhost:8080',
    },
  },
})
```

### Q: 如何使用自己部署的模型（如 Ollama）

只要模型 API 兼容 OpenAI 格式：

```yaml
ai-assistant:
  provider: openai
  api-key: ollama           # Ollama 不需要真实 key，随便填
  base-url: http://localhost:11434/v1
  model: llama3
```

### Q: 如何只用后端 API 不用前端组件

只引入 Maven 依赖 + 配置即可。前端可以自行调用 REST 接口：

```bash
curl -X POST http://localhost:8080/ai-assistant/chat \
  -H "Content-Type: application/json" \
  -d '{"action":"translate","text":"Hello","targetLang":"zh"}'
```

### Q: 如何替换默认的 LLM 调用逻辑

**推荐**：自定义 `ChatCompletionClient`，保留 `LlmService` 的 prompt 与消息拼装：

```java
@Bean
public ChatCompletionClient chatCompletionClient() {
    return new YourGatewayClient(); // 实现 complete / completeStream
}
```

若必须改写请求体字段、系统提示拼接或多轮工具循环，再提供自定义 `LlmService` Bean（需自行注入 `UrlFetchService` 等依赖）。

### Q: 接口返回 401 Unauthorized

配置了 `access-token` 后，所有请求需要携带 `X-AI-Token` 头：

```bash
curl -H "X-AI-Token: my-secret-token" http://localhost:8080/ai-assistant/chat ...
```

或不配置 `access-token` 即无需鉴权。

### Q: 接口返回 429 Too Many Requests

触发了速率限制。可以增大 `rate-limit` 值或设为 0 关闭：

```yaml
ai-assistant:
  rate-limit: 0  # 不限制
```

### Q: 日志在哪里看

日志使用 SLF4J，类名 `com.aiassistant.service.LlmService`：

```yaml
logging:
  level:
    com.aiassistant: DEBUG
```

### Q: 导出/另存为文件名像 `=?UTF-8?Q?...` 乱码

使用当前仓库后端（纯 ASCII `filename="..."`）并更新前端（`postServerExport` 优先解析 `filename="..."`），必要时强刷缓存。

### Q: 右键「导出」和气泡里看到的不完全一样

导出正文取自 DOM **`innerText`**，图片用 `<img src>` 拼成 `![](url)`；非源码 Markdown。PDF 仍有西文字体对中文的局限。

### Q: 「翻译选中」走什么接口、语气从哪来

与翻译模式相同：`POST .../stream`，`action: translate`；译向由选中内**中/英字符占比**推断，否则用下拉 `targetLang`。语气由 `LlmService` 翻译 system 提示（偏口语）与所配模型共同决定。

### Q: 导出 PDF 中文变成空格、排版很怪

默认已指向 starter 内置 **NotoSansSC_400Regular.ttf**（TrueType）；若在 yml 里 **`export-pdf-unicode-font: ""` 清空** 则会退回 Helvetica。若日志出现 **「CFF outlines are not supported」**，说明配置了 **OTF/CFF** 字体，请换成 **.ttf**。仍异常时检查字体是否被 fat-jar/自定义 ClassLoader 排除。版式要求高可优先 **DOCX** 或宿主自换 PDF 引擎。

---

## 性能（实现状态）

| 项 | 说明 |
|----|------|
| URL 正则与 HTML 清洗 | 预编译 `Pattern`，`htmlToPlain` 前超大 HTML **约 900KB 截断** |
| 同 URL 连续请求 | **截断正文** + **原始 HTML** 短 TTL 缓存；HTML 条数 **≤ min(8,正文缓存上限)** |
| SSRF DNS | 主机判定结果 **约 5 分钟**进程内缓存 |
| 悬浮球 | `resize` / visualViewport **`rAF` 合并**；自定义宽高后随窗口变化 **再夹紧** |
| 对话区 | 仅挂载**最近 60 条**（可展开全部）；`scrollToBottom` **rAF** 合并；`.ai-body` 内消息行 **`content-visibility: auto`** 减轻长列表绘制 |
| Markdown | `useAiMarkdownRenderer` 内 **LRU**；`hljsRegistered` **按需注册**常用语法（显著减小 `ai-assistant.mjs`）；无 `<pre><code` 时跳过代码块注入；**流式最后一泡**用 **无高亮** 的 `Marked` |
| 会话搜索 | 输入 **200ms 防抖** 后再过滤 |
| 浏览器内存 | 默认 **200 条** + **总字符约 4M** + 单次输入 **120k**（均可 `0` 关闭或调大） |
| 模型请求 | `chat-history-max-chars` 从末尾截断 **history**；`chat-max-total-chars` 校验整包 |
| LLM 排问 | 非 2xx 时日志中输出**响应体摘要**（限长） |
| 可选后续 | 虚拟滚动、抓取并发队列、Redis 统一限流 |

---

## 能力、风险与使用注意

**能力概要**：翻译/摘要/对话、SSE、Markdown 安全渲染、链接预览与配图、可选页面上下文、导出、上传、会话搜索、悬浮球贴边与多向缩放、后端 URL 注入 LLM、鉴权与进程内限流等（细节见上文表与交互概要）。

**主要风险**：外网抓取与 SSRF/滥用（限流、可关 `url-fetch-enabled`）；模型输出须仅走 DOMPurify 路径；密钥与 Token 防泄漏；长会话内存（已由默认上限缓解）；多实例限流/缓存进程内不一致；Starter 为中文 PDF **默认嵌入开源字体（SIL OFL，约 +10MB jar）**，介意体积或合规可申请 **`export-pdf-unicode-font: ""`** 或换路径。生产请配 **`rate-limit`**、**HTTPS** 与网关层配额。

**可扩展**：自定义 `ChatCompletionClient` / `LlmService`、RAG/工具调用、`onAssistantError` 接监控、`openCodeInIde` 等（见文首架构表）。

---

## 进一步扩展（未内置完整实现）

| 方向 | 说明 |
|------|------|
| **RAG / 知识库** | 需向量库、嵌入模型与 ingestion；建议独立模块，在调用 LLM 前拼接检索片段。 |
| **工具调用（Function calling）** | 依赖模型 API 的 tools/schema 与执行沙箱；建议自定义 `ChatCompletionClient` 或扩展 `LlmService` 做多轮 tool 循环。 |
| **多步任务规划** | Agent 状态机，通常与工具调用共同实现。 |
| **脚注 / 引用** | 需结构化 citation 或来源 URL，前端再渲染参考文献列表。 |

---

## License

MIT
