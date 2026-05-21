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

### 后续可继续方向（部分已在第五轮落地）

- ~~G1 历史会话抽屉~~ → 已落地 commit `104b4ba`
- ~~G3 a11y 全面审计 + 修补~~ → 已落地 commit `683eca5` (H2 MVP)
- ~~G5 playground 加 admin dashboard 示例~~ → 已落地 commit `6d4cdeb`
- ~~F5 真实发版打 tag~~ → 已落地 commit `9d41d6f` (H3 v1.0.1)
- G2 PWA service worker + manifest（离线缓存）→ 留待 H1

## 2026-05-13 第五轮：会话治理 + 搜索强化 + a11y 兜底 + 真实发版

承接第四轮"自行演进"，用户继续放权 → 推进 G/H 两簇 8 个 commit。本轮
聚焦于把前几轮基础设施（D3 admin SDK / F2 bundle / E3 changelog / F5
release）真正闭环、落地，并补 a11y 兜底。

### Cluster G: 工程化护栏与文档（commits `9b5445f` `6d4cdeb` `104b4ba`）

| ID | Commit | 价值 |
|---|---|---|
| G6 | `9b5445f` | CI ci.yml frontend job 加 bundle-size-check 步骤，超 +10% gzip 阻塞 PR |
| G4 | `9b5445f` (合一) | progress.md 追加第四轮 17 commit 完整总结 |
| G5 | `6d4cdeb` | playground 加 AdminDemoPanel.vue：5 endpoints 一键试调、token input、JSON pretty + 耗时统计；同时更新 bundle-size baseline |
| G1 | `104b4ba` | SessionsDrawer.vue：齿轮菜单新增"All sessions"入口，按时间桶分组（今/昨/本周/更早），filter 搜索，hover-only 删除 |

### Cluster H: 体验深化 + 真实发版（commits `9d41d6f` `9fe087d` `b800a53` `683eca5`）

| ID | Commit | 价值 |
|---|---|---|
| H3 | `9d41d6f` | **首次真实跑通 release.mjs**：1.0.0 → v1.0.1，3 pom + package.json + lock + CHANGELOG 全自动同步，tag 已 push origin。publish.yml 仅在 GitHub Release 网页发布触发，所以 push tag 不会自动发 npm/docker，安全 |
| H5 | `9fe087d` | SessionEntry 加 pinned，useMultiSession 新增 renameSession / togglePinSession；SessionsDrawer item 重构为 main + actions 组（pin ★ / rename ✎ / delete ×），inline rename input + Enter 提交 + Esc 取消；Pinned 分组永远置顶 |
| H6 | `b800a53` | useSessionSearch 新增 buildSearchRegex 工具 + 3 toggle ref (caseSensitive / wholeWord / regex)；highlightSearchInHtml 加可选 options 参数（向后兼容）；搜索框旁加 Aa / W / .* 三个 toggle 按钮 |
| H2 | `683eca5` | 全局 `:focus-visible` 科技蓝 ring + `:focus:not(:focus-visible)` 抑制鼠标焦点；全局 `@media (prefers-reduced-motion)` 强压动画/过渡到 0.01ms；SessionsDrawer aria-label 补漏 |

### 第五轮验证

| 指标 | 第四轮起点 | 第五轮终点 |
|---|---|---|
| 版本 | 1.0.0-SNAPSHOT | **v1.0.1** (tag 已推 origin) |
| 单元测试 | 227/227 | 227/227（H6 改 useSessionSearch 内部逻辑但向后兼容 spec 全过） |
| ESLint | 0/0 | 0/0 |
| WCAG 2.4.7 Focus Visible | 部分 | ✅ 全覆盖 |
| WCAG 2.3.3 Reduced Motion | ❌ | ✅ |
| 会话管理能力 | tabs only | tabs + 抽屉 + 时间分组 + 收藏 + 重命名 + 内容搜索 |
| 搜索能力 | substring | + caseSensitive / wholeWord / regex |
| Settings 入口 | personalize + diagnostics + sessions（独立按钮 3 个）| 单齿轮 + popover 3 项菜单 |

### 关键判断（第五轮）

