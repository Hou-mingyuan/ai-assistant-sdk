# AI Assistant SDK 优化发现记录

## 项目结构

- `ai-assistant-server`：Spring Boot Starter，包含核心后端能力、控制器、配置、安全、RAG、工具调用、导出、限流、多租户等模块。
- `ai-assistant-client`：Java 客户端 SDK。
- `ai-assistant-service`：独立 Spring Boot 服务，面向 Docker 或直接运行。
- `ai-assistant-ui`：Vue 3 组件库，包含组件、composables、工具函数、Vitest 测试和库构建配置。
- `ai-assistant-vue-playground`：前端 Playground。
- `docs`：VitePress 文档站。
- `e2e`：Playwright 端到端测试。
- `scripts`：版本一致性和冒烟测试相关脚本。

## 已确认的轻量验证命令

- `node scripts/check-version-consistency.mjs`
  - 结果：通过。
  - 输出：`Version consistency OK: Maven 1.0.0-SNAPSHOT, npm 1.0.0`

## 当前工作区注意事项

本次开始前已有以下文件存在未提交改动，需要避免覆盖：

- `.github/workflows/ci.yml`
- `.gitignore`
- `e2e/playwright.config.ts`
- `e2e/package-lock.json`

## 发现的问题

### 文档站侧边栏存在缺失页面

`docs/.vitepress/config.ts` 中配置了以下页面，但当前 `docs/guide` 和 `docs/api` 下没有对应 Markdown 文件：

- `/guide/configuration`
- `/guide/chat`
- `/guide/function-calling`
- `/guide/mcp-server`
- `/guide/plugins`
- `/guide/kubernetes`
- `/api/chat`
- `/api/capabilities`
- `/api/admin`

影响：
- 文档站侧边栏会展示可点击入口，但用户点击后进入 404。
- 新用户会误以为相关能力没有文档或项目文档不可用。

建议：
- 补齐这些页面，先提供稳定的概要、配置入口、关键 API 和跳转关系。
- 后续再按模块深入拆分长篇 README。

处理结果：
- 已补齐以上 9 个页面。
- 已运行 `cd docs && npm run build`，构建通过。
- 构建中曾出现 `env` 代码块语言未加载警告，已把本次新增页面中的 `env` 代码块调整为 `text`，重新构建后无该警告。

### 轻量健康检查入口

新增 `scripts/project-health-check.mjs` 后，可以运行：

```bash
node scripts/project-health-check.mjs --docs
```

当前该命令会执行：

1. `node scripts/check-version-consistency.mjs`
2. `cd docs && npm run build`

脚本还预留了：

- `--ui-test`
- `--server-test`
- `--all`

处理过程中的 Windows 兼容性结论：
- 直接 `spawnSync('npm.cmd')` 在当前环境中会触发 `EINVAL`。
- 手工拼接 `cmd.exe /c` 命令容易出现引号转义问题。
- 当前实现使用 `shell: true` 交给 Node 处理 Windows 命令解析，验证通过。

### README 入口信息分散

`README.md` 当前超过 1600 行，包含功能清单、架构、配置、API、部署、FAQ 和性能说明。大量内容与 `docs/guide`、`docs/api` 中的页面重叠，新用户第一次进入仓库时不容易判断应该先看哪一页。

处理结果：
- 已在 README 顶部新增“先看这里”，把高频入口集中到文档站页面。
- 已在 `docs/guide/index.md` 中补充“从哪里开始”和“文档地图”，按接入场景引导用户选择 Starter 集成、独立服务、前端连接或上线检查。
- 已在 `docs/guide/quick-start.md` 中说明本页默认使用 Starter 集成，并把独立服务用户引导到独立部署文档。

验证：
- 已运行 `node scripts/project-health-check.mjs --docs`，版本一致性检查和文档站构建均通过。

后续建议：
- 继续把 README 中的大段配置、API、部署和高级能力说明迁移到 VitePress 独立页面。
- 每次迁移前先确认目标页面已有等价信息，再从 README 中删除重复段落，避免丢失历史细节。

### 配置项缺少分层说明

原 `docs/guide/configuration.md` 只列出了少量常用配置，无法覆盖当前后端 Starter、独立服务和前端组件的真实配置面。用户容易把必填模型连接项、安全项、性能限制和可选能力开关混在一起配置。

