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

### 阶段 13.10 设计

目标是评估依赖分层，把重型或低频能力的默认依赖、optional 依赖和运行条件写清楚。

预期修改：
- 新增 `docs/guide/dependency-footprint.md`
- 更新 `docs/.vitepress/config.ts`
- 更新 `docs/guide/index.md`

结果：
- 文档明确 Starter 基础依赖、Web 入口 optional、PDFBox/POI 导出依赖、Redis/JDBC、Resilience4j、Tracing、Playwright、Springdoc、Logstash 等能力边界。
- 文档明确独立服务默认带 Web/WebFlux/WebSocket/Actuator/日志能力，但默认不带 Redis/JDBC/Playwright。
- 文档明确前端 Mermaid 通过动态 import 作为宿主 opt-in 能力，不增加默认依赖。

验证：
- `ReadLints` 对新增文档、VitePress 配置和计划文件无诊断。
- `node scripts/project-health-check.mjs --docs`：版本一致性检查通过，VitePress 文档站构建通过。

### 阶段 13.11 设计

目标是继续拆分 `useAssistantDiagnostics.ts`，将连接 baseUrl/token 输入和 localStorage 持久化状态迁移到独立 composable。

预期修改：
- 新增 `ai-assistant-ui/src/composables/useConnectionConfigState.ts`
- 新增 `ai-assistant-ui/src/composables/useConnectionConfigState.spec.ts`
- 修改 `ai-assistant-ui/src/composables/useAssistantDiagnostics.ts`

结果：
- `connectionBaseUrlInput`、`connectionTokenInput`、`connectionPersistEnabled`、`connectionConfigMessage`、storage key、sync/apply/persist/default-base-url 逻辑迁移到 `useConnectionConfigState`。
- `useAssistantDiagnostics.ts` 保留测试连接、保存连接配置、运行模型诊断等编排逻辑。

验证：
- 已先写 `useConnectionConfigState.spec.ts` 并观察到 RED：缺少 `useConnectionConfigState` 导致 import 失败。
- `npm test -- useConnectionConfigState.spec.ts`：6 个测试通过。
- `ReadLints` 对新 composable、spec 和 `useAssistantDiagnostics.ts` 无诊断。
- `npm run build:types`：通过。

### 阶段 13.12 设计

目标是继续拆分 `useAssistantDiagnostics.ts`，将 runtime provider 表单状态迁移到独立 composable。

预期修改：
- 新增 `ai-assistant-ui/src/composables/useRuntimeProviderConfigState.ts`
- 新增 `ai-assistant-ui/src/composables/useRuntimeProviderConfigState.spec.ts`
- 修改 `ai-assistant-ui/src/composables/useAssistantDiagnostics.ts`

结果：
- `providerInput`、`providerBaseUrlInput`、`providerApiKeyInput`、`providerModelInput`、`providerAllowedModelsInput` 迁移到 `useRuntimeProviderConfigState`。
- runtime config 回填、写入 payload 构造、discover models 回填逻辑迁移到独立 composable。
- `useAssistantDiagnostics.ts` 保留网络请求、诊断执行和 UI message 编排。

验证：
- 已先写 `useRuntimeProviderConfigState.spec.ts` 并观察到 RED：缺少 `useRuntimeProviderConfigState` 导致 import 失败。
- `npm test -- useRuntimeProviderConfigState.spec.ts`：5 个测试通过。
- `ReadLints` 对新 composable、spec 和 `useAssistantDiagnostics.ts` 无诊断。
- `npm run build:types`：通过。

### 阶段 13.13 设计

目标是继续强化协议契约测试，补齐 Java Client `/stream` 请求契约。

预期修改：
- 修改 `ai-assistant-client/src/test/java/com/aiassistant/client/AiAssistantClientTest.java`

结果：
- `chatStream` 测试覆盖 `/stream` 路径、`Accept: text/event-stream`、`X-AI-Token`、`action/text/systemPrompt/model` 请求体，以及 SSE data 解析。

验证：
- `mvn -pl ai-assistant-client -Dtest=AiAssistantClientTest test`：12 个测试通过，0 失败。

### 阶段 13.14 设计

目标是继续强化协议契约测试，补齐服务端兼容 `/stream` 的错误输出契约。

预期修改：
- 修改 `ai-assistant-server/src/test/java/com/aiassistant/controller/AiAssistantControllerTest.java`

结果：
- 新增 LLM stream 中途失败时输出友好错误 chunk 的契约测试。
- 新增输入超限时 `/stream` 返回 400 且 body 为 `[VALIDATION_ERROR] ...` chunk 的契约测试。

验证：
- `mvn -pl ai-assistant-server -Dtest=AiAssistantControllerTest test`：17 个测试通过，0 失败。

### 阶段 13.15 设计

目标是继续强化 runtime config 后端契约，覆盖只读 runtime config 和 Admin runtime model config。

预期修改：
- 新增 `ai-assistant-server/src/test/java/com/aiassistant/controller/RuntimeModelConfigControllerTest.java`

结果：
- 补齐 `GET /admin/runtime/model-config` 的 sanitized snapshot 契约，确保不返回 API key 明文。
- 补齐 `POST /admin/runtime/model-config` 的更新契约，确保 provider/model/allowedModels 回写，并保持 API key write-only。

验证：
- 首次 PowerShell 命令未进入 Maven：`-Dtest=A,B` 逗号需要加引号。
- 重跑 `mvn -pl ai-assistant-server "-Dtest=RuntimeConfigControllerTest,RuntimeModelConfigControllerTest" test`：5 个测试通过，0 失败。

### 阶段 13.16 设计

目标是处理当前工作区大量 `modified` 但无业务内容差异的行尾噪音，避免后续功能改动和 CRLF/LF 归一化混在同一次 review。

约束：
- 不执行全仓行尾重写。
- 不自动 commit / push。
- 只新增只读检测工具和文档说明。

结果：
- 新增 `scripts/line-ending-noise-check.mjs`，区分真实 content diff 和 line-ending/status-only diff。
- 新增 `scripts/line-ending-noise-check.test.mjs`，覆盖内容差异、行尾差异、status-only 变更和 rename porcelain 解析。
- `scripts/project-health-check.mjs` 新增 `--line-endings` lane。
- `docs/guide/git-hooks.md` 增加“行尾噪音检查”说明。

验证：
- `node --test scripts/line-ending-noise-check.test.mjs`：5 个测试通过。
- `node scripts/line-ending-noise-check.mjs`：识别 2 个真实内容 diff 和 88 个 line-ending-only diff。
- `node scripts/project-health-check.mjs --line-endings`：版本一致性检查通过，行尾噪音检查通过。
- `ReadLints` 对新增脚本、测试、健康检查和文档无诊断。

### 阶段 13.17 设计

目标是按深度分析建议的第 2 项，把 OpenAPI 前端类型同步检查纳入 CI，优先选择不启动后端、不下载 codegen 的轻量 guard。