1. **G6 CI 集成最小化**：复用 ci.yml frontend job，append 一步而不是新建独立 workflow（避免重复 install / build）
2. **G5 AdminDemoPanel 独立组件**：playground 主入口保持简洁；demo 折叠默认收起，不污染 AI 助手 demo 主线
3. **H3 安全跑真发版**：审计了 publish.yml 的 trigger（`release: published`），确认 push tag 不会触发 npm publish / docker build；release.mjs 设计上不自动 push，由用户显式 `git push --follow-tags`
4. **H5 inline edit + 公共 hover actions**：弃用 prompt() 原生 dialog；rename / pin / delete 三按钮 hover-only 显示，避免常驻干扰
5. **H6 公共工具复用**：buildSearchRegex 同时被 searchMatchedIndices 和 highlightSearchInHtml 调用，保证两端 regex 完全一致，杜绝"匹配到但没高亮"或反之的逻辑漂移
6. **H2 :focus-visible 不是 :focus**：键盘聚焦才显示 ring，鼠标点击不污染视觉，符合现代 a11y 最佳实践；prefers-reduced-motion 整段压扁是一行配置但覆盖所有 30+ 处动画

### 累计 24 commit（D + E + F + G + H 簇）

完整时间线见 git log；CHANGELOG.md 已由 E3 generate-changelog.mjs 自动维护。

---

## 2026-05-20 第六轮：深度分析后的按序整改

### 本轮启动

用户要求对 `D:\project-hub\ai-assistant-sdk` 深度分析后“按顺序全部”开始整改。

已确认顺序：
1. 继续拆分 `AiAssistant.vue`，先抽批量导出编排。
2. 统一 `/stream` 与 `/sse` 的协议定位。
3. 增加生产安全基线检查或启动告警。
4. 梳理 `@ai-assistant/vue` 公共 API 分层。

### 当前阶段 13.1

状态：已完成。

目标：
- 检查后发现批量导出主体已经由 `useExportActions.ts` 承接。
- 当前阶段调整为：在不改变用户行为的前提下，把 `AiAssistant.vue` 中剩余的批量选择/删除状态与方法迁移到 `useMessageSelection.ts`。
- 补充聚焦单测，验证选择模式切换、索引选择、降序删除和无效索引处理。

约束：
- 本轮不自动执行 npm build/test、Maven 构建或 git commit。
- 如需执行静态检查命令，会先征得用户确认。

### 阶段 13.1 结果

新增：
- `ai-assistant-ui/src/composables/useMessageSelection.ts`
- `ai-assistant-ui/src/composables/useMessageSelection.spec.ts`

修改：
- `ai-assistant-ui/src/components/AiAssistant.vue`
- `task_plan.md`
- `findings.md`
- `progress.md`

验证：
- `ReadLints` 对新增 composable、spec、`AiAssistant.vue` 和规划文件无诊断。
- 经用户允许运行 `npm test -- useMessageSelection.spec.ts`。
- 结果：1 个测试文件通过，4 个测试通过。

### 当前阶段 13.2

状态：已完成。

目标：
- 梳理 `/stream` 与 `/sse` 的真实使用关系。
- 明确兼容主通道和标准 SSE 通道边界。
- 优先通过文档或小范围代码复用减少后续分叉风险。

### 阶段 13.2 结果

修改：
- `ai-assistant-server/src/main/java/com/aiassistant/controller/AiAssistantController.java`
- `ai-assistant-server/src/main/java/com/aiassistant/controller/SseStreamController.java`
- `docs/api/chat.md`
- `docs/api/reference.md`
- `docs/guide/architecture.md`
- `docs/guide/sequence-diagrams.md`
- `README.md`
- `ai-assistant-service/README.md`

结论：
- `/stream` 定位为兼容流式端点，是官方 UI、Java Client 和 E2E 当前默认入口。
- `/sse` 定位为标准化 SSE 端点，提供 `event: message` / `event: done` / `event: error`。
- 本阶段不改运行逻辑，降低回归风险。

验证：
- `ReadLints` 对相关 Java/Markdown 文件无诊断。

### 当前阶段 13.3

状态：已完成。

目标：
- 增加生产安全基线检查脚本或等价护栏。
- 优先覆盖空 token、宽 CORS、query token、SSRF 关闭、高风险能力开启等危险配置。

### 阶段 13.3 结果

新增：
- `scripts/production-config-lint.mjs`
- `scripts/production-config-lint.test.mjs`