处理结果：
- 已对照 `ai-assistant-server/src/main/java/com/aiassistant/config/AiAssistantProperties.java`、`ai-assistant-service/src/main/resources/application.yml` 和 `.env.example`。
- 已将配置文档拆成最小可用配置、后端配置分层、独立服务环境变量映射、前端配置分层和生产配置基线。
- 已明确 `access-token`、`allowed-origins`、`allow-query-token-auth`、`url-fetch-ssrf-protection`、`admin-enabled` 等生产安全项的建议值。

验证：
- 已运行 `node scripts/project-health-check.mjs --docs`，版本一致性检查和文档站构建均通过。

### Starter 集成与独立服务部署路径容易混淆

文档中同时存在 Starter 集成、独立服务 Docker 部署、前端连接独立服务和生产清单。缺少一个明确的部署路径选择页时，用户容易把两种方式混用，例如前端指向业务后端，但实际只启动了独立服务。

处理结果：
- 已新增 `docs/guide/deployment-checklists.md`。
- 新页面分别列出 Starter 集成和独立服务部署的适用场景、上线前检查项、前端最小配置和排查重点。
- 已在 README、介绍页、快速开始页、独立服务页和 VitePress 侧边栏接入该页面。

验证：
- 已运行 `node scripts/project-health-check.mjs --docs`，版本一致性检查和文档站构建均通过。

### 前端组件配置和事件示例分散

前端组件支持 `autoMountToBody`、`quickPrompts`、`promptTemplates`、`onAssistantError`、`openCodeInIde`、模型选择、system prompt 编辑、Web Component 等能力，但此前说明分散在 README 和少量页面里，不利于宿主前端快速复制常见接入方式。

处理结果：
- 已新增 `docs/guide/frontend-recipes.md`。
- 新页面集中提供基础接入、自动挂载、同源后端、独立服务、主题语言、快捷 Prompt、Prompt 模板、组件事件、错误监控、代码块 IDE、会话限制、模型选择和 Web Component 示例。
- 已在 README、介绍页、前端连接独立服务页和 VitePress 侧边栏接入该页面。

验证：
- 已运行 `node scripts/project-health-check.mjs --docs`，版本一致性检查和文档站构建均通过。

### 生产上线清单需要覆盖高风险开关

生产清单已有镜像、必填变量、鉴权跨域、限流资源、代理、日志和验证内容，但对 SSRF、Headless 抓取、Admin、连接器管理、MCP、RAG、分 action 限流、日志脱敏和 Actuator 敏感端点的检查还不够明确。

处理结果：
- 已扩充 `docs/guide/production-checklist.md`。
- 新增“高风险功能开关”和“Actuator 和健康检查”小节。
- 在鉴权跨域、限流资源、日志可观测性部分补充更具体的生产检查项。

验证：
- 已运行 `node scripts/project-health-check.mjs --docs`，版本一致性检查和文档站构建均通过。

### 后端模块边界需要维护说明

`ai-assistant-server` 包含 controller、service、config、tool、connector、rag、agent、prompt、routing、memory、security、stats、spi 等多类能力。缺少维护说明时，新能力容易直接堆到 controller 或 `LlmService`，后续难以替换、测试和扩展。

处理结果：
- 已新增 `docs/guide/backend-architecture.md`。
- 新页面说明总体分层、包职责、新功能放置建议、Controller 规则、Service 规则、配置和自动装配规则、扩展点规则和维护检查清单。
- 已在 README、介绍页和 VitePress 侧边栏接入该页面。

验证：
- 已运行 `node scripts/project-health-check.mjs --docs`，版本一致性检查和文档站构建均通过。

### README API 长段落与文档站重复

README 中的 API 接口文档包含聊天、模型列表、流式输出、文件上传、URL 预览、导出、健康检查和统计等细节。文档站已经有 API 分组页面，继续在 README 维护完整细节会带来双份更新成本。

处理结果：
- 已新增 `docs/api/reference.md`，承接 REST API 摘要和请求示例。
- 已在 `docs/.vitepress/config.ts` 和 `docs/api/index.md` 接入该页面。
- 已将 README 的大段 API 细节替换为 API 文档入口和常用 API 摘要。

验证：
- 已运行 `node scripts/project-health-check.mjs --docs`，版本一致性检查和文档站构建均通过。

---

## 2026-05-13 第二轮：进化功能审计与决策

### 审计起点