约束：
- 不启动 Spring Boot 服务。
- 不运行 Maven build/package。
- 不直接重新生成 `api-generated.d.ts`。
- 先覆盖当前已经写入 `api-generated.d.ts` 的聊天契约范围。

结果：
- 新增 `scripts/openapi-type-sync-guard.mjs`。
- 新增 `scripts/openapi-type-sync-guard.test.mjs`。
- `.github/workflows/ci.yml` 的 repository job 改为 `fetch-depth: 0`，并在 PR 上运行 `openapi-type-sync-guard`。
- `docs/guide/openapi-typescript-codegen.md` 更新 CI 集成说明，明确轻量 guard 与 live-spec drift check 的区别。

验证：
- `node --test scripts/openapi-type-sync-guard.test.mjs`：4 个测试通过。
- `node scripts/openapi-type-sync-guard.mjs --file ai-assistant-server/src/main/java/com/aiassistant/model/ChatRequest.java`：按预期失败，提示缺少 `api-generated.d.ts` 同步。
- `node scripts/openapi-type-sync-guard.mjs --file ai-assistant-server/src/main/java/com/aiassistant/model/ChatRequest.java --file ai-assistant-ui/src/types/api-generated.d.ts`：通过。
- `node --test scripts/*.test.mjs`：18 个脚本测试全部通过。
- `ReadLints` 对新增脚本、测试、CI 和文档无诊断。

### 阶段 13.18 设计

目标是按深度分析建议的第 3 项继续拆分诊断相关前端逻辑，先抽出低风险的 diagnostics clipboard 编排。

预期修改：
- 新增 `ai-assistant-ui/src/composables/useDiagnosticsClipboard.ts`
- 新增 `ai-assistant-ui/src/composables/useDiagnosticsClipboard.spec.ts`
- 修改 `ai-assistant-ui/src/composables/useAssistantDiagnostics.ts`
- 修改 `ai-assistant-ui/src/components/AiAssistant.vue`
- 更新 `ai-assistant-ui/REFACTORING_PLAN.md`

结果：
- `buildDiagnosticsText`、`copyDiagnostics`、`diagnosticsCopied`、`diagnosticsCopyMessage` 和 `writeClipboardText` fallback 从 `useAssistantDiagnostics.ts` 迁移到 `useDiagnosticsClipboard.ts`。
- `useAssistantDiagnostics.ts` 保留模型刷新、runtime config、连接配置保存和 provider discovery 编排。
- `AiAssistant.vue` 继续复用 `writeClipboardText`，但导入路径改为新 composable。

验证：
- RED：`npm test -- useDiagnosticsClipboard.spec.ts` 首次失败，原因是缺少 `useDiagnosticsClipboard` 模块。
- GREEN：`npm test -- useDiagnosticsClipboard.spec.ts` 通过，3/3。
- `npm test -- useDiagnosticsClipboard.spec.ts ConnectionDiagnostics.spec.ts` 通过，5/5。
- `ReadLints` 对新 composable、spec、`useAssistantDiagnostics.ts` 和 `AiAssistant.vue` 无诊断。

### 阶段 13.19 设计

目标是按深度分析建议的第 4 项规划 Starter feature artifact 拆分路线，但本阶段不移动 POM 依赖，避免破坏现有用户。

结果：
- `docs/guide/dependency-footprint.md` 新增“Feature artifact 拆分路线”。
- 明确候选 artifact：export/file/headless/rag/connector/observability support。
- 明确迁移顺序：先 Headless / Observability，再 Export + File，最后 RAG / Connector。
- 明确兼容原则：Starter 不在小版本内突然移除能力，独立服务保持开箱即用，CI 后续需要覆盖 core-only 和 full feature set 两条路径。

验证：
- `ReadLints` 对 `docs/guide/dependency-footprint.md` 无诊断。

### 阶段 13.20 设计

目标是按深度分析建议的第 5 项继续收窄 `@ai-assistant/vue` 主入口公共 API 面，但不删除任何现有导出。

结果：
- `docs/guide/frontend-recipes.md` 的“公共 API 分层”新增推荐导入路径和主入口收窄路线。
- `ai-assistant-ui/src/index.ts` 的 public API surface policy 注释补充：新高级 helper 优先进入 `./admin`、`./mcp`、`./form-fill`、`./screenshot` 等二级入口。
- 保持所有现有主入口导出不变，避免破坏下游。

验证：
- `npm test -- packageExports.spec.ts`：1 个测试通过。
- `ReadLints` 对 `frontend-recipes.md` 和 `index.ts` 无诊断。

### 阶段 13.21 设计

目标是继续推进 OpenAPI 契约闭环，为后续静态 spec 快照 CI 铺好入口。

结果：
- `scripts/generate-frontend-types.mjs` 新增 `--spec-file <openapi-json>` 参数。
- 新增 `loadSpecText`，当提供 `specFile` 时从本地 OpenAPI JSON 读取，不访问 live `/v3/api-docs`。
- `scripts/generate-frontend-types.test.mjs` 增加 spec-file 参数解析和本地文件读取测试。
- `docs/guide/openapi-typescript-codegen.md` 更新静态 spec 输入说明和 roadmap。

验证：
- RED：`node --test scripts/generate-frontend-types.test.mjs` 首次失败，原因是缺少 `loadSpecText` export。
- GREEN：`node --test scripts/generate-frontend-types.test.mjs` 通过，3/3。
- `ReadLints` 对脚本、测试和文档无诊断。

### 阶段 13.22 设计

目标是补齐静态 OpenAPI 快照并扩大前端生成类型覆盖面。

结果：
- 新增 `docs/api/openapi.json`，覆盖 chat/stream/sse、models、runtime config、prompt templates 和 URL preview。
- 运行 `generate-frontend-types.mjs --spec-file docs/api/openapi.json` 生成新的 `api-generated.d.ts`。
- `utils/api.ts` 中 `ModelsListResult`、`ModelDetail`、`RuntimeModelConfigResult`、`RuntimeModelConfigPayload`、`UrlPreviewResult`、`PromptTemplateEntry` 改为引用 generated schema。
- CI 新增 `generate-frontend-types.mjs --spec-file docs/api/openapi.json --check`。
- 前端新增 `.prettierignore` 排除生成文件 `src/types/api-generated.d.ts`，避免 codegen 输出与 Prettier 规则互相覆盖。

验证：
- `node scripts/generate-frontend-types.mjs --spec-file docs/api/openapi.json --check`：通过。
- `npm test -- api.spec.ts`：2 个测试文件、53 个测试通过。

### 阶段 13.23 设计

目标是继续拆分 `useAssistantDiagnostics.ts`，抽出模型诊断网络请求编排。

