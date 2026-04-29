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
