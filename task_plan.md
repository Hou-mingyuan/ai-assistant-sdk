# AI Assistant SDK 全面优化任务计划

## 目标

对 `D:\project-hub\ai-assistant-sdk` 进行一轮全方面优化，重点提升可维护性、稳定性、文档完整度、开发体验、测试可验证性和日常使用体验。

## 完成标准

- [x] 建立持久化计划文件、发现记录和进度记录。
- [x] 创建或更新 `docs/assistant-optimization-plan.md`。
- [x] 至少实施 1 个低风险、高收益优化项。
- [x] 对已实施项运行最小相关验证。
- [x] 更新计划文件中的状态、验证结果和剩余风险。

## 阶段

### 阶段 1：项目盘点

状态：已完成

结论：
- 项目包含 Java Maven 模块、Vue 组件库、VitePress 文档站、Playwright 端到端测试和 Docker/Helm 部署配置。
- 当前工作区已有用户改动：`.github/workflows/ci.yml`、`.gitignore`、`e2e/playwright.config.ts`、`e2e/package-lock.json`。本次任务不覆盖这些文件。

### 阶段 2：生成优化计划

状态：已完成

输出：
- `docs/assistant-optimization-plan.md`

### 阶段 3：实施第一批低风险优化

状态：已完成

已实施：
- 补齐 VitePress 侧边栏中已配置但缺失的文档页面，避免用户点击 404。
- 新增 `scripts/project-health-check.mjs`，提供轻量健康检查入口。

### 阶段 4：最小验证

状态：已完成

结果：
- 已运行 `cd docs && npm run build`。
- VitePress 构建通过，新增页面可正常解析和渲染。
- 已运行 `node scripts/project-health-check.mjs --docs`。
- 版本一致性检查和文档站构建均通过。

### 阶段 5：README 入口聚焦

状态：已完成

已实施：
- 在 `README.md` 顶部新增“先看这里”，把快速开始、配置、独立服务、前端连接、API、上线清单和排障手册集中成入口表。
- 在 `docs/guide/index.md` 增加“从哪里开始”和“文档地图”，明确 Starter 集成、独立服务部署、前端接入和上线前检查的阅读路径。
- 在 `docs/guide/quick-start.md` 说明快速开始默认面向 Starter 集成，并把独立服务用户引导到对应文档。

验证：
- 已运行 `node scripts/project-health-check.mjs --docs`。
- 版本一致性检查通过。
- VitePress 文档站构建通过。

剩余：
- README 仍保留较多历史细节。后续需要确认文档站已有等价内容后，再逐段迁移和精简。

### 阶段 6：配置文档分层

状态：已完成

已实施：
- 重写 `docs/guide/configuration.md`，按最小可用、必填与模型连接、安全、性能与资源限制、可选能力、导出与文件处理、独立服务环境变量、前端配置和生产配置基线拆分。
- 配置项来源对照了 `AiAssistantProperties`、独立服务 `application.yml` 和 `.env.example`，避免只写概念说明。
- 保留 Starter、独立服务和前端三类配置入口，减少用户把不同部署形态混用的概率。

验证：
- 已运行 `node scripts/project-health-check.mjs --docs`。
- 版本一致性检查通过。
- VitePress 文档站构建通过。

### 阶段 7：部署路径检查清单

状态：已完成

已实施：
- 新增 `docs/guide/deployment-checklists.md`，分别提供 Starter 集成和独立服务部署检查清单。
- 在 `docs/.vitepress/config.ts` 的 Deployment 分组接入新页面。
- 在 `README.md`、`docs/guide/index.md`、`docs/guide/quick-start.md` 和 `docs/guide/standalone-service.md` 中补充入口链接。

验证：
- 已运行 `node scripts/project-health-check.mjs --docs`。
- 版本一致性检查通过。
- VitePress 文档站构建通过。

### 阶段 8：前端集成配方

状态：已完成

已实施：
- 新增 `docs/guide/frontend-recipes.md`。
- 覆盖手动放置组件、自动挂载、同源后端、连接独立服务、主题语言、快捷 Prompt、Prompt 模板、组件事件、错误监控、代码块 IDE、会话限制、模型选择和 Web Component。
- 在 `docs/.vitepress/config.ts`、`README.md`、`docs/guide/index.md` 和 `docs/guide/frontend-standalone.md` 中补充入口。