结果：
- 新增 `useDiagnosticsModelRequests.ts` 和对应 spec。
- `refreshRuntimeModelConfig`、`refreshChatModels`、`runModelDiagnostics`、`saveProviderConfig`、`discoverProviderModels` 迁移到新 composable。
- `useAssistantDiagnostics.ts` 继续作为诊断组合层。

验证：
- RED：`npm test -- useDiagnosticsModelRequests.spec.ts` 首次失败，原因是缺少模块。
- GREEN：`npm test -- useDiagnosticsModelRequests.spec.ts useDiagnosticsClipboard.spec.ts ConnectionDiagnostics.spec.ts api.spec.ts`：5 个测试文件、60 个测试通过。

### 阶段 13.24 设计

目标是建立 Starter 依赖足迹护栏，为后续 core-only / feature artifact 拆分做准备。

结果：
- 新增 `scripts/dependency-footprint-check.mjs` 和测试。
- 检查 Web/WebFlux/WebSocket/Actuator/Redis/JDBC/Resilience4j/Tracing/Playwright/Springdoc/Logstash 等低频能力必须保持 optional。
- 明确 PDFBox/POI 当前仍是 documented required，若改 optional 需先更新文档。
- 接入 `project-health-check --dependency-footprint` 和 CI repository job。

验证：
- `node --test scripts/dependency-footprint-check.test.mjs`：3 个测试通过。
- `node scripts/dependency-footprint-check.mjs`：无问题。

### 阶段 13.25 设计

目标是补前端包体归因能力，为主入口继续瘦身提供数据。

结果：
- 新增 `scripts/bundle-composition-report.mjs` 和测试。
- 基于 `scripts/.bundle-size-baseline.json` 输出 main、webComponent、styles、workers、secondaryEntries、featureChunks 分组 gzip 统计。
- 接入 `project-health-check --bundle-composition`。
- 新增 `project-health-check --release-check`，串联版本一致性、脚本测试、静态 OpenAPI 类型比对、依赖足迹和包体归因。
- `docs/guide/dependency-footprint.md` 增加包体归因命令说明。

验证：
- `node --test scripts/bundle-composition-report.test.mjs`：2 个测试通过。
- `node scripts/project-health-check.mjs --dependency-footprint --bundle-composition`：通过。
- `node scripts/project-health-check.mjs --release-check`：通过。
- `node --test scripts/*.test.mjs`：25 个脚本测试全部通过。
- `npm run build`（`ai-assistant-ui`）：通过，Package export check OK（27 paths）。

### 阶段 13.26 设计

目标是提供兼容性的前端瘦身入口，避免直接删除主入口历史导出。

结果：
- 新增 `ai-assistant-ui/src/entries/core.ts`。
- `package.json` 新增 `@ai-assistant/vue/core` 二级入口。
- `vite.config.ts` 将 `core` 加入 library entries。
- `packageExports.spec.ts` 覆盖 `./core` 导出。
- `docs/guide/frontend-recipes.md` 增加 core 入口说明。

验证：
- `npm test -- packageExports.spec.ts`：通过。
- `npm run build`：产出 `core.mjs` / `core.umd.cjs`，Package export check OK（27 paths）。

### 阶段 13.27 设计

目标是在大版本模式下推进 `@ai-assistant/vue/core` 真瘦身，让 core entry 不再经过 `src/index.ts` 的高级导出面。

结果：
- 新增 `ai-assistant-ui/src/core-plugin.ts`，承接核心插件安装逻辑、`AiAssistantOptions`、默认配置和 `AiAssistant` 导出。
- `ai-assistant-ui/src/entries/core.ts` 改为从 `core-plugin` 导入默认插件和类型，不再依赖主入口 `index.ts`。
- 主入口历史导出暂时保留，避免立即破坏下游；core entry 已具备独立入口基础。

验证：
- `npm test -- packageExports.spec.ts`：通过。
- `npm run build`：通过；`core.mjs` / `core.umd.cjs` 产出，主 `ai-assistant.mjs` 降到约 22 KB gzip 约 7 KB，重型实现下沉到共享 chunk。

### 阶段 13.28 设计

目标是继续扩大 generated schema 覆盖面，迁移 Admin API 常用 DTO。

结果：
- `docs/api/openapi.json` 新增 AdminOverview、AdminPromptEntry、AdminToolEntry、AdminRagStats、AdminRagIngestResult、AdminAbTestConfig、AdminFallbackChain、AdminPluginsResult、AdminSystemInfo schemas。
- 重新生成 `api-generated.d.ts`。
- `adminApi.ts` 中对应手写 interface 改为 generated schema alias。

验证：
- `node scripts/generate-frontend-types.mjs --spec-file docs/api/openapi.json --check`：通过。
- `npm test -- adminApi.spec.ts api.spec.ts`：2 个测试文件、53 个测试通过。

### 阶段 13.29 设计

目标是补 core-only starter 自动装配验证路径，为后续 feature artifact 拆分提供测试护栏。

结果：
- `AiAssistantAutoConfigurationTest` 新增 `coreOnlyClasspathStillStartsBasicChatWiring`。
- 测试过滤 Redis、JDBC、Playwright、Springdoc、OpenTelemetry、Logstash 等低频依赖。
- 验证基础 `AiAssistantController`、`SseStreamController`、`LlmService`、`ChatCompletionClient`、`SessionStore` 仍能装配。
- 验证 Headless 和 Redis rate limit 没有意外注册。

验证：
- `mvn -pl ai-assistant-server "-Dtest=AiAssistantAutoConfigurationTest" test`：10 个测试通过。

### 阶段 13.30 设计

目标是为 v2 主入口高级导出迁移增加 IDE/TS 提示，不立即删除导出。

结果：
- `src/index.ts` 中 Admin、MCP、Form Fill、Screenshot 相关主入口导出增加 `@deprecated` 指引。
- 指引下游改用 `@ai-assistant/vue/admin`、`@ai-assistant/vue/mcp`、`@ai-assistant/vue/form-fill`、`@ai-assistant/vue/screenshot`。

验证：
- `npm test -- packageExports.spec.ts`：通过。
- `ReadLints` 对 `src/index.ts` 无诊断。

### 阶段 13.31 设计

目标是新增 v2 migration guide，集中说明大版本迁移路径。

结果：
- 新增 `docs/guide/v2-migration.md`。
- 文档覆盖 frontend secondary entries、计划移除顺序、backend feature artifact 方向和 OpenAPI 类型生成要求。
- VitePress sidebar 接入 `v2 Migration Guide`。

验证：
- `npm run build`（`docs`）：通过。
- `ReadLints` 对新增文档和 VitePress 配置无诊断。

### 阶段 13.32 设计

目标是把 `adminApi.ts` 已公开使用的 `/admin/*` paths 纳入静态 OpenAPI 快照，并让前端 Admin SDK 逐步使用 path-level generated types。