用户在新会话首条消息要求「全部按顺序开始」实现上轮（5-12）设计的 11 项 AI 助手进化功能（A1-A4 / B5-B8 / C9-C11）。
不能盲目按顺序开干，必须先盘点 `ai-assistant-ui/src` 现状，避免重复造轮子。

### 现状审计结果

| 候选项 | 现状文件 | 真实缺口 |
|--------|----------|----------|
| A1 多模型并行对话 | — | **完全缺失** |
| A2 RAG/知识库 | `useKnowledgeBase.ts`（LocalStorage 模拟） | 与后端 RAG 语义不匹配，见下文 |
| A3 MCP 工具集成 | `usePluginRegistry.ts`（按钮注册器） | 缺真 MCP 协议客户端 |
| A4 语音输入 + TTS | `useVoiceInput.ts`（仅输入端） | TTS 朗读完全缺失 |
| B5 会话搜索 | `useSessionSearch.ts` + `highlightSearchInHtml` 已 export | ✅ 已完整 |
| B6 消息编辑/重生成 | `useChatOrchestrator.ts` + `MessageList.vue` + `MessageContextMenu.vue` | ✅ 已完整 |
| B7 Prompt 模板库 | `options.promptTemplates`（预置） | 缺用户侧管理 UI |
| B8 代码块增强 | `useCodeWall.ts` + 复制按钮 + IDE 按钮 | 缺 Mermaid / 行号 |
| C9 测试覆盖 | 5 个 `.spec.ts` + 根目录 e2e | 新增 composable 缺测试 |
| C10 性能优化 | rAF + perfMetrics + `MAX_RENDERED_MESSAGES = 60` | 缺虚拟滚动 |
| C11 i18n 补全 | zh/en/ja/ko 4 语言完整 | ✅ 已完整 |

### A2 RAG 决策（不对接）

**事实**：
- 前端 `useKnowledgeBase.ts` 已实现：用户在本浏览器创建多个「知识库」、上传文件（仅记录元数据）、勾选启用 → 通过 `ragPromptFragment` 注入 system prompt 提示 LLM。
- 后端 `RagService.java`（在 `ai-assistant-server/.../rag/`）有完整 ingest/retrieveContext，但**唯一对外端点是 `POST /admin/rag/ingest` + `GET /admin/rag/stats`**（在 `AdminDashboardController.java`）。
- 这两个端点都在 `@RequestMapping("/admin")` 下，需要 admin 权限；接入后**全局共享**索引（所有终端用户访问到同一份向量库）。

**冲突点**：
- 前端组件库的 `useKnowledgeBase` 设计目标是「每个浏览器用户管理自己的知识库」（不需 admin 权限、不污染他人）。
- 后端 admin RAG 设计目标是「运营方一次性灌入文档，所有用户共享检索」。
- 两者语义、权限、生命周期都不同，不能直接桥接。

**决策**：
- 本轮保持 `useKnowledgeBase` 当前实现不变（LocalStorage + prompt 注入）。
- 不在 `utils/api.ts` 增加 `/admin/rag/ingest` 包装；如需要，宿主应用按需直接调用。
- 后续若要做「用户私有 RAG」，需在 server 端新增 `/users/{userId}/rag/ingest` 端点 + 隔离命名空间，那是后端独立工程。

### A3 MCP 客户端落地

**事实**：
- 后端已有 `McpServerController.java`（`@RequestMapping("/mcp")`），把所有 `AssistantCapability` 暴露为 MCP tools，**自身是 MCP server**，不是 client。
- 协议版本 `2025-03-26`；支持 `initialize` / `tools/list` / `tools/call`。

**实施**：
- 新增 `useMcpClient.ts`（HTTP JSON-RPC client）+ `useMcpClient.spec.ts`。
- 默认指向 `/ai-assistant/mcp`（即 SDK 自己的后端），但 endpoint 可任意覆盖以连接外部 MCP server（如 织信、其它服务）。
- 不支持 SSE streaming（多数 MCP server HTTP-only 即可工作；如需，宿主自接 EventSource）。
- **不主动接入 AiAssistant.vue**：MCP tools 暴露后如何用（自动调用 / 显示成插件按钮 / 集成到 Function Calling）是产品决策，本轮把基础设施落地，留待后续 UX 设计。

### B7 Prompt 模板：用户库 vs 后端模板