验证：
- 已运行 `node scripts/project-health-check.mjs --docs`。
- 版本一致性检查通过。
- VitePress 文档站构建通过。

### 阶段 9：生产上线清单扩充

状态：已完成

已实施：
- 扩充 `docs/guide/production-checklist.md`。
- 补充鉴权、CORS、短期 Token、SSRF、链接抓取、Headless 抓取、Admin、连接器管理、MCP、RAG、分 action 限流、日志脱敏、运行时配置摘要和 Actuator 暴露边界。

验证：
- 已运行 `node scripts/project-health-check.mjs --docs`。
- 版本一致性检查通过。
- VitePress 文档站构建通过。

### 阶段 10：后端架构维护说明

状态：已完成

已实施：
- 新增 `docs/guide/backend-architecture.md`。
- 说明后端总体分层、包职责、新功能放置建议、Controller 规则、Service 规则、配置和自动装配规则、扩展点规则和维护检查清单。
- 在 `docs/.vitepress/config.ts`、`README.md` 和 `docs/guide/index.md` 中补充入口。

验证：
- 已运行 `node scripts/project-health-check.mjs --docs`。
- 版本一致性检查通过。
- VitePress 文档站构建通过。

### 阶段 11：README API 长段落迁移

状态：已完成

已实施：
- 新增 `docs/api/reference.md`，承接核心 REST API、文件和链接、导出、健康统计、运行状态、能力和管理接口入口。
- 在 `docs/.vitepress/config.ts` 和 `docs/api/index.md` 接入 REST API 参考页。
- 将 `README.md` 中原有的大段 API 接口细节替换为文档站入口和常用 API 摘要，减少双份维护。

验证：
- 已运行 `node scripts/project-health-check.mjs --docs`。
- 版本一致性检查通过。
- VitePress 文档站构建通过。

剩余：
- README 中配置、部署和高级能力说明仍可继续逐段迁移，但本轮已经先处理最明显的 API 重复段。

---

## 第二轮：AI 助手进化功能（2026-05-13 启动）

### 起因

用户在新会话中要求"全部按顺序开始"实现上一轮设计但尚未落地的 11 项进化能力（A1-A4 / B5-B8 / C9-C11）。
经审计 `ai-assistant-ui/src` 当前实现，发现 5 项已存在或本质完成（B5/B6/C11 + A2/A3/A4 部分），真实缺口 6 项。

### 已存在能力（跳过或仅微调）

| 项 | 现状 | 文件 |
|----|------|------|
| B5 会话搜索 | composable + highlight 已 export | `useSessionSearch.ts` |
| B6 消息编辑/重生成 | 完整 | `useChatOrchestrator.ts` `MessageList.vue` `MessageContextMenu.vue` |
| C11 i18n | zh/en/ja/ko 4 语言 + types.ts | `utils/i18n/` |
| A2 RAG（前端管理） | LocalStorage 模拟 + ragPromptFragment | `useKnowledgeBase.ts` |
| A3 插件注册 | header/footer/context 按钮注册器 | `usePluginRegistry.ts` |
| A4 语音输入 | 完整 | `useVoiceInput.ts` |

### 本轮真实缺口（按执行顺序）

| # | 任务 | 关键文件（新增/修改） | 验证 |
|---|------|---------------------|------|
| A1 | 多模型并行对话 | new `useMultiModelChat.ts` + new `MultiModelCompare.vue` + `AiAssistant.vue` + `useSlashCommands.ts` + 4×i18n + CSS | build:lib |
| A4-TTS | 文本转语音朗读 | new `useTextToSpeech.ts` + `MessageContextMenu.vue` + `useMsgContextMenu.ts` + 4×i18n + CSS | build:lib |
| B7 | Prompt 模板管理 UI | new `usePromptTemplateLibrary.ts` + new `PromptTemplateDialog.vue` + `AiAssistant.vue` + `useSlashCommands.ts` + 4×i18n + CSS | build:lib |
| B8 | 代码块增强 (Mermaid + 行号) | `useAiMarkdownRenderer.ts` + 动态 import `mermaid` + CSS | build:lib |
| C10 | 性能优化 (虚拟滚动) | new `useVirtualScroll.ts` + `MessageList.vue` + worker 化（如有时间） | build:lib |
| A2 后端集成 | RAG 真后端调用 | `useKnowledgeBase.ts` + `utils/api.ts`（如后端已有端点） | findings.md 记录 |
| A3 真 MCP 客户端 | MCP JSON-RPC 客户端 | new `useMcpClient.ts` + 与 `usePluginRegistry` 打通 | build:lib |
| C9 测试补全 | 为 A1/A4/B7/C10 各加 `.spec.ts` | new `*.spec.ts` 文件 | `npm test` |

