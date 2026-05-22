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

### 阶段 13.10 依赖分层发现

- Starter 中 Web/WebFlux/WebSocket/Actuator、Redis、JDBC、Resilience4j、Tracing、OTLP、Playwright、Springdoc、Logstash 等依赖已标 optional。
- PDFBox/POI 当前不是 optional，因为 `/export` 和文件处理运行时直接依赖；如果未来拆分，需要独立 feature artifact 和清晰启动提示。
- 独立服务显式带 Web/WebFlux/WebSocket/Actuator/JSON logging，但默认不带 Redis/JDBC/Playwright。
- 前端 Mermaid 保持动态 import / 宿主 opt-in，不在 `@ai-assistant/vue` 默认 dependencies 中。

### 阶段 13.11 连接配置状态拆分发现

- `useAssistantDiagnostics.ts` 中连接配置输入、localStorage 持久化和默认 baseUrl 提示是纯状态逻辑，不依赖网络请求。
- 将这部分拆到 `useConnectionConfigState` 后，`useAssistantDiagnostics.ts` 中剩余的主要职责是运行模型诊断、保存 runtime provider 配置、发现模型和复制诊断文本。
- localStorage 写入仍做 try/catch，保持原有“不可用或满容量时不影响 UI”的行为。

### 阶段 13.12 Runtime provider 表单状态拆分发现

- runtime provider 表单输入、从 sanitized config 回填、保存 payload 构造和 discover models 回填都是纯状态转换。
- 拆出 `useRuntimeProviderConfigState` 后，`useAssistantDiagnostics.ts` 的 provider 相关代码只保留 API 调用成功/失败和状态消息处理。
- API key 仍保持 write-only：读取 runtime config 后会清空 `providerApiKeyInput`，避免把已配置密钥回显到 UI。

### 阶段 13.13 Java Client stream 契约发现

- `AiAssistantClientTest` 已覆盖 chat 错误处理、token header、builder 校验、stream SSE 空格保留。
- 本阶段补齐 `chatStream(text, systemPrompt, model, onChunk)` 的请求契约，确保 Java Client 与官方 `/stream` 兼容端点保持一致。

### 阶段 13.14 服务端 stream 契约发现

- `AiAssistantController.stream` 对输入超限走 HTTP 400 + text/event-stream body，内容以 `[VALIDATION_ERROR]` 前缀给前端展示。
- LLM stream 中途失败不会让 Servlet 直接变成 HTTP 500，而是通过 `fluxWithFriendlyErrors` 转成单个友好错误 chunk。
- `/stream` 仍是官方 UI 和 Java Client 的兼容端点；typed event 需求继续由 `/sse` 覆盖。

### 阶段 13.15 Runtime config 后端契约发现

- `RuntimeConfigControllerTest` 已覆盖只读 `/runtime/config` 的安全摘要、密钥不泄露、feature flags 和 limits。
- `RuntimeModelConfigController` 原本没有 controller 层测试；service 层已有更新、持久化、discover models 覆盖。
- 本阶段补 controller 层契约，确保 Admin runtime model config 的响应仍保持 sanitized / write-only API key 语义。

### 阶段 13.16 行尾噪音发现

- 仓库已有 `.gitattributes`、`.editorconfig` 和前端 `.prettierrc`，三者均要求 LF。
- 当前 `git status` 显示大量 modified，但这些文件大多没有可展示的 text patch；属于 CRLF/LF 或 status-only 噪音，不能混入功能提交。
- 新增的 `scripts/line-ending-noise-check.mjs` 能把真实内容 diff 与 line-ending/status-only diff 分开展示。
- 本阶段不做全仓行尾重写，避免制造 80+ 文件的纯行尾 review 噪音。

### 阶段 13.17 OpenAPI 类型同步发现

- `scripts/generate-frontend-types.mjs --check` 已存在，但需要运行中的 `/v3/api-docs` 和 `openapi-typescript` npx codegen，不适合作为本阶段最小 CI 改动。
- 当前 `ai-assistant-ui/src/types/api-generated.d.ts` 只覆盖聊天相关 wire contract：`ChatRequest`、`ChatResponse` 以及 `/chat`、`/stream`、`/sse` 请求体。
- 轻量 guard 先覆盖 `AiAssistantController`、`SseStreamController`、`ChatRequest`、`ChatResponse` 这 4 个文件；如果它们变更但 `api-generated.d.ts` 未变更，PR 失败。
- 这不是完整 live OpenAPI drift check。后续要扩大到所有 REST DTO 时，应先扩大 generated snapshot 或引入静态 `docs/api/openapi.json`。