结果：
- 新增 `scripts/openapi-admin-paths.test.mjs`，先覆盖 Admin public operations 和 JSON request body schema 的快照契约。
- `docs/api/openapi.json` 新增 `/admin/overview`、`/admin/tokens`、`/admin/prompts`、`/admin/tools`、`/admin/rag/*`、`/admin/ab-test`、`/admin/fallback-chain`、`/admin/plugins`、`/admin/system` 等 paths。
- 重新生成 `ai-assistant-ui/src/types/api-generated.d.ts`。
- `adminApi.ts` 的 request/response 类型进一步迁移到 `paths[...]` 派生的 path-level aliases，保留 `AdminResult<T>` 作为前端错误归一化包装。

验证：
- `node --test scripts/openapi-admin-paths.test.mjs`：2 个测试通过。
- `node --test scripts/*.test.mjs`：27 个测试通过。
- `node scripts/generate-frontend-types.mjs --spec-file docs/api/openapi.json --check`：通过。
- `npm test -- adminApi.spec.ts api.spec.ts`：2 个测试文件、53 个测试通过。
- `npx vue-tsc --noEmit`：通过。

### 阶段 13.33 设计

目标是继续补齐非 Admin REST endpoints 的静态 OpenAPI paths，让静态快照覆盖服务端当前主要公开能力面。

结果：
- 新增 `scripts/openapi-public-paths.test.mjs`，覆盖 health、stats、templates、sessions、file、batch、capabilities、async、export、connector health、MCP 和 runtime model discovery paths。
- `docs/api/openapi.json` 补齐上述 paths、请求体、path/query 参数和主要响应 schema；multipart 文件上传和二进制 export 响应也纳入快照。
- 重新生成 `ai-assistant-ui/src/types/api-generated.d.ts`。

验证：
- `node --test scripts/openapi-public-paths.test.mjs scripts/openapi-admin-paths.test.mjs`：4 个测试通过。
- `node --test scripts/*.test.mjs`：29 个测试通过。
- `node scripts/generate-frontend-types.mjs --spec-file docs/api/openapi.json --check`：通过。
- `npx vue-tsc --noEmit`：通过。

### 阶段 13.34 设计

目标是让前端通用 API helper 的公开类型继续从 generated paths 派生，而不是继续依赖手写或 schema-only aliases。

结果：
- 新增 `scripts/frontend-api-path-types.test.mjs`，用临时 TypeScript probe 校验 `api.ts` 导出的关键 helper 类型与 `paths[...]` 完全一致。
- `api.ts` 新增 path-level helper types，导出 `ExportRequestPayload`、`FileUploadResponse`、`PromptTemplatesResponse`、`RuntimeDiscoverModelsResult`。
- `/admin/runtime/model-config/discover-models` 响应改为显式 `RuntimeDiscoverModelsResult` schema，并重新生成 `api-generated.d.ts`。

验证：
- `node --test scripts/frontend-api-path-types.test.mjs`：通过。
- `node --test scripts/*.test.mjs`：30 个测试通过。
- `npm test -- api.spec.ts`：2 个测试文件、53 个测试通过。
- `node scripts/generate-frontend-types.mjs --spec-file docs/api/openapi.json --check`：通过。
- `npx vue-tsc --noEmit`：通过。

### 阶段 13.35 设计

目标是让轻量 OpenAPI type sync guard 跟上已经扩大的静态快照覆盖面。

结果：
- `openapi-type-sync-guard.mjs` 的 contract files 从聊天端点扩展到当前已覆盖的主要 REST controllers、DTO、`ConnectorProperties`、MCP controller 和 runtime model config service。
- 新增 `OPENAPI_SPEC_FILE`，当后端契约文件变更时要求 `docs/api/openapi.json` 与 `api-generated.d.ts` 同步变化。
- 当 OpenAPI snapshot 单独变更时，也要求重新生成 frontend types。
- 更新 guard 单测覆盖缺 spec、缺 generated types、Windows path normalization 等场景。

验证：
- `node --test scripts/openapi-type-sync-guard.test.mjs`：5 个测试通过。

### 阶段 13.36 设计

目标是同步更新 OpenAPI codegen 文档，避免文档仍描述早期 chat-only guard。

结果：
- `docs/guide/openapi-typescript-codegen.md` 改为描述当前静态 snapshot 为 reviewed API contract。
- 文档补充 schema alias 与 path-level alias 的前端使用方式。
- CI integration 章节更新为当前 guard 行为：后端契约变更要求同步 `docs/api/openapi.json` 和 `api-generated.d.ts`，snapshot 单独变更也要求 generated types 同步。
- Roadmap 改为 release-time snapshot refresh、收紧 broad schema、v2 REST contract review。

验证：
- `npm run build`（`docs`）：通过。

### 阶段 13.37 设计

目标是按 1-4 全部推进一轮：release-time snapshot refresh、schema 收紧、Observability/OpenAPI support 验证、主组件低风险瘦身。

结果：
- 新增 `scripts/refresh-openapi-snapshot.mjs` 和测试，用于 release-time 从 live URL 或已导出的 spec 文件刷新 `docs/api/openapi.json` 并重新生成前端类型。
- 收紧 `UsageStatsSnapshot` 与 `BatchResponse` schema，避免继续使用过宽 `additionalProperties`。
- `AiAssistantAutoConfigurationTest` 增加 OpenAPI support metadata 自动装配验证，覆盖显式启用时的 OpenAPI bean、server URL 和 security schemes。
- 新增 `useServerPromptTemplates.ts` 与测试，从 `AiAssistant.vue` 抽出服务端模板刷新和 preset 合并逻辑。
- OpenAPI codegen 文档补充 refresh 脚本用法。

验证：
- `node --test scripts/refresh-openapi-snapshot.test.mjs`：3 个测试通过。
- `mvn -pl ai-assistant-server "-Dtest=AiAssistantAutoConfigurationTest" test`：11 个测试通过。
- `npm test -- useServerPromptTemplates.spec.ts`：2 个测试通过。
- `node --test scripts/*.test.mjs`：34 个测试通过。
- `npm test -- useServerPromptTemplates.spec.ts api.spec.ts`：3 个测试文件、55 个测试通过。
- `node scripts/project-health-check.mjs --release-check`：通过。
- `npm run build`（`ai-assistant-ui`）：通过，Package export check OK（27 paths）。
- `mvn package`：通过。
- `npm run build`（`docs`）：通过。

### 阶段 13.38 设计

目标是按新一轮 1-4 继续推进：refresh dry-run、schema 再收紧、模板/命令区继续拆分、observability artifact 预演。

结果：
- `refresh-openapi-snapshot.mjs` 新增 `--check` dry-run 模式，支持只比对 live/exported spec 与当前 snapshot，并复用 generator `--check` 验证 generated types。
- 继续收紧 connector/provider health status enum，并重新生成 `api-generated.d.ts`。
- 新增 `usePromptTemplateInteraction.ts`，把模板使用时“写入 input + 关闭弹窗”的交互从 `AiAssistant.vue` 拆出。
- 新增 `docs/guide/observability-support-split.md`，记录 Observability support artifact 的候选范围、兼容计划、模块形态和 done criteria，并接入 VitePress sidebar。

