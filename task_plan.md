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

## 错误记录

| 时间 | 问题 | 原因 | 处理 |
| --- | --- | --- | --- |
| 2026-04-29 | `cmd` 默认显示 README 中文为乱码 | Windows 控制台代码页不是 UTF-8 | 改用 `chcp 65001` 后继续读取 |
| 2026-04-29 | VitePress 构建提示 `env` 语言未加载 | 新增 Markdown 使用了未启用的代码块语言 | 将本次新增文档中的 `env` 代码块改为 `text` 后重新构建通过 |
| 2026-04-29 | `project-health-check.mjs` 首次运行 `npm.cmd` 报 `EINVAL` | Windows 下直接 `spawnSync` `.cmd` 兼容性不足 | 改为 Windows 下使用 `shell: true` |
| 2026-04-29 | 手工 `cmd.exe /c` 拼接命令时引号被错误传递 | Windows 命令行转义不够稳健 | 放弃手工拼接，统一让 Node 的 `shell: true` 处理 |