### 阶段 12：本轮所有 8 项任务

状态：全部完成 ✅

| 阶段 | 任务 | 状态 | 关键文件 |
|------|------|------|---------|
| 12.1 | A1 多模型并行对话 | ✅ | `useMultiModelChat.ts` + `MultiModelCompare.vue` + `AiAssistant.vue` + 4×i18n |
| 12.2 | A4 TTS 朗读 | ✅ | `useTextToSpeech.ts` + `MessageContextMenu.vue` |
| 12.3 | B7 Prompt 模板管理 UI | ✅ | `usePromptTemplateLibrary.ts` + `PromptTemplateDialog.vue` + 4×i18n |
| 12.4 | B8 代码块增强（Mermaid + 行号） | ✅ | `useAiMarkdownRenderer.ts` + `useMermaidRenderer.ts` + CSS + vite.config |
| 12.5 | C10 性能优化基础设施 | ✅ | `useMessageVirtualScroll.ts`（opt-in，不接入 MessageList） |
| 12.6 | A2 RAG 后端集成 | ⚠ 不做 | 架构语义不匹配，详见 findings.md |
| 12.7 | A3 真 MCP 客户端 | ✅ | `useMcpClient.ts` |
| 12.8 | C9 测试补全 | ✅ | 5 个新增 `.spec.ts` 共 41 个测试 |

### 最终验证

- `npm run build:lib`：✅ 通过；新增 chunks `MultiModelCompare` (10.41 KB) + `PromptTemplateDialog` (15.40 KB)
- `npm test`：✅ 195/195 全过（之前 155）
- `ReadLints`：✅ 新增文件 0 lint 错误
- 工作区无 commit / push，等待用户审阅

---

## 第六轮：深度分析后的按序整改（2026-05-20 启动）

### 起因

用户要求对 `D:\project-hub\ai-assistant-sdk` 深度分析后“按顺序全部”开始整改。当前轮按低风险、高收益、依赖关系清晰的顺序推进。

### 总体顺序

| 阶段 | 任务 | 状态 | 验证策略 |
| --- | --- | --- | --- |
| 13.1 | 继续拆分 `AiAssistant.vue`，抽离剩余批量选择/删除编排 | 已完成 | `ReadLints` 通过；`npm test -- useMessageSelection.spec.ts` 4/4 通过 |
| 13.2 | 统一 `/stream` 与 `/sse` 的协议定位，减少行为分叉 | 已完成 | 文档/注释更新；`ReadLints` 无诊断 |
| 13.3 | 增加生产安全基线检查或启动告警 | 已完成 | `node --test scripts/production-config-lint.test.mjs` 5/5 通过；prod compose 严格检查通过 |
| 13.4 | 梳理 `@ai-assistant/vue` 公共 API 分层 | 已完成 | 文档和导出区注释更新；`ReadLints` 无诊断 |

### 阶段 13.1 设计

检查后发现批量导出主体已经由 `ai-assistant-ui/src/composables/useExportActions.ts` 承接；当前阶段改为在不改变用户行为的前提下，把 `AiAssistant.vue` 中剩余的批量选择/删除状态与方法迁移到 `ai-assistant-ui/src/composables/useMessageSelection.ts`。

预期修改：
- 新增 `ai-assistant-ui/src/composables/useMessageSelection.ts`
- 新增 `ai-assistant-ui/src/composables/useMessageSelection.spec.ts`
- 修改 `ai-assistant-ui/src/components/AiAssistant.vue`

约束：
- 不自动执行 `npm run build`、`npm test`、`npm install`。
- 不执行 git commit / push。
- 每阶段完成后更新 `progress.md` 与本计划状态。

