# AI Assistant SDK 优化进度

## 2026-04-29

### 已完成

- 确认本地项目路径为 `D:\project-hub\ai-assistant-sdk`。
- 确认项目当前包含 Java 后端、Vue 组件库、文档站、E2E 测试和部署配置。
- 读取了规划技能说明，按文件规划模式创建任务计划、发现记录和进度记录。
- 运行 `node scripts/check-version-consistency.mjs`，版本一致性检查通过。
- 发现 VitePress 侧边栏存在多个缺失页面，确定为第一批低风险优化项。

### 下一步

- 创建 `docs/assistant-optimization-plan.md`。
- 补齐缺失的 VitePress 文档页面。
- 运行最小文档验证。

### 后续更新

- 已创建 `docs/assistant-optimization-plan.md`。
- 已补齐文档站侧边栏缺失页面：
  - `docs/guide/configuration.md`
  - `docs/guide/chat.md`
  - `docs/guide/function-calling.md`
  - `docs/guide/mcp-server.md`
  - `docs/guide/plugins.md`
  - `docs/guide/kubernetes.md`
  - `docs/api/chat.md`
  - `docs/api/capabilities.md`
  - `docs/api/admin.md`
- 第一次运行 `cd docs && npm run build` 通过，但提示 `env` 代码块语言未加载。
- 已将本次新增文档中的 `env` 代码块改为 `text`。
- 第二次运行 `cd docs && npm run build` 通过，输出无高亮语言警告。
- 已新增 `scripts/project-health-check.mjs`，用于串联轻量健康检查。
- 首次验证脚本时，Windows 下直接启动 `npm.cmd` 出现 `EINVAL`，已记录并修复。
- 第二次尝试手工拼接 `cmd.exe /c` 命令时，引号传递异常，已改为 `shell: true`。
- 运行 `node scripts/project-health-check.mjs --docs` 通过，包含版本一致性检查和文档站构建。

### 启动验证

- 已启动文档站：`http://127.0.0.1:5174/`
  - 已在浏览器打开 `http://127.0.0.1:5174/guide/configuration.html`。
  - 页面标题和正文正常，未出现 404。
- 已启动前端 Playground：`http://127.0.0.1:5175/`
  - 页面可打开。
  - AI 助手悬浮球可见。
  - 点击后助手面板可展开。
- 检查到本机 `8080` 端口已被 Sub2API 服务占用，不是本项目后端。
- 已改用 `18080` 端口启动 `ai-assistant-service`：
  - 健康接口 `http://127.0.0.1:18080/ai-assistant/health` 返回 `success: true`。
  - 使用的是占位 API Key，模型连通性检查出现 401，属于预期结果。
- 当前 Playground 的 Vite 代理仍指向 `http://localhost:8080`，所以聊天和模型列表还没有接到 `18080` 的后端。后续如需完整联调，需要临时调整代理到 `18080`，或释放 `8080` 端口。

### README 入口聚焦

- 已在 `README.md` 顶部新增“先看这里”，集中放置快速开始、配置说明、独立服务部署、前端连接、API 文档、上线清单和排障手册入口。
- 已在 `docs/guide/index.md` 增加“从哪里开始”和“文档地图”，帮助用户先选择 Starter 集成、独立服务、前端接入或上线前检查路径。
- 已在 `docs/guide/quick-start.md` 说明快速开始默认面向 Starter 集成，独立服务用户应优先阅读独立服务和前端连接文档。
- 已更新 `docs/assistant-optimization-plan.md`，将 O-002 标记为部分完成，并记录 README 后续仍需逐段迁移精简。
- 已运行 `node scripts/project-health-check.mjs --docs`，版本一致性检查和 VitePress 文档站构建均通过。

### 配置文档分层

- 已重写 `docs/guide/configuration.md`。
- 新文档按最小可用配置、必填与模型连接、安全相关、性能与资源限制、可选能力、导出与文件处理、独立服务环境变量、前端配置和生产配置基线拆分。
- 配置项已对照 `AiAssistantProperties`、独立服务 `application.yml` 和 `.env.example`，避免文档脱离当前实现。
- 已更新 `docs/assistant-optimization-plan.md`，将 O-004 标记为已完成。
- 已运行 `node scripts/project-health-check.mjs --docs`，版本一致性检查和 VitePress 文档站构建均通过。

### 部署路径检查清单