修改：
- `scripts/project-health-check.mjs`
- `docs/guide/production-checklist.md`
- `task_plan.md`
- `progress.md`

验证：
- `ReadLints` 对相关文件无诊断。
- `node --test scripts/production-config-lint.test.mjs`：5 个测试全部通过。
- `node scripts/production-config-lint.mjs --strict --file docker-compose.prod.yml`：无问题。

### 当前阶段 13.4

状态：已完成。

目标：
- 梳理 `@ai-assistant/vue` 公共导出面。
- 先通过文档和注释分层稳定 API / 可选高级能力 / 实验性工具，不删除现有导出。

### 阶段 13.4 结果

修改：
- `docs/guide/frontend-recipes.md`
- `ai-assistant-ui/src/index.ts`
- `task_plan.md`
- `progress.md`

结论：
- 将公共导出分为主接入层、后端 API helper、管理与扩展层、UI 工具层、低层算法/实验层。
- 在 `index.ts` 导出区增加维护提示，约束后续内部 refactor 不默认 re-export。
- 未删除任何现有导出，保持下游兼容。

验证：
- `ReadLints` 对相关文件无诊断。

### 当前阶段 13.5

状态：已完成。

目标：
- 固化 Helm / Kubernetes 生产基线。
- 将访问令牌、Admin 令牌和运行时配置加密密钥纳入 Helm Secret 注入。
- 补齐 Kubernetes 文档里的 Secret、CORS、rate limit、Redis/session/memory 和 Actuator 说明。

### 阶段 13.5 当前结果

修改：
- `helm/ai-assistant/values.yaml`
- `helm/ai-assistant/templates/secret.yaml`
- `helm/ai-assistant/templates/deployment.yaml`
- `docs/guide/kubernetes.md`
- `docs/guide/production-checklist.md`
- `docs/guide/deployment-checklists.md`
- `ai-assistant-service/README.md`
- `scripts/production-config-lint.mjs`
- `scripts/production-config-lint.test.mjs`
- `task_plan.md`
- `progress.md`

验证：
- `ReadLints` 对相关 Helm / Markdown / Node 文件无诊断。
- `helm template ai-assistant ./helm/ai-assistant ...` 未执行成功：当前机器未安装 `helm`。
- `node scripts/project-health-check.mjs --prod-config --strict` 未通过：本地 `.env` 使用空访问 token 和宽 CORS，触发 high-severity。
- `node --test scripts/production-config-lint.test.mjs`：6/6 通过。
- `node scripts/production-config-lint.mjs --strict --file docker-compose.prod.yml`：通过。
- `node scripts/production-config-lint.mjs --strict --file helm/ai-assistant/values.yaml`：0 high-severity，仅模板占位 WARN。
- `mvn package`：通过。
- `npm run build`（`ai-assistant-ui`）：通过。

### 当前阶段 13.6

状态：已完成。

目标：
- 继续拆分 `AiAssistant.vue`。
- 将 Compare regions 编排迁移到独立 composable。
- 保持 `CompareRegionsDialog.vue` 展示和多模型 `/compare` 面板行为不变。

修改：
- 新增 `ai-assistant-ui/src/composables/useCompareRegions.ts`
- 新增 `ai-assistant-ui/src/composables/useCompareRegions.spec.ts`
- 修改 `ai-assistant-ui/src/components/AiAssistant.vue`
- 修改 `ai-assistant-ui/REFACTORING_PLAN.md`
- 修改 `task_plan.md`
- 修改 `progress.md`

验证：
- RED：`npm test -- useCompareRegions.spec.ts` 首次失败，原因是缺少 `useCompareRegions` 模块。
- GREEN：`npm test -- useCompareRegions.spec.ts` 通过，5/5。
- `ReadLints` 对 `useCompareRegions.ts`、spec 和 `AiAssistant.vue` 无诊断。
- `npm run build:types`：通过。

### 当前阶段 13.7

状态：已完成。

目标：
- 继续拆分 `AiAssistant.vue`。
- 将 KB drop / KB picker 编排迁移到独立 composable。
- 保持 `useFabDropIngest` 的拖拽事件边界不变。