结果：
- 已新增 `ai-assistant-ui/src/composables/useMessageSelection.ts`。
- 已新增 `ai-assistant-ui/src/composables/useMessageSelection.spec.ts`。
- 已修改 `ai-assistant-ui/src/components/AiAssistant.vue`，移除内联批量选择/删除方法。
- `ReadLints` 对相关文件无诊断。
- 经用户允许运行 `npm test -- useMessageSelection.spec.ts`，结果 1 个测试文件、4 个测试全部通过。

### 阶段 13.2 设计

目标是梳理并统一后端流式接口 `/stream` 与 `/sse` 的协议定位，避免两条路径长期行为分叉。

预期先做只读审计：
- `ai-assistant-server/src/main/java/com/aiassistant/controller/AiAssistantController.java`
- `ai-assistant-server/src/main/java/com/aiassistant/controller/SseStreamController.java`
- `ai-assistant-ui/src/utils/api.ts`
- `ai-assistant-client/src/main/java/com/aiassistant/client/AiAssistantClient.java`
- `docs/api` 与 `docs/guide` 中流式接口文档

候选输出：
- 若代码已经足够清晰，优先补文档说明兼容关系。
- 若存在重复逻辑风险，抽小型共享方法或补测试；执行命令前先征得用户确认。

结果：
- 明确 `/stream` 是官方 UI / Java Client 默认使用的兼容流式端点。
- 明确 `/sse` 是带 `message` / `done` / `error` 事件类型的标准化 SSE 端点。
- 更新 `AiAssistantController` 与 `SseStreamController` 注释。
- 更新 `README.md`、`ai-assistant-service/README.md`、`docs/api/chat.md`、`docs/api/reference.md`、`docs/guide/architecture.md`、`docs/guide/sequence-diagrams.md`。
- `ReadLints` 对相关 Java/Markdown 文件无诊断。

### 阶段 13.3 设计

目标是增加生产安全基线检查，优先选择不会影响运行时行为的脚本方式，覆盖常见危险配置：
- `AI_ASSISTANT_ACCESS_TOKEN` 为空
- `AI_ASSISTANT_ALLOWED_ORIGINS=*`
- `AI_ASSISTANT_ALLOW_QUERY_TOKEN_AUTH=true`
- 高风险能力开启但缺少 token 或明确说明：Admin、MCP、Connector management、Headless fetch
- URL fetch SSRF 防护关闭

预期修改：
- 新增或扩展 `scripts` 下的检查脚本。
- 更新 README / 生产清单中的使用说明。
- 仅运行脚本自身的轻量测试或 Node 语法检查；执行前先征得用户确认。

结果：
- 新增 `scripts/production-config-lint.mjs`，检查 access token、CORS、query token、SSRF、高风险管理面和敏感 Actuator 暴露。
- 新增 `scripts/production-config-lint.test.mjs`。
- `scripts/project-health-check.mjs` 新增 `--prod-config` lane。
- `docs/guide/production-checklist.md` 增加上线前运行方式。
- `node --test scripts/production-config-lint.test.mjs`：5/5 通过。
- `node scripts/production-config-lint.mjs --strict --file docker-compose.prod.yml`：无问题。

### 阶段 13.4 设计

目标是为 `@ai-assistant/vue` 过宽的公共导出面补充分层说明，先不删除任何导出，避免破坏下游。

预期修改：
- 审阅 `ai-assistant-ui/src/index.ts` 的导出类型。
- 在前端集成文档或专门 API 文档中标注稳定入口、可选能力、实验性/高级工具。
- 必要时在 `index.ts` 注释中增加维护边界提示。

结果：
- `docs/guide/frontend-recipes.md` 新增“公共 API 分层”，区分主接入层、后端 API helper、管理与扩展层、UI 工具层、低层算法/实验层。
- `ai-assistant-ui/src/index.ts` 在导出区新增公共 API surface policy 注释，提醒内部重构默认不要 re-export。
- 本阶段没有删除或重命名任何导出，保持兼容。
- `ReadLints` 对相关文件无诊断。

### 阶段 13.5 设计

目标是继续固化生产基线，补齐 Helm / Kubernetes 路径下的敏感配置注入和多副本说明。