- 已新增 `docs/guide/deployment-checklists.md`。
- 新页面分别提供 Starter 集成和独立服务部署的适用场景、上线前检查项、前端最小配置和排查重点。
- 已在 `docs/.vitepress/config.ts` 的 Deployment 分组加入新页面。
- 已在 `README.md`、`docs/guide/index.md`、`docs/guide/quick-start.md` 和 `docs/guide/standalone-service.md` 中补充部署路径检查清单入口。
- 已更新 `docs/assistant-optimization-plan.md`，将 O-005 标记为已完成。
- 已运行 `node scripts/project-health-check.mjs --docs`，版本一致性检查和 VitePress 文档站构建均通过。

### 前端集成配方

- 已新增 `docs/guide/frontend-recipes.md`。
- 新页面覆盖手动放置组件、自动挂载、同源后端、独立服务、主题语言、快捷 Prompt、Prompt 模板、组件事件、错误监控、代码块 IDE、会话限制、模型选择和 Web Component。
- 已在 `docs/.vitepress/config.ts`、`README.md`、`docs/guide/index.md` 和 `docs/guide/frontend-standalone.md` 中补充入口。
- 已更新 `docs/assistant-optimization-plan.md`，将 O-006 标记为已完成。
- 已运行 `node scripts/project-health-check.mjs --docs`，版本一致性检查和 VitePress 文档站构建均通过。

### 生产上线清单扩充

- 已扩充 `docs/guide/production-checklist.md`。
- 新增和细化鉴权、CORS、短期 Token、SSRF、链接抓取、Headless 抓取、Admin、连接器管理、MCP、RAG、分 action 限流、日志脱敏、运行时配置摘要和 Actuator 暴露边界检查项。
- 已更新 `docs/assistant-optimization-plan.md`，将 O-007 标记为已完成。
- 已运行 `node scripts/project-health-check.mjs --docs`，版本一致性检查和 VitePress 文档站构建均通过。

### 后端架构维护说明

- 已新增 `docs/guide/backend-architecture.md`。
- 新页面说明后端总体分层、包职责、新功能放置建议、Controller 规则、Service 规则、配置和自动装配规则、扩展点规则和维护检查清单。
- 已在 `docs/.vitepress/config.ts`、`README.md` 和 `docs/guide/index.md` 中补充入口。
- 已更新 `docs/assistant-optimization-plan.md`，将 O-008 标记为已完成。
- 已运行 `node scripts/project-health-check.mjs --docs`，版本一致性检查和 VitePress 文档站构建均通过。

### README API 长段落迁移

- 已新增 `docs/api/reference.md`，承接 REST API 参考、请求示例和端点摘要。
- 已在 `docs/.vitepress/config.ts` 和 `docs/api/index.md` 中接入 REST API 参考页。
- 已将 `README.md` 中原有的大段 API 接口细节替换为 API 文档入口和常用 API 摘要。
- 已更新 `docs/assistant-optimization-plan.md`，补充 O-002 的本轮进展和剩余风险。
- 已运行 `node scripts/project-health-check.mjs --docs`，版本一致性检查和 VitePress 文档站构建均通过。

### 收尾审查

- 已运行 `git diff --check`，未发现空白错误。
- 已最终再次运行 `node scripts/project-health-check.mjs --docs`，版本一致性检查和 VitePress 文档站构建均通过。
- `docs/.vitepress/cache/` 是文档构建生成缓存，不应提交。
- 本轮未创建 git commit 或 push；原因是提交前必须获得用户显式确认。

---

## 2026-05-13 第二轮：AI 助手进化功能

用户接续 5-12 上轮的「10 项进化功能」要求继续推进，最初列出 11 项候选（A1-A4/B5-B8/C9-C11）。
经审计发现 B5/B6/C11/A4 输入端/usePluginRegistry/useKnowledgeBase 已存在，真实缺口 6 项 + 1 项测试补全。

### 已落地

#### A1：多模型并行对话
- 新增 `useMultiModelChat.ts` composable：N 列独立 AbortController + rAF 节流刷新
- 新增 `MultiModelCompare.vue` 覆盖面板：网格布局，1-4 列自适应，每列含模型名/spinner/计时/停止按钮
- 集成入 `AiAssistant.vue`：默认选当前模型 + 第二个候选；通过 `/compare` 斜杠命令打开
- 补全 4×i18n（zh/en/ja/ko）共 8 个文案键
- 构建产物：`MultiModelCompare-iXYz2UAg.js` 10.41 KB（gzip 2.47 KB）