修改：
- 新增 `ai-assistant-ui/src/composables/useKnowledgeDrop.ts`
- 新增 `ai-assistant-ui/src/composables/useKnowledgeDrop.spec.ts`
- 修改 `ai-assistant-ui/src/components/AiAssistant.vue`
- 修改 `ai-assistant-ui/REFACTORING_PLAN.md`
- 修改 `task_plan.md`
- 修改 `progress.md`

验证：
- RED：`npm test -- useKnowledgeDrop.spec.ts` 首次失败，原因是缺少 `useKnowledgeDrop` 模块。
- GREEN：`npm test -- useKnowledgeDrop.spec.ts` 通过，6/6。
- `ReadLints` 对 `useKnowledgeDrop.ts`、spec 和 `AiAssistant.vue` 无诊断。
- `npm run build:types`：通过。

### 当前阶段 13.8

状态：已完成。

目标：
- 继续拆分连接诊断状态。
- 将纯状态/文案映射迁移到独立 composable。
- 保持网络请求和配置保存流程不变。

修改：
- 新增 `ai-assistant-ui/src/composables/useConnectionDiagnosticsState.ts`
- 新增 `ai-assistant-ui/src/composables/useConnectionDiagnosticsState.spec.ts`
- 修改 `ai-assistant-ui/src/composables/useAssistantDiagnostics.ts`
- 修改 `ai-assistant-ui/REFACTORING_PLAN.md`
- 修改 `task_plan.md`
- 修改 `progress.md`

验证：
- RED：`npm test -- useConnectionDiagnosticsState.spec.ts` 首次失败，原因是缺少 `useConnectionDiagnosticsState` 模块。
- GREEN：`npm test -- useConnectionDiagnosticsState.spec.ts` 通过，5/5。
- `ReadLints` 对 `useConnectionDiagnosticsState.ts`、spec 和 `useAssistantDiagnostics.ts` 无诊断。
- `npm run build:types`：通过。

### 当前阶段 13.9

状态：已完成。

目标：
- 强化协议契约测试。
- 先补齐 `/sse` 标准化事件类型的后端契约。

修改：
- `ai-assistant-server/src/test/java/com/aiassistant/controller/SseStreamControllerTest.java`
- `task_plan.md`
- `progress.md`

验证：
- 首次运行 `mvn -pl ai-assistant-server -Dtest=SseStreamControllerTest test` 失败，原因是 Mockito 无法区分 `chatStream` 的 `String` 与 `List<String>` 重载。
- 已用 `any(List.class)` 明确匹配 `/sse` 实际调用的 imageDataList 重载。
- 重跑 `mvn -pl ai-assistant-server -Dtest=SseStreamControllerTest test`：4 个测试通过，0 失败。
- `ReadLints` 对 `SseStreamControllerTest.java` 无诊断。

### 当前阶段 13.10

状态：已完成。

目标：
- 评估依赖分层。
- 用文档明确默认依赖、optional 依赖和宿主 opt-in 能力。

修改：
- 新增 `docs/guide/dependency-footprint.md`
- 修改 `docs/.vitepress/config.ts`
- 修改 `docs/guide/index.md`
- 修改 `task_plan.md`
- 修改 `progress.md`

验证：
- `ReadLints` 对新增文档、VitePress 配置和计划文件无诊断。
- `node scripts/project-health-check.mjs --docs`：版本一致性检查通过，VitePress 文档站构建通过。

### 当前阶段 13.11

状态：已完成。

目标：
- 继续拆分 `useAssistantDiagnostics.ts`。
- 将连接配置输入和 localStorage 持久化状态迁移到独立 composable。

修改：
- 新增 `ai-assistant-ui/src/composables/useConnectionConfigState.ts`
- 新增 `ai-assistant-ui/src/composables/useConnectionConfigState.spec.ts`
- 修改 `ai-assistant-ui/src/composables/useAssistantDiagnostics.ts`
- 修改 `task_plan.md`
- 修改 `progress.md`

验证：
- RED：`npm test -- useConnectionConfigState.spec.ts` 首次失败，原因是缺少 `useConnectionConfigState` 模块。
- GREEN：`npm test -- useConnectionConfigState.spec.ts` 通过，6/6。
- `ReadLints` 对 `useConnectionConfigState.ts`、spec 和 `useAssistantDiagnostics.ts` 无诊断。
- `npm run build:types`：通过。

### 当前阶段 13.12

状态：已完成。

目标：
- 继续拆分 `useAssistantDiagnostics.ts`。
- 将 runtime provider 表单状态迁移到独立 composable。