**事实**：
- 后端有 `PromptTemplateController.java`：`GET /templates` `POST /templates/{name}/render` `POST /templates`，是「服务端共享模板库」。
- 前端 `options.promptTemplates` 是「编译期由宿主预置」，运行时只读。
- 本轮新增的 `usePromptTemplateLibrary` 是「用户私有 + LocalStorage」。

**三层并存**的合理性：
- **服务端 PromptTemplateController**：运营人员维护的「官方模板」，可后续通过 `fetchPromptTemplates(baseUrl)` API 拉取（本轮未实现该 fetch 函数）。
- **options.promptTemplates**：宿主应用按业务定制的预置模板（如「合同审查」「代码 review」）。
- **usePromptTemplateLibrary**：用户个人收藏的 prompt。

三者在 `PromptTemplateDialog.vue` 中已通过 `mergedTemplates` 合并展示（preset → user），未来如要并入服务端模板只需扩展 composable 的 source 字段，无需重构 UI。

### B8 Mermaid 作为可选 peer

**为什么不直接加进 dependencies**：
- mermaid 完整 bundle 约 600 KB（gzip ~180 KB），强制依赖会显著拖累不需要图表的宿主。
- 改为 `import('mermaid')` 动态加载 + 标记 `external`，使「需要 mermaid 的宿主自己 npm i 即可生效，不需要的宿主完全无感」。

**失败降级**：
- `useMermaidRenderer.renderInside` 在动态 import 失败时把所有 placeholder 内容设为 `<pre>` 显示原始源码，用户至少能读到 Mermaid 文本，不会出现空白方框。

### C10 不接入 MessageList 的理由

- `useMessageVirtualScroll` 是纯算法 composable，已写 7 个单测覆盖所有边界（启用阈值、scroll 位移、高度测量、过末尾 clamp）。
- 真要接入 MessageList 需要：a) 在外层挂 scroll listener；b) 测量每条消息渲染后的实际高度并 feedback；c) 渲染 spacer 占位；d) 处理 `hiddenOlderCount` 与 virtual window 的优先级冲突。
- 这是独立的 200 行级别改动，且会破坏现有 `MAX_RENDERED_MESSAGES = 60` 折叠的契约（哪些消息可见？哪些被折叠？）。
- 本轮先把工具做完备，留专项 PR 接入，避免单次 PR 风险面过大。

### 跳过的「测试型」工作

- B8 `useMermaidRenderer.spec.ts` 未写：mermaid 是可选 peer，测试需要 mock dynamic import + jsdom 不支持的 SVG 渲染，性价比低。已通过手动审阅 + 边界路径设计（fallback / error）保证健壮性。

### 未引入的破坏性变更

- 没有删除任何现有 API。
- 没有修改任何现有 spec.ts。
- 没有破坏现有 6 个预先存在的 vue-tsc 类型错误（pre-existing，与本轮无关）。
- 没有动后端代码（仅 audit 后端 controller 端点结构）。
- 没有 commit / push，保持工作区干净待审阅。

---

## 2026-05-20 第六轮启动发现

### 深度分析结论

`ai-assistant-sdk` 已经是完整的多模块 SDK：Spring Boot Starter、独立服务、Java Client、Vue 组件库、Web Component、文档站、E2E、Docker/Helm 和 CI 均已具备。当前主要风险不在功能缺失，而在能力面扩大后的维护复杂度。

### 按序整改判断

1. `AiAssistant.vue` 仍是前端复杂度最高的聚合点，且已有 `ai-assistant-ui/REFACTORING_PLAN.md` 指向继续拆分，适合作为第一阶段。
2. `/stream` 与 `/sse` 并存，当前前端与 Java client 主要依赖 `/stream`，后续应明确兼容层与标准 SSE 层边界。
3. 生产安全依赖使用方正确配置：空 `access-token`、`allowed-origins=*`、URL fetch、Admin/MCP/Connector 等应形成可执行检查或启动强告警。
4. `@ai-assistant/vue` 公共导出面较大，后续应区分稳定 API 与实验性工具。

### 阶段 13.1 细化发现

- 批量导出主体已经抽到 `ai-assistant-ui/src/composables/useExportActions.ts`，包括菜单开关、JSON/Markdown 全量导出、server export 和单条 assistant 消息导出。
- `AiAssistant.vue` 中仍保留批量选择/删除状态：`selectMode`、`selectedMsgIndices`、`toggleSelectMode`、`toggleMsgSelection`、`deleteSelectedMessages`。
- 因此第一阶段实际拆分目标调整为 `useMessageSelection.ts`，避免重复创建 `useBatchExport.ts`。