#### A4：TTS 文本转语音
- 新增 `useTextToSpeech.ts` composable：SpeechSynthesis API + 自动语言检测（CJK/ja/ko/en）
- 朗读前剥离 Markdown 与代码块，避免逐字念出语法字符
- `MessageContextMenu.vue` 新增「朗读 / 停止朗读」菜单项（自动检测浏览器支持）
- 同条消息重复点击切换播放/停止，切换到其它条自动取消上一条

#### B7：Prompt 模板管理 UI
- 新增 `usePromptTemplateLibrary.ts` composable：LocalStorage 持久化用户模板，与 options 预置模板合并展示
- 新增 `PromptTemplateDialog.vue`：左侧列表 + 右侧编辑器（名称/模板/变量定义/填写表单/预览/动作）
- 通过 `/template` 斜杠命令打开；点「使用」后渲染后的文本写入主输入框
- 渲染函数 `renderPromptTemplate({{var}})` 已 export 供宿主复用
- 构建产物：`PromptTemplateDialog-K3Cj1K13.js` 15.40 KB（gzip 3.02 KB）

#### B8：代码块 Mermaid + 行号
- `useAiMarkdownRenderer.ts` 新增 `extractMermaidBlocks`：把 ```mermaid 围栏替换成 `<div class="ai-mermaid-placeholder">` 占位符
- 新增 `useMermaidRenderer.ts`：动态 `import('mermaid')`（可选 peer）→ 调 mermaid.render 把占位符替换为 SVG；未安装时降级显示源码
- 在 `vite.config.ts` 把 `mermaid` 标记为 external，避免 build 时 resolve 失败
- 行号通过 CSS counter 实现（`.ai-code-wrap.ai-code-lineno`），逻辑行 ≥ 2 时启用，单行片段不挂行号
- 整套 CSS 新增 `08-late-additions.css` 末尾约 100 行（亮色 + 暗色双适配）

#### C10：性能优化基础设施
- 新增 `useMessageVirtualScroll.ts` 纯算法 composable（不直接操作 DOM，可在 jsdom 单测）
- 索引窗口 + 高度测量缓存 + overscan + 自动失活（消息数 ≤ 60 时降级全量渲染，与现有 `MAX_RENDERED_MESSAGES = 60` 一致）
- 本轮**不强制接入** MessageList：作为 opt-in 工具暴露给宿主，避免破坏现有 UI 行为；后续可由专项 PR 接入

#### A2：RAG 后端架构对齐
- 审计 `ai-assistant-server` 发现 RAG 端点是 `POST /admin/rag/ingest`（管理员端点，全局共享知识库）
- 前端 `useKnowledgeBase` 当前 LocalStorage + ragPromptFragment 模式是**用户级私有知识库**语义，与后端 admin RAG 不是同一概念
- 本轮**不对接**，避免把"用户私有"误连到"全局共享"。详细决策见 `findings.md`「A2 RAG 决策」段

#### A3：MCP 客户端 composable
- 新增 `useMcpClient.ts`：HTTP JSON-RPC 客户端，可连任何兼容 MCP server（默认指向自家 `/ai-assistant/mcp`）
- 提供 `initialize` / `listTools` / `callTool` / `reset`，错误抛 `McpRpcError`
- 支持自定义 `fetchImpl`（SSR / 测试可注入）、`timeoutMs`、`token`（双头注入 `Authorization: Bearer` + `X-AI-Token`）
- 本轮**不强制接入** AiAssistant：作为独立工具暴露，宿主可通过 `usePluginRegistry` 把 MCP tool 注册成按钮

#### C9：测试补全
- 新增 5 个 `.spec.ts`：A1/A4/B7/C10/A3 共 41 个新测试
- 总测试数 155 → 195，全部通过

### 验证

- `npm run build:lib`：✅ 通过（产物 `ai-assistant.mjs` 542 → 564 KB，gzip 124 → 130 KB；其它都是独立 chunk）
- `npm test`：✅ 195/195 全通过
- `ReadLints` 对所有新增文件：✅ 无 lint 错误
- 现有 5 个预先存在的 vue-tsc 类型错误（`plugins.value` / `slashCommands undefined` / `useVoiceInput`）**与本轮无关**，未处理

### 新增文件清单

```
ai-assistant-ui/src/composables/
├── useMultiModelChat.ts            (A1)
├── useMultiModelChat.spec.ts       (A1)
├── useTextToSpeech.ts              (A4)
├── useTextToSpeech.spec.ts         (A4)
├── usePromptTemplateLibrary.ts     (B7)
├── usePromptTemplateLibrary.spec.ts(B7)
├── useMermaidRenderer.ts           (B8)
├── useMessageVirtualScroll.ts      (C10)
├── useMessageVirtualScroll.spec.ts (C10)
├── useMcpClient.ts                 (A3)
└── useMcpClient.spec.ts            (A3)