修改：
- 新增 `ai-assistant-ui/src/composables/useRuntimeProviderConfigState.ts`
- 新增 `ai-assistant-ui/src/composables/useRuntimeProviderConfigState.spec.ts`
- 修改 `ai-assistant-ui/src/composables/useAssistantDiagnostics.ts`
- 修改 `task_plan.md`
- 修改 `progress.md`

验证：
- RED：`npm test -- useRuntimeProviderConfigState.spec.ts` 首次失败，原因是缺少 `useRuntimeProviderConfigState` 模块。
- GREEN：`npm test -- useRuntimeProviderConfigState.spec.ts` 通过，5/5。
- `ReadLints` 对 `useRuntimeProviderConfigState.ts`、spec 和 `useAssistantDiagnostics.ts` 无诊断。
- `npm run build:types`：通过。

### 当前阶段 13.13

状态：已完成。

目标：
- 强化 Java Client `/stream` 协议契约测试。

修改：
- `ai-assistant-client/src/test/java/com/aiassistant/client/AiAssistantClientTest.java`
- `task_plan.md`
- `progress.md`

验证：
- `mvn -pl ai-assistant-client -Dtest=AiAssistantClientTest test`：12 个测试通过，0 失败。

### 当前阶段 13.14

状态：已完成。

目标：
- 强化服务端兼容 `/stream` 协议契约测试。

修改：
- `ai-assistant-server/src/test/java/com/aiassistant/controller/AiAssistantControllerTest.java`
- `task_plan.md`
- `progress.md`

验证：
- `mvn -pl ai-assistant-server -Dtest=AiAssistantControllerTest test`：17 个测试通过，0 失败。

### 当前阶段 13.15

状态：已完成。

目标：
- 强化 runtime config 后端契约测试。

修改：
- 新增 `ai-assistant-server/src/test/java/com/aiassistant/controller/RuntimeModelConfigControllerTest.java`
- `task_plan.md`
- `progress.md`

验证：
- 第一次命令 `mvn -pl ai-assistant-server -Dtest=RuntimeConfigControllerTest,RuntimeModelConfigControllerTest test` 被 PowerShell 逗号解析拦截，未进入 Maven。
- 重跑 `mvn -pl ai-assistant-server "-Dtest=RuntimeConfigControllerTest,RuntimeModelConfigControllerTest" test`：5 个测试通过，0 失败。

### 当前阶段 13.16

状态：已完成。

目标：
- 按深度分析建议的第 1 项，处理工作区大量行尾噪音。
- 不做全仓 CRLF/LF 重写，只提供只读检测工具和使用说明。

修改：
- 新增 `scripts/line-ending-noise-check.mjs`
- 新增 `scripts/line-ending-noise-check.test.mjs`
- 修改 `scripts/project-health-check.mjs`
- 修改 `docs/guide/git-hooks.md`
- 修改 `task_plan.md`
- 修改 `findings.md`
- 修改 `progress.md`

验证：
- `node --test scripts/line-ending-noise-check.test.mjs`：5/5 通过。
- `node scripts/line-ending-noise-check.mjs`：识别 2 个真实内容 diff 和 88 个 line-ending-only diff。
- `node scripts/project-health-check.mjs --line-endings`：通过。
- `ReadLints` 对相关脚本和文档无诊断。

### 当前阶段 13.17

状态：已完成。

目标：
- 按深度分析建议的第 2 项，把 OpenAPI 前端类型同步检查纳入 CI。
- 先做轻量 guard，不启动后端服务、不运行 live codegen。

修改：
- 新增 `scripts/openapi-type-sync-guard.mjs`
- 新增 `scripts/openapi-type-sync-guard.test.mjs`
- 修改 `.github/workflows/ci.yml`
- 修改 `docs/guide/openapi-typescript-codegen.md`
- 修改 `task_plan.md`
- 修改 `findings.md`
- 修改 `progress.md`

验证：
- `node --test scripts/openapi-type-sync-guard.test.mjs`：4/4 通过。
- `node scripts/openapi-type-sync-guard.mjs --file ai-assistant-server/src/main/java/com/aiassistant/model/ChatRequest.java`：按预期失败，提示需要同步 `api-generated.d.ts`。
- `node scripts/openapi-type-sync-guard.mjs --file ai-assistant-server/src/main/java/com/aiassistant/model/ChatRequest.java --file ai-assistant-ui/src/types/api-generated.d.ts`：通过。
- `node --test scripts/*.test.mjs`：18/18 通过。
- `ReadLints` 对相关脚本、CI 和文档无诊断。

