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