ai-assistant-ui/src/components/
├── MultiModelCompare.vue           (A1)
└── PromptTemplateDialog.vue        (B7)
```

### 修改文件清单

```
ai-assistant-ui/
├── src/components/AiAssistant.vue          # 接入 A1/A4/B7/B8 + 2 个斜杠命令
├── src/components/MessageContextMenu.vue   # 新增 TTS 朗读按钮
├── src/composables/useAiMarkdownRenderer.ts# Mermaid 占位符抽取 + 行号支持
├── src/components/styles/08-late-additions.css # Mermaid + 行号 CSS
├── src/utils/i18n/{types,zh,en,ja,ko}.ts   # 17 个新 i18n 键
├── src/index.ts                            # export 新 composable + 类型
└── vite.config.ts                          # mermaid 标记为 external
```

### 跳过 / 不做的项

- **A2 后端 RAG 真对接**：架构语义不匹配，详见 findings.md。
- **A4 BBTSU 朗读 / 暂停**：composable 已实现 pause/resume，但 UI 只暴露播放/停止两态；后续如需可补「暂停」按钮。
- **B8 PlantUML**：仅做了 Mermaid；PlantUML 需要后端渲染或单独 client，未做。
- **B8 「运行代码片段」**：浏览器侧运行 JavaScript/CSS 片段是另一个独立工程（沙箱、CSP 等），未做。
- **C10 真接入 MessageList**：composable 已就绪，但实际接入会大改 MessageList 的渲染逻辑，留作专项 PR。
- **C10 Markdown Worker 化**：与 hljs 的动态语言加载冲突较大，性价比低，未做。
- **B5/B6/C11**：现状已完整或基本完整，未做新增（详见审计表格）。

### 第二轮收尾（2026-05-13 后段）

用户在第二轮主体提交后追加 4 步指令：「检查代码 / 修复问题 / 推送远程 / 继续扩展」，继续推进：

| 阶段 | 任务 | 状态 |
|------|------|------|
| 收尾.1 | 全量 TS / Lint / build / test 检查 | ✅ 完成 |
| 收尾.2 | 修真实可修问题 | ✅ TS 错误 4 → 0；Lint 错误 4 → 1（pre-existing） |
| 收尾.3 | git commit + push 远程 main | ✅ commit `44eea04` 推送成功 |
| 收尾.4.1 | useMcpAutoPlugin：MCP tools 自动注册为 plugin | ✅ +8 测试，commit `21ff602` |
| 收尾.4.2 | useMermaidRenderer.spec.ts（B8 测试补全） | ✅ +5 测试 |
| 收尾.4.3 | TTS pause/resume 按钮（A4 增强） | ✅ MessageContextMenu + 4×i18n |
| 收尾.4.4 | fetchPromptTemplates（B7 服务端模板拉取） | ✅ +5 测试 |
| 收尾.4.5 | C10 真接入 MessageList 虚拟滚动 | ⚠ 跳过 |

#### useMcpAutoPlugin（A3 进阶接入）

- 新增 `useMcpAutoPlugin.ts` composable：把 `useMcpClient.listTools()` 的结果一键注册成 `usePluginRegistry` 中的按钮
- 默认前缀 `mcp:`、默认 position `context`（右键菜单），可覆盖
- 默认 buildArgs 用当前输入框文本作为 `input` 字段；默认 onToolResult 把 text content 作为助手消息追加；默认 onError 走 console.error，全部可覆盖
- 重新 sync 时自动 unregister 上次注册的所有按钮，避免堆积；提供 `dispose()` 用于组件卸载
- 8 个单元测试覆盖：默认前缀 / 自定义 prefix+position / 重 sync 清理 / 默认结果 / 自定义 buildArgs+onToolResult / isError 路径 / listTools 失败 / dispose

#### useMermaidRenderer.spec.ts（B8 测试补全）

- 5 个单元测试：成功渲染 / `data-mermaid-rendered=true` 标记 / 已渲染条目默认跳过 / `force` 重渲染 / 无 placeholder 安全空操作 / null root 安全空操作 / render 抛错时 fallback 显示源码 + 错误信息
- 为支持测试通过，把 `useMermaidRenderer.ts` 中的 `import('mermaid')` 改为 `const MERMAID_PKG = 'mermaid'; import(MERMAID_PKG)`，避免 Vite/Vitest 在 transform 阶段尝试静态解析 mermaid

#### TTS pause/resume（A4 增强）

- `MessageContextMenu.vue` 在「朗读 / 停止」按钮旁新增「暂停 / 继续」按钮（仅 ttsActive 时显示）
- 新增 prop `ttsPaused: boolean` 和事件 `ttsPauseToggle`
- `AiAssistant.vue` 新增 `ttsPauseToggle()` 函数：根据 `tts.paused.value` 调用 `tts.pause()` 或 `tts.resume()`
- i18n 4 语言新增 `ttsPause` / `ttsResume` 共 8 个新键

#### fetchPromptTemplates（B7 服务端模板拉取）

- `utils/api.ts` 新增 `fetchPromptTemplates(baseUrl, token)` + `PromptTemplateEntry` / `PromptTemplatesListResult` 类型
- 标准化处理后端 `GET /templates` 的扁平数组返回（即使端点不存在或返回 400/503，安静地降级为空数组）
- `AiAssistant.vue` `onMounted` 拉取一次；用户每次通过 `/template` 斜杠命令打开模板 dialog 也刷新一次
- 服务端模板以 `server:` 为 id 前缀，与 `options.promptTemplates` 合并到 `presetTemplates` 中，在 dialog 中以「预置」徽章展示（只读）
- 5 个 spec.ts 单测：扁平数组解析 / X-AI-Token 头注入 / 非 2xx 错误 / 非数组响应 / 跳过 malformed 条目 / 网络错误

#### C10 真接入跳过的理由

- `useMessageVirtualScroll` 已作为独立 composable + 7 个单测落地
- 真接入需要：a) `.ai-body` 上挂 scroll listener；b) ResizeObserver 测量每条消息真实高度；c) 渲染顶/底 spacer；d) 处理 `MAX_RENDERED_MESSAGES = 60` 折叠（`hiddenOlderCount` banner）与虚拟窗口的优先级冲突
- 当前 `MAX_RENDERED_MESSAGES = 60` 机制已为长会话提供了基础缓解；真虚拟滚动应作为独立 PR，单独评估对现有 UX 契约的影响
- 本轮把 composable 暴露在公开 API 中，宿主可在自有组件中调用尝试

### 第二轮收尾最终验证

- `npm run build:lib`: ✅ 通过；主 bundle gzip 130.07 → 130.10 KB（几乎无新增）
- `npm test`: ✅ **213/213** 通过（从 195 增加 18 个新测试）
- `npx vue-tsc --noEmit`: ✅ 0 errors
- `npm run lint`: ✅ 0 errors（剩 1 个 pre-existing ConnectionDiagnostics warning，未动）

## 2026-05-13 第三轮：UX 现代化（v2 科技蓝 + 第三波交互精修）

用户反馈紫粉（v1）"娘们唧唧"，要求改色 + 继续推 UX 27 项清单的第三波。

### 主题色 v2：sky tech blue

- 主色梯度从 indigo/purple/pink (`#818cf8/#c084fc/#f472b6`) → sky/cyan/blue (`#0ea5e9/#06b6d4/#3b82f6`)
- `09-modern-overhaul.css` 全文 hex + rgb 替换（72 行差异）+ 暗色模式同步用 sky-400 系
- `ai-assistant-vue-playground/src/main.ts`: `primaryColor` 同步换色
- commit `26649af` 已 push