### 当前阶段 13.18

状态：已完成。

目标：
- 继续拆分诊断相关前端逻辑。
- 把诊断复制文本和剪贴板状态迁移到独立 composable。

修改：
- 新增 `ai-assistant-ui/src/composables/useDiagnosticsClipboard.ts`
- 新增 `ai-assistant-ui/src/composables/useDiagnosticsClipboard.spec.ts`
- 修改 `ai-assistant-ui/src/composables/useAssistantDiagnostics.ts`
- 修改 `ai-assistant-ui/src/components/AiAssistant.vue`
- 修改 `ai-assistant-ui/REFACTORING_PLAN.md`
- 修改 `task_plan.md`
- 修改 `findings.md`
- 修改 `progress.md`

验证：
- RED：`npm test -- useDiagnosticsClipboard.spec.ts` 首次失败，原因是缺少 `useDiagnosticsClipboard` 模块。
- GREEN：`npm test -- useDiagnosticsClipboard.spec.ts`：3 个测试通过。
- `npm test -- useDiagnosticsClipboard.spec.ts ConnectionDiagnostics.spec.ts`：2 个测试文件、5 个测试通过。
- `ReadLints` 对相关新文件和修改文件无诊断。

### 当前阶段 13.19

状态：已完成。

目标：
- 规划 Starter feature artifact 拆分路线。
- 本阶段只写文档，不移动依赖或模块。

修改：
- `docs/guide/dependency-footprint.md`
- `task_plan.md`
- `findings.md`
- `progress.md`

验证：
- `ReadLints` 对 `docs/guide/dependency-footprint.md` 和规划记录无诊断。

### 当前阶段 13.20

状态：已完成。

目标：
- 收窄 `@ai-assistant/vue` 主入口公共 API 面。
- 不删除现有导出，只补推荐导入路径和后续导出规则。

修改：
- `docs/guide/frontend-recipes.md`
- `ai-assistant-ui/src/index.ts`
- `task_plan.md`
- `findings.md`
- `progress.md`

验证：
- `npm test -- packageExports.spec.ts`：1/1 通过。
- `ReadLints` 对相关文档和 `index.ts` 无诊断。

### 当前阶段 13.21

状态：已完成。

目标：
- 推进 OpenAPI 契约闭环的低风险子步骤。
- 让生成类型脚本支持本地静态 OpenAPI JSON 输入。

修改：
- `scripts/generate-frontend-types.mjs`
- `scripts/generate-frontend-types.test.mjs`
- `docs/guide/openapi-typescript-codegen.md`
- `task_plan.md`
- `findings.md`
- `progress.md`

验证：
- RED：`node --test scripts/generate-frontend-types.test.mjs` 首次失败，原因是缺少 `loadSpecText` export。
- GREEN：`node --test scripts/generate-frontend-types.test.mjs`：3 个测试通过。
- `ReadLints` 对相关脚本和文档无诊断。

### 当前阶段 13.22

状态：已完成。

目标：
- 生成静态 OpenAPI 快照。
- 扩大前端 `api-generated.d.ts` 覆盖面。

修改：
- 新增 `docs/api/openapi.json`
- 新增 `ai-assistant-ui/.prettierignore`
- 修改 `ai-assistant-ui/src/types/api-generated.d.ts`
- 修改 `ai-assistant-ui/src/utils/api.ts`
- 修改 `.github/workflows/ci.yml`
- 修改 `docs/guide/openapi-typescript-codegen.md`

验证：
- `node scripts/generate-frontend-types.mjs --spec-file docs/api/openapi.json --check`：通过。
- `npm test -- api.spec.ts`：2 个测试文件、53 个测试通过。

### 当前阶段 13.23

状态：已完成。

目标：
- 拆分 `useAssistantDiagnostics.ts` 网络请求编排。