### 阶段 13.18 Diagnostics clipboard 拆分发现

- `useAssistantDiagnostics.ts` 中复制诊断文本逻辑是纯 UI side effect：构造文本、写剪贴板、设置 copied 状态和 timer 清理，不依赖网络请求。
- 这部分适合独立成 `useDiagnosticsClipboard.ts`，既能被单测覆盖，也让 `useAssistantDiagnostics.ts` 更专注于模型/连接诊断编排。
- `writeClipboardText` 仍被 `AiAssistant.vue` 的消息复制功能复用，因此迁移到新文件后需要同步调整导入路径。

### 阶段 13.19 Feature artifact 拆分路线发现

- 当前默认 Starter 仍承担基础聊天、导出、文件解析、RAG、连接器、Headless、观测扩展等多类能力，依赖足迹对“只要聊天”的宿主偏重。
- 最适合优先拆的是已经接近 optional 的 Headless / Observability；风险最低。
- PDFBox/POI 是依赖足迹重点，但 `/export` 和文件解析已有公开 API，拆分前必须提供缺依赖时的明确提示，不能让用户遇到运行期 500。
- RAG / Connector 涉及管理面、工具注册、安全和存储一致性，适合最后拆。

### 阶段 13.20 前端公共 API 收窄发现

- `package.json` 已有 `./admin`、`./mcp`、`./form-fill`、`./screenshot`、`./wc` 等二级入口，适合承接高级能力。
- 主入口 `src/index.ts` 仍保留大量高级导出以兼容历史用户；本阶段不删除导出，只强化文档和注释约束。
- 新项目应优先按能力从二级入口导入，后续新增高级 helper 默认不再加入主入口。

### 阶段 13.21 OpenAPI 静态 spec 输入发现

- live `/v3/api-docs` drift check 需要启动后端和 springdoc 暴露，CI 成本与失败面较大。
- 先让 `generate-frontend-types.mjs` 支持 `--spec-file`，可以把“读取 spec”与“生成/比对类型”解耦。
- 后续只要提交 `docs/api/openapi.json` 快照，就能在 CI 中运行 `--spec-file docs/api/openapi.json --check`，不需要每次启动服务。

### 阶段 13.22 静态 OpenAPI 快照发现

- `docs/api/openapi.json` 先覆盖前端当前最常用的 REST wire types，不一次性扩到所有 Admin / Connector / Async DTO。
- `api-generated.d.ts` 现在由 `openapi-typescript` 生成，替代原先手写临时快照。
- `utils/api.ts` 中模型列表、runtime config、URL preview、prompt template 等类型已改为 generated schema alias。

### 阶段 13.23 Diagnostics model requests 拆分发现

- `useAssistantDiagnostics.ts` 中网络请求编排可独立测试，依赖面是 options、若干 refs、provider state 回调和 API 函数。
- 抽成 `useDiagnosticsModelRequests.ts` 后，API 函数可注入，单测无需 mount Vue 组件或 mock 全局 fetch。

### 阶段 13.24 依赖足迹护栏发现

- 直接做 core-only starter artifact 拆包风险较高，先用脚本守住 optional 依赖边界更稳。
- `dependency-footprint-check` 能防止低频能力意外退化为 starter 默认依赖，为后续拆包提供 CI 护栏。

### 阶段 13.25 包体归因发现

- 当前 baseline gzip 构成中 main 约 464 KB，feature chunks 约 280 KB，Web Component 约 224 KB，secondary entries 约 6.5 KB。
- secondary entries 体积很小，说明继续把高级能力留在子入口是正确方向；主入口瘦身应优先分析 main 与 feature chunks 的关系。

### 阶段 13.26 Core entry 瘦身路径发现