### UX 第三波（commit 待定）

| # | 项 | 实现 |
|---|----|------|
| #2 | 模式按钮胶囊化 | `09` 高 specificity 重写 `.ai-mode-bar/.ai-quick-actions button` → 圆角 999px + 玻璃 + active 渐变填充 |
| #6 | 顶栏图标统一玻璃风格 | `09` 统一为 28px 玻璃方块；隐藏 personalize/diagnostics 文字标签；hover 上浮 + 渐变 |
| #12 | 滚动到底部按钮样式 | 业务逻辑已存在（`showScrollToBottomBtn` + `scrollToBottomClick`）；本轮补玻璃质感圆形 floating 样式 |
| #14 | 链接预览卡片化 | `.ai-md a[href]` chip 样式：内联玻璃徽章 + 🔗 前缀图标 + hover 上浮，无需 JS |
| #18 | 图片附件点击放大 | `panelRef` 事件委托：监听 `img.click` → 创建 `.ai-image-lightbox-overlay` 全屏覆盖（DOM 直挂 body 摆脱 z-index）；Esc/点击/×关闭；CSS hover 微缩放 |
| #20 | 响应式 < 600px 全屏 | media query：panel 强制 100vw/100vh + 圆角归零 + 隐藏 resize handle + 标题字号下调 |
| #27 | 暗色一键切换 | `AssistantHeader.vue` 加 theme-toggle 按钮（太阳/月亮 icon 自动切换）；`AiAssistant.vue` 加 `userThemeOverride` ref + `toggleManualTheme()`，覆盖 `options.theme`，持久化 `localStorage["ai-assistant-user-theme-override"]` |