预期修改：
- `helm/ai-assistant/values.yaml`
- `helm/ai-assistant/templates/secret.yaml`
- `helm/ai-assistant/templates/deployment.yaml`
- `docs/guide/kubernetes.md`
- `docs/guide/production-checklist.md`
- `docs/guide/deployment-checklists.md`
- `ai-assistant-service/README.md`
- `scripts/production-config-lint.mjs`
- `scripts/production-config-lint.test.mjs`

结果：
- Helm chart 将 `AI_ASSISTANT_ACCESS_TOKEN`、`AI_ASSISTANT_ADMIN_TOKEN` 和 `AI_ASSISTANT_RUNTIME_CONFIG_SECRET_KEY` 从 Secret 注入，避免长期密钥放在普通 `env` 配置中。
- Kubernetes 文档补充 Secret 注入、明确 CORS、query token 禁用、多副本限流、Redis / Session / Memory / RAG 共享存储和 Actuator 暴露边界。
- 生产清单和部署路径清单补充 Helm Secret 必配项。
- `production-config-lint` 增加对 Helm `secrets.apiKey`、`secrets.accessToken`、`secrets.adminToken` 和 `secrets.runtimeConfigSecretKey` 的解析，避免 Secret 化后误判。

验证：
- `ReadLints` 对相关 Helm / Markdown / Node 文件无诊断。
- `node --test scripts/production-config-lint.test.mjs`：6 个测试全部通过。
- `node scripts/production-config-lint.mjs --strict --file docker-compose.prod.yml`：无问题。
- `node scripts/production-config-lint.mjs --strict --file helm/ai-assistant/values.yaml`：只有模板占位 WARN，无 high-severity。
- `mvn package`：通过。
- `npm run build`（`ai-assistant-ui`）：通过。
- `helm template ...` 未执行成功：当前机器未安装 `helm` 命令。
- `node scripts/project-health-check.mjs --prod-config --strict` 未通过：本地 `.env` 存在空 `AI_ASSISTANT_ACCESS_TOKEN` 和 `AI_ASSISTANT_ALLOWED_ORIGINS=*`，属于本地环境文件风险。

### 阶段 13.6 设计

目标是继续拆分 `AiAssistant.vue`，优先抽离 Compare regions 编排，保持 UI 行为不变。

预期修改：
- 新增 `ai-assistant-ui/src/composables/useCompareRegions.ts`
- 新增 `ai-assistant-ui/src/composables/useCompareRegions.spec.ts`
- 修改 `ai-assistant-ui/src/components/AiAssistant.vue`
- 更新 `ai-assistant-ui/REFACTORING_PLAN.md`

结果：
- `compareSet`、`compareDialogOpen`、slot label、mark/unmark、compare-with、swap、clear 迁移到 `useCompareRegions`。
- `AiAssistant.vue` 保留右键菜单上下文读取和代码块点击桥接，不再直接维护 Compare set 数组操作。
- 多模型 `/compare` 面板保持不变，避免混淆两套对比能力。

验证：
- 已先写 `useCompareRegions.spec.ts` 并观察到 RED：缺少 `useCompareRegions` 导致 import 失败。
- `npm test -- useCompareRegions.spec.ts`：5 个测试通过。
- `npm run build:types`：通过。

### 阶段 13.7 设计

目标是继续拆分 `AiAssistant.vue`，抽离 KB drop / KB picker 编排，保持 FAB drop 到知识库的现有行为。

预期修改：
- 新增 `ai-assistant-ui/src/composables/useKnowledgeDrop.ts`
- 新增 `ai-assistant-ui/src/composables/useKnowledgeDrop.spec.ts`
- 修改 `ai-assistant-ui/src/components/AiAssistant.vue`
- 更新 `ai-assistant-ui/REFACTORING_PLAN.md`

结果：
- Quick Ingest、目标 KB picker、picker 文件缓存、自动关闭 timer、键盘选择、新建 KB 和 toast 迁移到 `useKnowledgeDrop`。
- `useFabDropIngest` 继续只负责 FAB 拖拽事件，`AiAssistant.vue` 只负责注入 focus picker 和把文件交给新 composable。