- 直接从主入口移除高级导出会破坏历史用户，不适合作为小版本改动。
- 新增 `@ai-assistant/vue/core` 可以先提供更窄的接入入口，后续文档示例可逐步引导新用户使用 core 或专门子入口。
- `core.mjs` 本身非常小，但它仍会指向核心插件；真正降低宿主最终体积还需要后续继续拆主组件内部静态依赖。

### 阶段 13.27 Core plugin 隔离发现

- 将 core entry 改为直接依赖 `core-plugin.ts` 后，`core` 不再经过 `index.ts` 的高级 re-export 面。
- Vite library build 会把核心实现放到共享 chunk，`ai-assistant.mjs` 主入口本身显著变小；这为后续逐步移除主入口高级导出提供了可验证路径。
- 当前仍保留主入口历史导出，真正 breaking removal 可以放到后续 v2 changelog / migration guide 中处理。

### 阶段 13.28 Admin DTO generated schema 发现

- Admin SDK 的类型面主要是简单响应 DTO，适合先迁移到静态 OpenAPI components，不必一次补全所有 Admin paths。
- `AdminAbTestConfig` 保留 `additionalProperties: true`，兼容后端可扩展配置 map。
- `adminApi.ts` 迁移为 generated schema alias 后，仍保留 `AdminResult<T>` 包装类型作为前端 SDK 自己的错误归一化协议。

### 阶段 13.29 Core-only starter 验证发现

- 当前 starter 在缺少 Redis/JDBC/Playwright/OpenAPI/Tracing/Logstash 等低频依赖时，基础聊天自动装配仍可启动。
- 这说明后续拆 feature artifact 时可以先围绕这些 optional 能力推进；PDF/POI 仍是更晚阶段的高风险拆分点。

### 阶段 13.32 Admin path-level OpenAPI 发现

- `adminApi.ts` 的公开函数已经稳定对应一组 `/admin/*` routes，适合先补 path-level OpenAPI snapshot，而不是一次扩全仓 REST paths。
- Admin SDK 仍需要保留 `AdminResult<T>`，因为它是前端调用层的错误归一化协议；OpenAPI 只描述后端 200 JSON payload。
- request body schema 适合从 paths 派生，能减少 `adminApi.ts` 中 `{ success: ... }` 等手写 inline 类型继续扩散。

### 阶段 13.33 Public path-level OpenAPI 发现

- 非 Admin endpoints 中不少 Controller 返回 `Map<String,Object>` 或 JSON 字符串，静态快照适合先用“稳定字段 + additionalProperties”的方式描述，不宜为了 OpenAPI 过度收紧服务端实现。
- 文件上传和导出需要分别用 `multipart/form-data` 与 `application/octet-stream` 表达，否则 generated paths 会误导前端把它们当普通 JSON API。
- Runtime model discovery 是 Admin runtime config 的子路径，但没有 request body；测试应只要求 responses 覆盖，不能强行要求 JSON body。

### 阶段 13.34 Frontend API path-level 类型发现

- `api.ts` 里仍有通用 helper 需要保留前端自己的归一化结果类型，例如 `PromptTemplatesListResult` 和 server export 的 `{ ok }` 下载结果；OpenAPI 类型只适合作为 wire payload 的来源。
- 用临时 TypeScript probe 做脚本测试，比把类型断言塞进 `*.spec.ts` 更可靠，因为前端 `tsconfig.json` 明确排除了 spec 文件。
- `RuntimeDiscoverModelsResult` 需要显式 schema，否则从 `additionalProperties` 生成的类型太宽，不能给调用层提供实际约束。

### 阶段 13.35 OpenAPI sync guard 发现

- 静态快照覆盖范围扩大后，原 guard 只盯 ChatRequest/ChatResponse 已经不够，会漏掉 Session、Export、Connector、Async、Capability 等契约漂移。
- 仅检查 `api-generated.d.ts` 不足以防止手工改 generated types；后端契约变更时应同时要求 `docs/api/openapi.json` 与 generated types 更新。
- OpenAPI snapshot 单独变化也必须要求 generated types 更新，否则 `--spec-file --check` 会在后续 CI 才发现漂移。

### 阶段 13.36 OpenAPI 文档同步发现