### 主动跳过

- **#19 统一 Settings 抽屉**：refactor 涉及 PersonalizeDialog + ConnectionDiagnostics 合并，工作量较大；当前两个独立入口在新 `#6 顶栏统一` 后已无视觉混乱，推迟到独立 PR

### i18n 新增（×4 语言共 12 键）

- `themeToggleToDark` / `themeToggleToLight` / `imageLightboxClose`

### 第三轮验证

- `npm run build`: ✅ 通过；`style.css` 134.44 → 141.96 KB（+5.6%），主 bundle 576.00 → 581.26 KB（+0.9%）
- `npm test`: ✅ **213/213** 通过（无新增测试，本轮主要 CSS + UI）
- `npm run build:types` (vue-tsc): ✅ 0 errors
- `npm run lint`: ✅ 0 new errors（pre-existing 1 error + 2 warnings 未动）

## 2026-05-13 第四轮：UX 第四波 + Server feature + Tooling

用户从 `继续推进` → `都修` → `开始 自行演进小助手的优化` → 三轮持续放权
让助理自主推进。本会话共完成 17 个 commit，按主题分四簇：

### Cluster 1: UX 第四波 5 项顺眼调整 (commit `efea80b`)

| # | 改动 |
|---|---|
| #A1 | 思考过程默认折叠为 inline 小药丸（22px 高），点击展开成全宽面板 |
| #A2 | 用户胶囊缩到 78% 宽 + 推右；铅笔编辑仅 hover 显示 |
| #A3 | 模式按钮从输入框上方移到 model-row 内，紧凑分段控件 |
| #A4 | 助手头像加 "AI" 字样（loading 时变成 ...） |
| #A5 | starter 点击填入输入框时去掉 emoji 前缀（emoji 仅作图标） |

### Cluster 2: Server-side 新功能与代码整理（commits `9f3567f` `2ce2d4d` `671c523`）

| Commit | 内容 |
|---|---|
| `9f3567f` | AdminAuthFilter 守卫 `/admin/**` 路径，X-Admin-Token + X-AI-Token 回退，常量时间 MessageDigest.isEqual 防时序攻击 |
| `2ce2d4d` | ChatRequest 新增 pageContext (≤20KB) + sessionId 字段；LlmService chat/chatStream 7 参重载透传 pageContext；Controller 错误前缀化（[QUOTA_EXCEEDED] / [RATE_LIMITED] / [TIMEOUT] / [VALIDATION_ERROR] / [LLM_ERROR]） |
| `671c523` | 31 个 server java 文件应用 google-java-format，纯格式化无功能影响 |

### Cluster 3: 体验闭环 D 系列（commits `f5e5b04` `a68f102` `61f0c5a` `b36b260` `e8f9bcc` + lint cleanup `7fa9a87`）