验证：
- `node --test scripts/refresh-openapi-snapshot.test.mjs`：5 个测试通过。
- `npm test -- usePromptTemplateInteraction.spec.ts useServerPromptTemplates.spec.ts`：通过。
- `node --test scripts/*.test.mjs`：36 个测试通过。
- `npm test -- usePromptTemplateInteraction.spec.ts useServerPromptTemplates.spec.ts api.spec.ts`：4 个测试文件、56 个测试通过。
- `node scripts/project-health-check.mjs --release-check`：通过。
- `npm run build`（`ai-assistant-ui`）：通过，Package export check OK（27 paths）。
- `mvn package`：通过。
- `npm run build`（`docs`）：通过。

### 阶段 13.39 设计

目标是按最新 1-4 继续推进：observability module skeleton、命令区小切口、OpenAPI refresh dry-run 接入 release-check、bundle baseline 评估。

结果：
- 新增 `ai-assistant-observability-support` Maven module skeleton，并接入 root reactor，为后续真实 support artifact 拆分提供构建落点。
- 新增 `useQuickPromptOptions.ts` 与测试，从 `AiAssistant.vue` 抽出 quick prompt 过滤逻辑。
- `project-health-check --release-check` 增加 `refresh-openapi-snapshot --check --skip-types` dry-run，明确验证静态 snapshot refresh 路径。
- 刷新 `scripts/.bundle-size-baseline.json`，记录当前构建输出。

验证：
- `node scripts/bundle-size-check.mjs --update-baseline`：完成，写入 111 个文件 baseline。

### 阶段 13.40 设计

目标是把上一轮 4 个方向全部落地到可 review 的小切口：
- Observability support artifact 不再只是空 module，先承接 Spring Boot auto-configuration metadata，用于后续 OpenAPI / tracing / logging support 迁移。
- 前端 command palette / prompt template / quick prompt 的触发关系从 `AiAssistant.vue` 继续外移，减少主组件编排代码。
- `refresh-openapi-snapshot --check` 失败时输出可定位的漂移摘要，而不是只提示 stale。
- `bundle-size-check` 输出新增、删除、增长、缩小文件摘要，帮助 review bundle baseline 变化来源。

预期修改：
- `ai-assistant-observability-support/pom.xml`
- `ai-assistant-observability-support/src/main/resources/META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports`
- `scripts/observability-support-module.test.mjs`
- `ai-assistant-ui/src/composables/useAssistantPromptCommands.ts`
- `ai-assistant-ui/src/composables/useAssistantPromptCommands.spec.ts`
- `ai-assistant-ui/src/composables/useBuiltInCommands.ts`
- `ai-assistant-ui/src/components/AiAssistant.vue`
- `scripts/refresh-openapi-snapshot.mjs`
- `scripts/refresh-openapi-snapshot.test.mjs`
- `scripts/bundle-size-check.mjs`
- `scripts/bundle-size-check.test.mjs`
- `task_plan.md`
- `findings.md`
- `progress.md`

约束：
- 不自动 git commit / push。
- 可以运行本轮新增/修改脚本和前端单测；Maven 只跑新增 support module 的轻量单测，不做 package。

结果：
- `ai-assistant-observability-support` 增加对 `ai-assistant-spring-boot-starter` 的依赖，并新增 Spring Boot `AutoConfiguration.imports` metadata，先承接 `AiAssistantOpenApiAutoConfiguration` 的 support artifact 边界。
- 新增 `useAssistantPromptCommands.ts`，把 quick prompt 应用、预置 prompt template 渲染、prompt template dialog 打开和 command palette prompt commands 统一到一个 composable。
- `useBuiltInCommands.ts` 支持 `extraCommands`，command palette 现在可以接收 prompt library / quick prompt 入口。
- `refresh-openapi-snapshot.mjs` 的 `--check` 漂移失败信息增加 path/schema/info.version 摘要。
- `bundle-size-check.mjs` 增加 baseline change summary，覆盖新增、删除、超预算增长和缩小文件。

验证：
- RED 已观察：新增脚本测试因缺少 support metadata、`summarizeSpecDrift`、`summarizeBaselineChanges` 失败；新增前端 spec 因缺少 `useAssistantPromptCommands` 失败。
- `node --test scripts/observability-support-module.test.mjs`：2/2 通过。
- `npm test -- useAssistantPromptCommands.spec.ts useBuiltInCommands.spec.ts`：3/3 通过。
- `node --test scripts/refresh-openapi-snapshot.test.mjs`：6/6 通过。
- `node --test scripts/bundle-size-check.test.mjs`：2/2 通过。
- `node --test scripts/*.test.mjs`：40/40 通过。
- `npm test -- useAssistantPromptCommands.spec.ts useQuickPromptOptions.spec.ts usePromptTemplateInteraction.spec.ts`：5/5 通过。
- `npx vue-tsc --noEmit`：通过。
- `ReadLints` 对本轮改动文件无诊断。
- `mvn -pl ai-assistant-observability-support test` 未完成：卡在 Maven 依赖下载，已停止；本轮未执行 Maven package。

### 阶段 13.41 设计

目标是把用户确认的下一轮 4 项全部做完：
- Observability support artifact 继续迁移 OpenAPI auto-configuration metadata，starter 默认 metadata 不再直接导入 OpenAPI support。
- 清理上一轮遗留的 line-ending-only 工作区噪音，避免继续污染 review。
- 继续收拢 slash command 与 command palette 的 feature action 定义。
- 让 `project-health-check --release-check` 输出 bundle-size 变化摘要。

结果：
- `ai-assistant-server` 的 `AutoConfiguration.imports` 移除 `AiAssistantOpenApiAutoConfiguration`，由 `ai-assistant-observability-support` artifact metadata 承接。
- `ai-assistant-service` 增加 `ai-assistant-observability-support` 依赖，保持 standalone service 的 OpenAPI support 开箱行为。
- `observability-support-split.md` 增加 Maven 使用方式和当前迁移状态。
- 新增 `useAssistantFeatureCommands.ts` 与测试，把 memory、KB、plugins、compare、form-fill 的 slash command / command palette action 集中管理。
- `AiAssistant.vue` 改为从 `useAssistantFeatureCommands` 注入 extra slash commands，并把 prompt + feature palette commands 合并后交给 `useBuiltInCommands`。
- `project-health-check --release-check` 纳入 `bundle-size-check` lane，输出新增/删除/增长/缩小摘要；`dependency-footprint.md` 同步说明 release-check 前需有已构建 dist。
- 执行 `git add -u` 后，上一轮 42 个 line-ending-only 状态清理为工作区干净；没有产生可提交内容。