修改：
- 新增 `ai-assistant-ui/src/composables/useDiagnosticsModelRequests.ts`
- 新增 `ai-assistant-ui/src/composables/useDiagnosticsModelRequests.spec.ts`
- 修改 `ai-assistant-ui/src/composables/useAssistantDiagnostics.ts`
- 修改 `ai-assistant-ui/REFACTORING_PLAN.md`

验证：
- RED：`npm test -- useDiagnosticsModelRequests.spec.ts` 首次失败，原因是缺少模块。
- GREEN：`npm test -- useDiagnosticsModelRequests.spec.ts useDiagnosticsClipboard.spec.ts ConnectionDiagnostics.spec.ts api.spec.ts`：5 个测试文件、60 个测试通过。

### 当前阶段 13.24

状态：已完成。

目标：
- 建立 Starter 依赖足迹护栏。

修改：
- 新增 `scripts/dependency-footprint-check.mjs`
- 新增 `scripts/dependency-footprint-check.test.mjs`
- 修改 `scripts/project-health-check.mjs`
- 修改 `.github/workflows/ci.yml`

验证：
- `node --test scripts/dependency-footprint-check.test.mjs`：3/3 通过。
- `node scripts/dependency-footprint-check.mjs`：无问题。

### 当前阶段 13.25

状态：已完成。

目标：
- 补前端包体归因报告。

修改：
- 新增 `scripts/bundle-composition-report.mjs`
- 新增 `scripts/bundle-composition-report.test.mjs`
- 修改 `scripts/project-health-check.mjs`
- 修改 `docs/guide/dependency-footprint.md`

验证：
- `node --test scripts/bundle-composition-report.test.mjs`：2/2 通过。
- `node scripts/project-health-check.mjs --dependency-footprint --bundle-composition`：通过。
- `node scripts/project-health-check.mjs --release-check`：通过。
- `node --test scripts/*.test.mjs`：25/25 通过。
- `npm run build`（`ai-assistant-ui`）：通过，Package export check OK（27 paths）。
- `ReadLints` 对相关脚本、CI、文档和前端文件无诊断。

### 当前阶段 13.26

状态：已完成。

目标：
- 提供兼容性的前端瘦身入口。
- 不删除主入口历史导出。

修改：
- 新增 `ai-assistant-ui/src/entries/core.ts`
- 修改 `ai-assistant-ui/package.json`
- 修改 `ai-assistant-ui/vite.config.ts`
- 修改 `ai-assistant-ui/src/packageExports.spec.ts`
- 修改 `docs/guide/frontend-recipes.md`

验证：
- `npm test -- packageExports.spec.ts`：通过。
- `npm run build`：产出 `core.mjs` / `core.umd.cjs`，Package export check OK（27 paths）。

### 当前阶段 13.27

状态：已完成。

目标：
- 让 `@ai-assistant/vue/core` 真正绕开主入口高级导出面。

修改：
- 新增 `ai-assistant-ui/src/core-plugin.ts`
- 修改 `ai-assistant-ui/src/entries/core.ts`
- 修改 `task_plan.md`
- 修改 `findings.md`
- 修改 `progress.md`

验证：
- `npm test -- packageExports.spec.ts`：通过。
- `npm run build`：通过；`core.mjs` / `core.umd.cjs` 正常产出，Package export check OK（27 paths）。

### 当前阶段 13.28

状态：已完成。

目标：
- 迁移 Admin API 常用 DTO 到 generated schema。

修改：
- `docs/api/openapi.json`
- `ai-assistant-ui/src/types/api-generated.d.ts`
- `ai-assistant-ui/src/utils/adminApi.ts`
- `task_plan.md`
- `findings.md`
- `progress.md`

验证：
- `node scripts/generate-frontend-types.mjs --spec-file docs/api/openapi.json --check`：通过。
- `npm test -- adminApi.spec.ts api.spec.ts`：2 个测试文件、53 个测试通过。
- `ReadLints` 对相关 OpenAPI、generated types 和 Admin SDK 文件无诊断。

### 当前阶段 13.29

状态：已完成。

目标：
- 补 core-only starter 自动装配验证路径。

修改：
- `ai-assistant-server/src/test/java/com/aiassistant/autoconfigure/AiAssistantAutoConfigurationTest.java`
- `task_plan.md`
- `progress.md`

验证：
- `mvn -pl ai-assistant-server "-Dtest=AiAssistantAutoConfigurationTest" test`：10 个测试通过，0 失败。

### 当前阶段 13.30