- `docs/guide/openapi-typescript-codegen.md` 仍停留在 chat-only 阶段，会误导后续维护者只更新 `api-generated.d.ts`。
- 文档需要明确 `docs/api/openapi.json` 是当前 reviewed contract，generated types 是由它派生的产物，两者应一起 review。
- 当前更现实的后续路线不是继续扩大 paths 数量，而是做 release-time snapshot refresh 和逐步收紧 broad schema。

### 阶段 13.37 下一轮 1-4 推进发现

- Release-time refresh 不应自动启动后端；脚本只负责从 live URL 或已导出的 spec 文件刷新 snapshot，并复用现有 generator。
- `UsageStats` 和 batch response 已有稳定字段，适合先收紧 schema；仍返回自由结构的能力保持 broad schema，避免和实现脱节。
- OpenAPI support 当前是独立 auto-configuration，适合用显式 enable 的 bean wiring 测试作为 Observability/Support 拆分前置护栏。
- `AiAssistant.vue` 中服务端模板刷新逻辑是低风险可抽离切口，抽出后主 SFC 少承担一个远端模板编排职责。

### 阶段 13.38 下一轮继续推进发现

- `refresh-openapi-snapshot --check` 应只做 dry-run 比对，不写 snapshot；这样 release lane 可以安全地验证 live/exported spec 是否漂移。
- Connector/provider health 的 status 值在实现中已经是固定集合，收紧 enum 不会改变运行时行为，却能让 generated types 更有用。
- Prompt template 的弹窗交互可以继续独立于模板数据来源拆分，后续再接 command palette 触发时不必回到主 SFC。
- Observability artifact 真拆前需要先把候选范围写清楚，尤其要排除 PDF/Office、RAG、Connector、Headless 这些不同风险面的能力。

### 阶段 13.39 Module skeleton 与 release-check 发现

- 新增空 module skeleton 可以先验证 reactor 与发布坐标，不急于迁移 production auto-configuration，降低 v2 拆包第一步风险。
- `project-health-check --release-check` 适合承接 refresh dry-run；这样 release lane 同时验证 snapshot 格式与 generated types。
- quick prompt 过滤逻辑是另一个低风险 SFC 瘦身切口，和 prompt template interaction 不共享状态，可独立抽离。
- bundle baseline 更新确认当前构建输出已被记录；后续体积回归判断会基于最新 chunk/hash 结构。

### 阶段 13.40 全部推进发现

- Observability support module 目前仍不适合一次性迁移 tracing/logstash/health/metrics 的生产类；先把 Spring Boot auto-configuration metadata 放进 support artifact，可以验证 artifact 边界，又不删除 starter 里的兼容类。
- `AiAssistant.vue` 里 quick prompt button、empty-state prompt template、slash `/template` 和 command palette prompt 入口本质上都是“把 prompt 写入输入区或打开模板库”，适合统一到 `useAssistantPromptCommands`。
- `useBuiltInCommands` 以前每次 watch 都会 `clear()` 后重新注册 built-in commands，因此外部单独 register 的 prompt commands 会被覆盖；新增 `extraCommands` 比在组件里手动补 register 更稳定。
- OpenAPI refresh dry-run 失败时只说 stale 不够定位；path/schema key 的新增删除已经能覆盖大多数 release drift 判断，字段级差异保留给 review diff。
- Bundle baseline review 最常见的问题是“不知道变化来自新增 chunk、删除 chunk 还是已有 chunk 变胖”，新增/删除/增长/缩小摘要比只看 top table 更容易审查。

### 阶段 13.41 继续推进发现

- OpenAPI support 的安全迁移点是 metadata 归属，不是立即删除 implementation class。将 starter metadata 移除、support metadata 保留、standalone service 显式依赖 support，可以同时实现“core starter 默认更轻”和“独立服务行为不变”。
- Line-ending-only 噪音在本轮 `git add -u` 后不再出现在工作区状态里，说明这些差异只是 Git 触碰时的 CRLF/LF 归一化提示，没有需要单独提交的实际内容。
- Slash command 和 command palette 的重复主要集中在 feature panel actions。新增 `useAssistantFeatureCommands` 后，plugins / compare / form-fill 的 palette 入口和 slash 入口共享同一组 action，后续 memory / KB 内置 palette 也可以按同样方向继续收敛。
- `project-health-check --release-check` 接入 bundle-size lane 后会依赖已构建的 `ai-assistant-ui/dist`。这符合 release 前先 build 再 check 的使用方式，但文档必须写清楚，避免在干净仓库直接跑 release-check 误以为失败。