验证：
- RED 已观察：`observability-support-module.test.mjs` 因 starter metadata 仍导入 OpenAPI、service 缺 support 依赖失败；`useAssistantFeatureCommands.spec.ts` 因缺少模块失败；`vue-tsc` 首次发现 form-fill action 返回 `Promise<boolean>` 类型不匹配。
- `node --test scripts/observability-support-module.test.mjs`：4/4 通过。
- `npm test -- useAssistantFeatureCommands.spec.ts useAssistantPromptCommands.spec.ts useQuickPromptOptions.spec.ts usePromptTemplateInteraction.spec.ts`：7/7 通过。
- `npx vue-tsc --noEmit`：通过。

### 阶段 13.42 设计

目标是把用户再次确认的 4 项继续全部做完：
- Observability support artifact 继续承接 OpenAPI 依赖边界，support artifact 自带 springdoc。
- 为 support artifact 增加最小 Java slice test，验证显式启用 OpenAPI 后能装配 `OpenAPI` bean。
- 将 `/template` slash command 迁移到 `useAssistantPromptCommands`，继续减少 `AiAssistant.vue` inline command 定义。
- 基于最新构建刷新 bundle baseline，消除已确认的 hash chunk 新增/删除噪音。

结果：
- `ai-assistant-observability-support/pom.xml` 增加 Spring Boot BOM、`springdoc-openapi-starter-webmvc-ui` 和 test 依赖。
- 新增 `OpenApiSupportAutoConfigurationTest`，用 `ApplicationContextRunner` 验证 OpenAPI support 显式启用时的 bean wiring。
- `useAssistantPromptCommands` 新增 `slashCommands` 输出，`AiAssistant.vue` 的 `extraCommands` 改为使用 prompt composable 提供的 `/template`。
- `scripts/.bundle-size-baseline.json` 已基于最新 UI 构建刷新，记录 111 个文件。

验证：
- RED 已观察：support script test 缺 springdoc 失败；support Java test 缺 JUnit / Spring Boot test / OpenAPI classpath 失败；prompt command spec 缺 `slashCommands` 失败。
- `node --test scripts/observability-support-module.test.mjs`：5/5 通过。
- `npm test -- useAssistantPromptCommands.spec.ts useAssistantFeatureCommands.spec.ts`：6/6 通过。
- `mvn -pl ai-assistant-observability-support test`：1/1 通过。
- `npm run build`（`ai-assistant-ui`）：通过，Package export check OK（27 paths）。
- `node scripts/bundle-size-check.mjs --update-baseline`：完成，更新 111 个文件 baseline。

### 阶段 13.43 设计

目标是继续完成用户要求的 4 项：
- Observability support 增加 tracing/logstash optional dependency guard。
- Standalone service 的 OpenAPI support 继续通过 support artifact 验证。
- 抽出命令组合层，减少 `AiAssistant.vue` 里手动拼接 slash/palette commands。
- 明确 release-check 的 build 顺序文档。

结果：
- `ai-assistant-observability-support/pom.xml` 增加 `micrometer-tracing-bridge-otel`、`opentelemetry-exporter-otlp`、`logstash-logback-encoder` optional dependencies。
- `observability-support-module.test.mjs` 增加 optional tracing/logstash guard，以及 standalone service 不直接依赖 springdoc 的验证。
- 新增 `useAssistantCommandRegistry.ts` 与测试，统一组合 feature/prompt 的 slash commands 与 command palette extra commands。
- `AiAssistant.vue` 改为使用 `useAssistantCommandRegistry`，不再直接拼接 `extraCommands` 和 palette extra commands。
- `dependency-footprint.md` 增加 release-check 前先 build UI 的本地/CI 顺序。
- `observability-support-split.md` 补充 support artifact 当前自带 springdoc、tracing/logstash optional bridge 的说明。

验证：
- RED 已观察：support guard 缺 optional dependency 失败；command registry spec 缺模块失败。
- `node --test scripts/observability-support-module.test.mjs`：7/7 通过。
- `npm test -- useAssistantCommandRegistry.spec.ts useAssistantPromptCommands.spec.ts useAssistantFeatureCommands.spec.ts`：7/7 通过。
- `mvn -pl ai-assistant-observability-support test`：1/1 通过。

### 阶段 13.44 设计

目标是继续完成用户要求的 4 项：
- 将 tracing / OTLP / logstash bridge 从 starter POM 下沉到 observability support artifact。
- 让 `project-health-check --release-check` 自带 UI build 顺序，并让 CI frontend job 复用该 release lane。
- 将 `useAssistantCommandRegistry` 从 prompt/feature 专用参数改为 command families。
- 基于当前 UI 构建刷新 bundle baseline，消除 hash chunk 新增/删除噪音。

结果：
- `ai-assistant-server/pom.xml` 移除 `micrometer-tracing-bridge-otel`、`opentelemetry-exporter-otlp`、`logstash-logback-encoder`，这些坐标由 `ai-assistant-observability-support` 承接。
- `scripts/project-health-check.mjs` 在 `--release-check` 下先运行 `ai-assistant-ui` 的 `npm run build`，再读取 dist 做 bundle-size / composition 检查。
- `.github/workflows/ci.yml` 的 frontend job 改为复用 `project-health-check --release-check`，减少本地和 CI 检查顺序漂移。
- `useAssistantCommandRegistry` 改为 `families` 输入，`AiAssistant.vue` 只声明 prompt / feature 命令族顺序。
- `scripts/.bundle-size-baseline.json` 已基于当前构建刷新，bundle change summary 为 none / none / none / none。

验证：
- RED 已观察：support guard 因 starter 仍含 tracing/logstash 依赖失败；release-check 顺序测试因缺少 build step 失败；command registry spec 因缺少 `families` 输入失败。
- GREEN：`node --test scripts/observability-support-module.test.mjs scripts/project-health-check.test.mjs`：9/9 通过。
- GREEN：`npm test -- useAssistantCommandRegistry.spec.ts`：1/1 通过。
- `npm run build`（`ai-assistant-ui`）：通过，Package export check OK（27 paths）。
- `node ../scripts/bundle-size-check.mjs --update-baseline`：完成，更新 111 个文件 baseline。
- `node scripts/project-health-check.mjs --release-check`：通过，包含 UI build、47 个脚本测试、静态 OpenAPI 检查、bundle-size 和依赖足迹检查。
- `npm test -- useAssistantCommandRegistry.spec.ts useAssistantPromptCommands.spec.ts useAssistantFeatureCommands.spec.ts`：7/7 通过。
- `mvn package`：通过。
- `npm run build`（`docs`）：通过。

### 阶段 13.45 设计