状态：已完成。

目标：
- 为 v2 主入口高级导出迁移增加 deprecation 提示。

修改：
- `ai-assistant-ui/src/index.ts`
- `task_plan.md`
- `progress.md`

验证：
- `npm test -- packageExports.spec.ts`：通过。
- `ReadLints` 对 `src/index.ts` 无诊断。

### 当前阶段 13.31

状态：已完成。

目标：
- 新增 v2 migration guide。

修改：
- 新增 `docs/guide/v2-migration.md`
- 修改 `docs/.vitepress/config.ts`
- 修改 `task_plan.md`
- 修改 `progress.md`

验证：
- `npm run build`（`docs`）：通过。
- `ReadLints` 对新增文档和 VitePress 配置无诊断。

### 当前阶段 13.32

状态：已完成。

目标：
- 补齐 `adminApi.ts` 公开 Admin endpoints 的 OpenAPI path-level snapshot。
- 让 Admin SDK 的 request/response 类型从 generated paths 派生。

修改：
- 新增 `scripts/openapi-admin-paths.test.mjs`
- 修改 `docs/api/openapi.json`
- 修改 `ai-assistant-ui/src/types/api-generated.d.ts`
- 修改 `ai-assistant-ui/src/utils/adminApi.ts`
- 修改 `task_plan.md`
- 修改 `findings.md`
- 修改 `progress.md`

验证：
- `node --test scripts/openapi-admin-paths.test.mjs`：2 个测试通过。
- `node --test scripts/*.test.mjs`：27 个测试通过。
- `node scripts/generate-frontend-types.mjs --spec-file docs/api/openapi.json --check`：通过。
- `npm test -- adminApi.spec.ts api.spec.ts`：2 个测试文件、53 个测试通过。
- `npx vue-tsc --noEmit`：通过。

### 当前阶段 13.33

状态：已完成。

目标：
- 继续补齐非 Admin REST endpoints 的 OpenAPI path-level snapshot。
- 让静态快照覆盖主要公开能力面，减少后续新增 generated types 的阻力。

修改：
- 新增 `scripts/openapi-public-paths.test.mjs`
- 修改 `docs/api/openapi.json`
- 修改 `ai-assistant-ui/src/types/api-generated.d.ts`
- 修改 `task_plan.md`
- 修改 `findings.md`
- 修改 `progress.md`

验证：
- `node --test scripts/openapi-public-paths.test.mjs scripts/openapi-admin-paths.test.mjs`：4 个测试通过。
- `node --test scripts/*.test.mjs`：29 个测试通过。
- `node scripts/generate-frontend-types.mjs --spec-file docs/api/openapi.json --check`：通过。
- `npx vue-tsc --noEmit`：通过。

### 当前阶段 13.34

状态：已完成。

目标：
- 让 `ai-assistant-ui/src/utils/api.ts` 的关键 helper 类型从 generated paths 派生。
- 给 path-level 类型迁移增加脚本级类型契约测试。

修改：
- 新增 `scripts/frontend-api-path-types.test.mjs`
- 修改 `docs/api/openapi.json`
- 修改 `ai-assistant-ui/src/types/api-generated.d.ts`
- 修改 `ai-assistant-ui/src/utils/api.ts`
- 修改 `task_plan.md`
- 修改 `findings.md`
- 修改 `progress.md`

验证：
- `node --test scripts/frontend-api-path-types.test.mjs`：通过。
- `node --test scripts/*.test.mjs`：30 个测试通过。
- `npm test -- api.spec.ts`：2 个测试文件、53 个测试通过。
- `node scripts/generate-frontend-types.mjs --spec-file docs/api/openapi.json --check`：通过。
- `npx vue-tsc --noEmit`：通过。

### 当前阶段 13.35

状态：已完成。

目标：
- 扩展 OpenAPI type sync guard 的后端契约覆盖范围。
- 要求契约变更时同步提交静态 OpenAPI snapshot 与 generated frontend types。

修改：
- 修改 `scripts/openapi-type-sync-guard.mjs`
- 修改 `scripts/openapi-type-sync-guard.test.mjs`
- 修改 `task_plan.md`
- 修改 `findings.md`
- 修改 `progress.md`

验证：
- `node --test scripts/openapi-type-sync-guard.test.mjs`：5 个测试通过。