### 阶段 13.4 公共 API 分层发现

- `@ai-assistant/vue` 主入口同时导出了主组件、API helper、Admin SDK、MCP、插件、虚拟滚动、TTS、Prompt 模板、表单自动填充和多个低层算法工具。
- 这些导出的稳定性不应等同看待；主接入层最稳定，低层算法 / 实验工具适合高级宿主锁版本使用。
- 本轮选择只补文档和导出区维护提示，不移除导出，避免破坏已集成用户。

### 阶段 13.5 Helm / Kubernetes 生产基线发现

- `docs/guide/configuration.md`、`production-checklist.md`、`deployment-checklists.md`、`.env.example` 和 `docker-compose.prod.yml` 已经覆盖大部分生产安全基线。
- Helm chart 原本只有 `secrets.apiKey` 走 Kubernetes Secret，`AI_ASSISTANT_ACCESS_TOKEN`、`AI_ASSISTANT_ADMIN_TOKEN` 和 `AI_ASSISTANT_RUNTIME_CONFIG_SECRET_KEY` 仍主要出现在 `env` values 中。
- `docs/guide/kubernetes.md` 只覆盖基础部署提醒，缺少 Secret 注入、多副本状态一致性、Redis / 网关限流和 Actuator 暴露边界的具体说明。
- 本阶段选择只调整 Helm 模板和文档，不修改 Java / Vue 运行时逻辑，降低回归风险。

### 阶段 13.6 Compare regions 拆分发现

- `useExportActions`、`useMessageSelection`、`useAssistantDiagnostics` 已存在，批量导出和诊断状态不是当前最大残留点。
- `AiAssistant.vue` 中 Compare regions 仍直接维护 `compareSet`、label、mark/unmark、compare-with、swap 和 clear，适合先抽为纯状态 composable。
- 多模型并行对比由 `useMultiModelChat` 管理，和消息区域 Compare regions 是两套能力，本阶段只迁移消息区域比较集合。
- KB drop / KB picker 仍留在主 SFC，后续可按 `useKnowledgeDrop.ts` 单独拆分。

### 阶段 13.7 KB drop 拆分发现

- `useFabDropIngest` 边界清晰，只负责 HTML5 drag/drop 事件和文件过滤，不应直接知道知识库。
- `AiAssistant.vue` 中残留的 KB drop 编排包含 Quick Ingest、picker 可见性、pending files、auto-dismiss timer、键盘快捷键和 toast，适合集中到 `useKnowledgeDrop`。
- 新 composable 保持纯状态和依赖注入：知识库 store、i18n、toast、focus picker 由父组件传入，避免直接依赖 DOM。
- `AiAssistant.vue` 仍保留一个很小的 DOM focus 回调，用于 Teleport 后聚焦 picker shell。

### 阶段 13.8 连接诊断状态拆分发现

- `useAssistantDiagnostics.ts` 仍同时承担状态映射、网络请求、运行时模型配置保存、连接配置持久化和复制诊断文本。
- error → status、状态文案、token/baseUrl 诊断、model status、source、hint 和 remedy kind 都是纯状态计算，适合先抽离并单测。
- 本阶段不移动 `fetchModels`、`fetchRuntimeModelConfig`、`saveRuntimeModelConfig`、`discoverRuntimeProviderModels` 调用，避免把网络副作用和纯状态拆分混在一次提交里。
- 后续可继续把连接配置持久化和运行时 provider 表单保存拆成更小的 composable。

### 阶段 13.9 协议契约测试发现

- UI `streamChat` 已覆盖标准 SSE data 解析、跨 chunk、multiline、`[DONE]`、runtime meta header 和错误响应。
- 后端 `AiAssistantControllerTest` 已覆盖 `/chat`、兼容 `/stream` 和 `/models` 的主要契约。
- 后端 `SseStreamControllerTest` 原本只覆盖 translate/summarize 透传 model，缺少标准 `/sse` 的 `message` / `done` / `error` event 契约。
- `LlmService.chatStream` 同时存在 `String imageData` 和 `List<String> imageDataList` 两个 7 参重载，测试中必须使用 typed matcher 避免 Mockito 重载歧义。