目标是继续完成用户要求的 4 项：
- 新增 Observability support quick start，分别说明 OpenAPI、Tracing、JSON logging 的最小接入路径。
- 记录 OpenAPI implementation 迁移预研，明确源码从 starter 移到 support module 的候选顺序。
- 新增 support dependency boundary report，展示 starter 与 support artifact 的关键依赖归属，支持 Markdown 输出，并接入 release-check。
- 新增 `useAssistantCommandFamilies` 和 `useAssistantWorkflowCommands`，让 diagnostics / sessions / export 也进入 command family。
- 将 release-check 拆成 `--release-check-fast` 与 `--release-check-full`，保留 `--release-check` 作为 full alias。
- 精简 CI frontend job 中已被 release-check 覆盖的 package exports 检查。

结果：
- 新增 `docs/guide/observability-support-quick-start.md`，并接入 VitePress sidebar。
- `observability-support-split.md` 增加 OpenAPI implementation migration pre-study，记录源码迁移、compatibility shim 和测试扩展顺序。
- 新增 `scripts/support-dependency-report.mjs` 与测试；release-check 增加 `support dependency boundary report`，并支持 `--markdown-out`。
- 新增 `useAssistantCommandFamilies.ts` / `useAssistantWorkflowCommands.ts` 与测试；`AiAssistant.vue` 改为通过 composable 向 registry 传 prompt / feature / workflow families。
- `scripts/project-health-check.mjs` 新增 `--release-check-fast` / `--release-check-full` 分层；`--release-check` 继续作为 full alias。
- `.github/workflows/ci.yml` 移除重复的 `Package exports smoke check`，保留 `Package install smoke check`。
- `dependency-footprint.md` 和 `observability-support-split.md` 同步补充 support report / quick start 入口。

验证：
- RED 已观察：缺 support dependency report 模块、缺 Markdown 输出、缺 quick start 文档/侧边栏、缺 OpenAPI migration pre-study、缺 `useAssistantCommandFamilies` / `useAssistantWorkflowCommands`、缺 release-check fast/full，CI 仍包含重复 exports check。
- GREEN：`node --test scripts/support-dependency-report.test.mjs scripts/project-health-check.test.mjs scripts/observability-support-docs.test.mjs scripts/ci-release-lane.test.mjs`：相关新增脚本测试通过。
- GREEN：`npm test -- useAssistantWorkflowCommands.spec.ts useAssistantCommandFamilies.spec.ts`：2/2 通过。
- `node scripts/project-health-check.mjs --release-check`：通过，包含 support dependency boundary report；bundle change summary 为 none / none / none / none。
- `npm test -- useAssistantCommandFamilies.spec.ts useAssistantCommandRegistry.spec.ts useAssistantPromptCommands.spec.ts useAssistantFeatureCommands.spec.ts`：8/8 通过。
- `mvn package`：通过。
- `npm run build`（`docs`）：通过。
- `ReadLints` 对本轮修改文件无诊断。
- `node scripts/project-health-check.mjs --release-check-full`：通过；刷新 baseline 后 bundle change summary 为 none / none / none / none。
- `node scripts/project-health-check.mjs --release-check-fast`：通过，55 个脚本测试全部通过。
- `npm test -- useAssistantWorkflowCommands.spec.ts useAssistantCommandFamilies.spec.ts useAssistantCommandRegistry.spec.ts useAssistantPromptCommands.spec.ts useAssistantFeatureCommands.spec.ts`：9/9 通过。

### 阶段 13.46 设计

目标是继续完成下一轮优化：
- 将 support dependency Markdown report 接入 CI PR sticky comment。
- 将 repository CI 改跑 `--release-check-fast`，frontend CI 改跑 `--release-check-full`，减少重复但保留完整 gate。
- 将 `AiAssistantOpenApiAutoConfiguration` 实现源码迁入 `ai-assistant-observability-support`，base starter 不再拥有该 implementation。
- 统一 command family API 命名，所有命令族都暴露 `name`、`slashCommands`、`commandPaletteCommands`。
- 刷新 bundle baseline，消除本轮 UI build hash chunk 噪音。

结果：
- `.github/workflows/ci.yml` 的 repository job 新增 fast release lane，frontend job 明确使用 full release lane，PR comment 追加 support dependency boundary section。
- OpenAPI auto-configuration 源码从 `ai-assistant-server` 移入 `ai-assistant-observability-support`，support slice test 覆盖 title、server 和 security schemes。
- `useAssistantCommandRegistry` 与 `useAssistantCommandFamilies` 统一使用 `commandPaletteCommands`，并为 prompt / feature / workflow families 增加 `name`。
- `observability-support-split.md` 从 migration pre-study 更新为 migration status。
- `scripts/.bundle-size-baseline.json` 已基于当前构建刷新，bundle change summary 为 none / none / none / none。

验证：
- RED 已观察：CI release lane 测试因缺 fast/full 分层和 support report comment 失败；OpenAPI ownership 测试因 support module 缺源码且 starter 仍有源码失败；command family 测试因缺 `name` 和 `commandPaletteCommands` 失败。
- GREEN：`node --test scripts/ci-release-lane.test.mjs scripts/observability-support-module.test.mjs scripts/support-dependency-report.test.mjs scripts/project-health-check.test.mjs`：18/18 通过。
- GREEN：`npm test -- useAssistantCommandFamilies.spec.ts useAssistantCommandRegistry.spec.ts useAssistantWorkflowCommands.spec.ts`：3 个测试文件、3 个测试通过。
- `mvn -pl ai-assistant-observability-support test`：1/1 通过。
- `mvn -pl ai-assistant-server test`：621/621 通过。
- `node scripts/project-health-check.mjs --release-check-fast`：通过，59 个脚本测试全部通过。
- `npm run build`（`ai-assistant-ui`）：通过，Package export check OK（27 paths）。
- `node scripts/project-health-check.mjs --release-check-full`：通过。
- `node scripts/bundle-size-check.mjs --update-baseline`：完成，更新 111 个文件 baseline；change summary 为 added none / removed none / over budget growth none / shrunk none。
- `ReadLints` 对本轮修改文件无诊断；`git diff --check` 无空白错误，仅有既有 CRLF/LF 提示。

### 阶段 13.47 设计

目标是继续完成下一轮优化：
- 把 PR metrics comment 拼接从 workflow inline shell 抽成 `ci-metrics-comment.mjs`。
- 给 support artifact 补 host-provided `OpenAPI` bean override 测试。
- 将 app-level command palette 入口纳入 command family。
- 用 CI release lane 测试固化去重审计。
- 完成打包、提交和推送。

结果：
- 新增 `scripts/ci-metrics-comment.mjs`，workflow 只负责生成 bundle / coverage / support dependency report，再调用脚本生成 combined markdown。
- `OpenApiSupportAutoConfigurationTest` 增加 host `OpenAPI` bean 优先生效的覆盖测试。
- 新增 `useAssistantAppCommands`，承接 panel/session/theme/personalize/keyboard help palette entries；`useBuiltInCommands` 只保留 clear/register watch。
- `useAssistantCommandFamilies` 支持 app family，并保持 app / prompt / feature / workflow 的注册顺序。
- `ci-release-lane.test.mjs` 增加去重审计断言，防止 workflow 重新出现已由 health-check 承担的重复 step。