验证：
- 已先写 `useKnowledgeDrop.spec.ts` 并观察到 RED：缺少 `useKnowledgeDrop` 导致 import 失败。
- `npm test -- useKnowledgeDrop.spec.ts`：6 个测试通过。
- `ReadLints` 对 `useKnowledgeDrop.ts`、spec 和 `AiAssistant.vue` 无诊断。
- `npm run build:types`：通过。

### 阶段 13.8 设计

目标是继续拆分连接诊断状态，将纯文案和状态映射从 `useAssistantDiagnostics.ts` 中分离出来。

预期修改：
- 新增 `ai-assistant-ui/src/composables/useConnectionDiagnosticsState.ts`
- 新增 `ai-assistant-ui/src/composables/useConnectionDiagnosticsState.spec.ts`
- 修改 `ai-assistant-ui/src/composables/useAssistantDiagnostics.ts`
- 更新 `ai-assistant-ui/REFACTORING_PLAN.md`

结果：
- error → `ModelListStatus`、模型列表消息、endpoint、token 文案、诊断状态、模型状态、模型来源、提示文案和 remedy kind 迁移到 `useConnectionDiagnosticsState`。
- `useAssistantDiagnostics.ts` 保留网络请求、运行时模型配置保存、连接配置持久化和复制诊断文本。

验证：
- 已先写 `useConnectionDiagnosticsState.spec.ts` 并观察到 RED：缺少 `useConnectionDiagnosticsState` 导致 import 失败。
- `npm test -- useConnectionDiagnosticsState.spec.ts`：5 个测试通过。
- `ReadLints` 对新 composable、spec 和 `useAssistantDiagnostics.ts` 无诊断。
- `npm run build:types`：通过。

### 阶段 13.9 设计

目标是强化协议契约测试，优先补齐 `/sse` 标准化事件类型的后端契约。

预期修改：
- 修改 `ai-assistant-server/src/test/java/com/aiassistant/controller/SseStreamControllerTest.java`

结果：
- 新增 `/sse` chat 流的 `message` / `done` 事件契约测试，覆盖 event、data、id、`X-Accel-Buffering` 和 `Cache-Control`。
- 新增输入超限时返回 400 且输出 `error` event 的契约测试。
- 过程中发现 Mockito 对 `chatStream` 两个 7 参重载存在匹配歧义，已用 `any(List.class)` 明确走 imageDataList 重载。

验证：
- 首次运行 `mvn -pl ai-assistant-server -Dtest=SseStreamControllerTest test` 失败，原因是 Mockito 重载歧义。
- 修正 matcher 后重跑同一命令：4 个测试通过，0 失败。
- `ReadLints` 对 `SseStreamControllerTest.java` 无诊断。

## 错误记录

| 时间 | 问题 | 原因 | 处理 |
| --- | --- | --- | --- |
| 2026-04-29 | `cmd` 默认显示 README 中文为乱码 | Windows 控制台代码页不是 UTF-8 | 改用 `chcp 65001` 后继续读取 |
| 2026-04-29 | VitePress 构建提示 `env` 语言未加载 | 新增 Markdown 使用了未启用的代码块语言 | 将本次新增文档中的 `env` 代码块改为 `text` 后重新构建通过 |
| 2026-04-29 | `project-health-check.mjs` 首次运行 `npm.cmd` 报 `EINVAL` | Windows 下直接 `spawnSync` `.cmd` 兼容性不足 | 改为 Windows 下使用 `shell: true` |
| 2026-04-29 | 手工 `cmd.exe /c` 拼接命令时引号被错误传递 | Windows 命令行转义不够稳健 | 放弃手工拼接，统一让 Node 的 `shell: true` 处理 |
| 2026-05-21 | `helm template` 无法执行 | 当前机器未安装 `helm` 命令 | 记录为未验证项；保留模板文件静态审阅和生产配置 lint |
| 2026-05-21 | `project-health-check --prod-config --strict` 失败 | 本地 `.env` 仍是空 access token 和 `allowed-origins=*` | 不修改本地 `.env`；改为对 `docker-compose.prod.yml` 和 Helm values 分别运行生产配置 lint |
| 2026-05-21 | `SseStreamControllerTest` 首次编译失败 | Mockito `any()` 无法区分 `chatStream` 的 `String` 与 `List<String>` 重载 | 改用 `any(List.class)` 明确匹配 `/sse` 实际调用的 imageDataList 重载 |