### 阶段 13.42 继续推进发现

- Support artifact 如果只承接 `AutoConfiguration.imports`，宿主仍需要额外记住 springdoc 依赖；把 `springdoc-openapi-starter-webmvc-ui` 放进 support artifact 更符合“加一个 support artifact 即获得 OpenAPI support”的用户心智。
- Support module 不是 Spring Boot parent，需要显式导入 Spring Boot BOM；否则 springdoc 传递依赖会拉到 3.5.13 一组依赖，导致下载和版本对齐都不稳定。
- 最小 Java slice test 放在 support module 内，可以验证 support artifact 的依赖边界和 `AiAssistantOpenApiAutoConfiguration` wiring；脚本测试继续负责 metadata ownership。
- `/template` 和 prompt library palette entry 属于同一 prompt 命令族，迁移到 `useAssistantPromptCommands` 后，`AiAssistant.vue` 只组合 feature commands 与 prompt commands，不再维护模板命令细节。
- 本轮刷新 bundle baseline 后，release-check 的新增/删除 hash chunk 噪音归零；后续 bundle-size 摘要会更聚焦真实增长。

### 阶段 13.43 继续推进发现

- Support artifact 自带 springdoc 后，tracing/logstash 适合先作为 optional dependency bridge，而不是立即改变运行时自动配置；这能表达 artifact 边界，同时不强迫宿主启用 tracing/exporter/logstash。
- Standalone service 不需要直接依赖 springdoc；它依赖 support artifact 即可获得 OpenAPI support classpath，脚本 guard 可以防止未来又把 springdoc 直接塞回 service。
- `useAssistantCommandRegistry` 的价值是把“命令族怎么合并”从 `AiAssistant.vue` 拿走。后续新增命令时，应优先在 prompt/feature command composable 内扩展，再由 registry 组合。
- Release-check 新增 bundle-size lane 后，必须把“先 build UI，再 release-check”写进文档；否则干净工作区直接运行会因为 dist 不存在而失败。

### 阶段 13.44 继续推进发现

- Starter POM 仍保留 tracing / OTLP / logstash optional 依赖时，虽然不会强制传递给宿主，但依赖边界仍容易被误读为 starter 所有。将这些坐标移到 support artifact 后，observability support 的职责更清晰。
- `project-health-check --release-check` 自身先运行 UI build，比只在文档中要求人工排序更可靠；CI 可以直接复用同一条 release lane，避免本地和 CI 检查顺序漂移。
- `useAssistantCommandRegistry` 如果显式接收 prompt / feature 两类参数，后续新增 memory / KB / diagnostics 命令族时仍要回主组件改组合逻辑。改为 `families` 后，主组件只声明命令族顺序。
- Bundle baseline 的 hash chunk 噪音来自已确认构建产物变化；刷新 baseline 后，release-check 的 change summary 重新回到 added / removed / growth / shrunk 全 none。

### 阶段 13.45 继续推进发现

- Observability support 仅有 split 文档时，用户仍需要在 OpenAPI、Tracing、JSON logging 三种接入方式之间自行拼配置。单独 quick start 更适合放 copy-paste 配置，并强调 tracing/logstash 不会自动启用。
- 依赖足迹检查只告诉 starter 是否违反 optional 策略，不能直观看出 observability bridge 已从 starter 移到 support。新增 support dependency report 可以把 starter/support 的 direct/optional/absent 状态作为 release-check 输出。
- `useAssistantCommandRegistry` 已支持 generic families 后，prompt / feature family 数组仍留在 `AiAssistant.vue`。新增 `useAssistantCommandFamilies` 后，主组件只调用一个组合函数，后续新增命令族时不再散落拼接逻辑。
- CI 的 `npm run check:exports` 已被 release-check 内部 `npm run build` 覆盖，因为 package build 末尾会运行 `check:exports`。删除单独 step 后保留 package install smoke check，避免失去安装验证。