验证：
- RED 已观察：缺 `ci-metrics-comment.mjs`、workflow 仍 inline 拼接 comment、缺 app command family 时对应脚本/UI 测试失败。
- GREEN：`node --test scripts/ci-metrics-comment.test.mjs scripts/ci-release-lane.test.mjs`：5/5 通过。
- GREEN：`npm test -- useAssistantAppCommands.spec.ts useAssistantCommandFamilies.spec.ts useAssistantCommandRegistry.spec.ts`：3 个测试文件、3 个测试通过。
- `mvn -pl ai-assistant-observability-support test`：2/2 通过。
- `node scripts/project-health-check.mjs --release-check-full`：通过，61 个脚本测试通过。
- `mvn package`：通过。
- `npm run build`（`docs`）：通过。
- `node scripts/bundle-size-check.mjs --update-baseline`：完成，更新 111 个文件 baseline；change summary 为 added none / removed none / over budget growth none / shrunk none。

### 阶段 13.48 设计

目标是继续完成下一轮优化：
- 将 `useBuiltInCommands` 改名为职责更准确的 `useCommandPaletteRegistration`。
- 给 `ci-metrics-comment.mjs` 增加 CLI fixture 测试。
- 把 memory / KB palette entries 迁入 feature family，恢复并保护命令入口。
- 更新 public docs，说明 OpenAPI auto-configuration class 现在来自 support artifact。
- 完成打包、提交和推送。

结果：
- 新增 `useCommandPaletteRegistration` 与测试，删除旧 `useBuiltInCommands`。
- `AiAssistant.vue` 改为调用 `useCommandPaletteRegistration`，command definitions 继续来自 app / prompt / feature / workflow families。
- `useAssistantFeatureCommands` 增加 `ai.open-memory` 与 `ai.open-kb` palette entries，并复用 slash command actions。
- `ci-metrics-comment.test.mjs` 增加真实临时文件 CLI 测试。
- `README.md` 和 `observability-support-quick-start.md` 增加 support artifact / `AiAssistantOpenApiAutoConfiguration` 迁移说明。

验证：
- RED 已观察：新 registration composable 缺失、memory/KB palette entries 缺失、docs 缺 OpenAPI class support artifact 说明时对应测试失败。
- GREEN：`npm test -- useAssistantFeatureCommands.spec.ts useCommandPaletteRegistration.spec.ts useAssistantCommandFamilies.spec.ts`：5/5 通过。
- GREEN：`node --test scripts/ci-metrics-comment.test.mjs scripts/observability-support-docs.test.mjs`：6/6 通过。
- `node scripts/project-health-check.mjs --release-check-full`：通过，63 个脚本测试通过。
- `mvn package`：通过。
- `npm run build`（`docs`）：通过。
- `node scripts/bundle-size-check.mjs --update-baseline`：完成，更新 111 个文件 baseline；change summary 为 added none / removed none / over budget growth none / shrunk none。

### 阶段 13.49 设计

目标是继续完成下一轮优化：
- 给 command registry 增加 palette command duplicate id 检测。
- 补 `useCommandPaletteRegistration` 动态更新测试。
- 将 CI metrics comment marker、report 顺序、footer 抽成导出常量/函数并测试。
- 在 support quick start 中加入 starter-only vs with-support OpenAPI 对照说明。
- 完成打包、提交和推送。

结果：
- `useAssistantCommandRegistry` 新增 `duplicatePaletteCommandIds` computed，不改变现有 command merge 行为。
- `useCommandPaletteRegistration.spec.ts` 覆盖 computed command list 变化后重新 clear/register。
- `ci-metrics-comment.mjs` 导出 `CI_METRICS_COMMENT_MARKER`、`CI_METRICS_REPORT_ORDER` 和 `formatCiMetricsFooter`，测试覆盖格式契约。
- `observability-support-quick-start.md` 增加 “Starter only” / “With support artifact” 对照示例。

验证：
- RED 已观察：duplicate id computed 缺失、CI constants 缺失、support quick start 缺 starter-only/with-support 对照时对应测试失败。
- GREEN：`npm test -- useAssistantCommandRegistry.spec.ts useCommandPaletteRegistration.spec.ts`：4/4 通过。
- GREEN：`node --test scripts/ci-metrics-comment.test.mjs scripts/observability-support-docs.test.mjs`：6/6 通过。
- `node scripts/project-health-check.mjs --release-check-full`：通过，63 个脚本测试通过。
- `mvn package`：通过。
- `npm run build`（`docs`）：通过。
- `node scripts/bundle-size-check.mjs --update-baseline`：完成，更新 111 个文件 baseline；change summary 为 added none / removed none / over budget growth none / shrunk none。

### 阶段 13.50 设计

目标是继续完成下一轮优化：
- 在 UI 内部消费 `duplicatePaletteCommandIds`，开发环境输出 warning。
- 为 command families 增加 lightweight metadata：`source` 与 `description`。
- 新增 `scripts/refresh-release-baselines.mjs`，集中刷新 release baseline。
- 给 support quick start 补 starter-only 与 support-enabled POM 示例。
- 完成打包、提交和推送。

结果：
- `AiAssistant.vue` 监听 `duplicatePaletteCommandIds` 并在 dev 环境输出重复 command id warning。
- `useAssistantCommandFamilies` 为 app / prompt / feature / workflow family 增加 source 与 description。
- 新增 `scripts/frontend-command-registry.test.mjs` 和 `scripts/refresh-release-baselines.test.mjs`。
- 新增 `scripts/refresh-release-baselines.mjs`，当前包含 bundle-size baseline refresh step。
- `observability-support-quick-start.md` 增加 starter-only 与 support-enabled POM 对照。

验证：
- RED 已观察：metadata、duplicate id 消费、baseline refresh 脚本、POM 示例缺失时对应测试失败。
- GREEN：`npm test -- useAssistantCommandFamilies.spec.ts useAssistantCommandRegistry.spec.ts`：3/3 通过。
- GREEN：`node --test scripts/frontend-command-registry.test.mjs scripts/refresh-release-baselines.test.mjs scripts/observability-support-docs.test.mjs scripts/ci-metrics-comment.test.mjs`：8/8 通过。
- `node scripts/project-health-check.mjs --release-check-full`：通过，65 个脚本测试通过。
- `mvn package`：通过。
- `npm run build`（`docs`）：通过。
- `node scripts/refresh-release-baselines.mjs`：通过，bundle change summary 为 added none / removed none / over budget growth none / shrunk none。

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
| 2026-05-21 | runtime config 双测试 Maven 命令被 PowerShell 拦截 | `-Dtest=A,B` 中逗号被 PowerShell 当作参数列表语法 | 将整个 `-Dtest=RuntimeConfigControllerTest,RuntimeModelConfigControllerTest` 用双引号包裹 |