| ID | Commit | 价值 |
|---|---|---|
| D4 | `f5e5b04` | 页面上下文 UI 徽章（footer 显示已附 N 块 + 一键开关），闭环 server-side pageContext feature |
| D5 | `a68f102` | 流式 progress chip（chars + elapsed），1Hz tick + tabular-nums 防抖 |
| D2 | `61f0c5a` | Settings 齿轮按钮聚合 personalize + diagnostics 入口 + popover 菜单 |
| D1 | `b36b260` | ResizeObserver 真实测量消息高度，给 useMessageVirtualScroll 提供精准 spacer |
| D3 | `e8f9bcc` | adminApi.ts SDK 包装 15 个 admin endpoints + 14 个新单测；不写 admin UI 而是给宿主提供 type-safe client |

### Cluster 4: 工具感增强 + 工程化护栏 E/F/G 系列

| ID | Commit | 价值 |
|---|---|---|
| E1 | `35801ab` | KeyboardShortcutsDialog.vue + Ctrl+/ 触发，3 组 17 行快捷键，平台自适应 ⌘/Ctrl，真实键帽样式 |
| E2 | `c726a07` | TTFT (Time To First Token) 加到 D5 progress chip：`首字 1.2s · 234 字 · 3.5s` |
| E3 | `bbece20` | scripts/generate-changelog.mjs 解析 178 conventional commits 自动分类，GitHub commit 链接，按日期组织 |
| F2 | `102cbd8` | scripts/bundle-size-check.mjs + baseline JSON：24 文件 size 监控 + gzip 计算 + colored diff + --max-delta-percent 阈值告警 |
| F5 | `b909cfd` | scripts/release.mjs 一键发版：version bump + 5 个文件同步 + CHANGELOG + git tag |
| F4 | `7ec9691` | 代码块语言 chip + 长代码（≥20 行）折叠按钮 + 渐变遮罩 |
| F3 | `539ccf5` | active search match 跳转 ring pulse 动画（:has() + prefers-reduced-motion） |
| G6 | (下一 commit) | CI ci.yml frontend job 加 bundle-size-check 步骤，超 +10% gzip 阻塞 PR |

### 本会话验证

| 指标 | 起点 | 终点 |
|---|---|---|
| 单元测试 | 213/213 | **227/227** (+14 admin specs) |
| vue-tsc | 0 错 | 0 错 |
| ESLint | 1 err + 2 warn (pre-existing) | **0 / 0** |
| bundle gzip | 未监控 | **316.46 KB / 24 files** (baseline 已建) |
| CHANGELOG | 无 | **700+ 行 / 14 days** 自动生成 |

### 核心交付清单

新增工具脚本（4 个）：
- `scripts/generate-changelog.mjs`
- `scripts/bundle-size-check.mjs`
- `scripts/.bundle-size-baseline.json`
- `scripts/release.mjs`

新增前端模块（2 个）：
- `ai-assistant-ui/src/utils/adminApi.ts` + `.spec.ts`
- `ai-assistant-ui/src/components/KeyboardShortcutsDialog.vue`

新增 server feature（1 个）：
- `ai-assistant-server/.../config/AdminAuthFilter.java`

更新文件：
- `CHANGELOG.md` 由 generate-changelog.mjs 全量生成
- `09-modern-overhaul.css` 累计 +~500 行（UX 第四波 + D4/D5/D2/E1/F4/F3 各类徽章/分段控件/折叠/动画样式）
- 4 语言 i18n 共新增 ~30 个键

### 关键判断记录

1. **D1 增强而非重做**：发现 C10 其实已在 `8f5b3ef` 接入，剩余工作是 ResizeObserver 测量精度
2. **D2 走 MVP 而非完整 drawer 重构**：齿轮 + popover 30min 达成视觉简化，避免 4-6h dialog 提取
3. **D3 改为 SDK 而非独立 UI**：admin endpoints 比 UI 普适，宿主可在任何运维系统复用
4. **D5 用 chars/s 而非 tokens/s**：前端不知道 tokenizer，chars 更直观
5. **F3 发现已完整 + 仅补 visual polish**：搜索系统完整，新增的 ring pulse 仅作视觉强化
6. **server 35 文件分 3 个 commit (A 真功能 / B 新文件 / C 格式化)**：替别人 commit 但保留清晰边界，便于将来 bisect

### 后续可继续方向

- G1 历史会话抽屉（替代 tabs，可重命名/收藏/搜索）
- G2 PWA service worker + manifest（离线缓存）
- G3 a11y 全面审计 + 修补
- G5 playground 加 admin dashboard 示例（用 D3 SDK 写演示）
- F5 真实发版（v1.0.1 / v1.1.0）打 tag
