# AI Assistant SDK 全面优化计划

## 当前状态概览

`ai-assistant-sdk` 是一个面向 Java + Vue 项目的可嵌入 AI 小助手 SDK。当前仓库由后端 Starter、Java 客户端、独立服务、Vue 组件库、Playground、文档站、端到端测试和部署配置组成。

## 模块职责

| 模块 | 职责 |
| --- | --- |
| `ai-assistant-server` | Spring Boot Starter，提供聊天、流式输出、文件处理、导出、RAG、Function Calling、多租户、安全和运维能力。 |
| `ai-assistant-client` | Java 客户端 SDK，用于宿主系统调用小助手服务。 |
| `ai-assistant-service` | 独立 Spring Boot 服务，可通过 Docker 或直接运行方式部署。 |
| `ai-assistant-ui` | Vue 3 组件库和 Web Component 构建产物。 |
| `ai-assistant-vue-playground` | 前端本地体验和调试环境。 |
| `docs` | VitePress 文档站。 |
| `e2e` | Playwright 端到端测试。 |
| `scripts` | 版本一致性检查、同步版本、独立服务冒烟测试等辅助脚本。 |

## 启动、测试和构建方式

| 范围 | 命令 | 说明 |
| --- | --- | --- |
| 版本一致性 | `node scripts/check-version-consistency.mjs` | 检查 Maven 与 npm 版本是否一致。 |
| 后端测试 | `cd ai-assistant-server && mvn test` | 运行 Starter 单元测试。 |
| Java 客户端测试 | `cd ai-assistant-client && mvn test` | 运行客户端单元测试。 |
| 前端测试 | `cd ai-assistant-ui && npm test` | 运行 Vitest。 |
| 前端类型和构建 | `cd ai-assistant-ui && npm run build` | 构建 Vue 组件库并生成类型声明。 |
| 文档站构建 | `cd docs && npm run build` | 构建 VitePress 文档。 |
| E2E 测试 | `cd e2e && npm test` | 运行 Playwright 测试。 |

## 优化事项清单

| 编号 | 状态 | 优先级 | 风险 | 事项 | 影响 | 建议方案 | 验证方式 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| O-001 | 已完成 | 高 | 低 | 补齐文档站缺失页面 | 侧边栏链接 404，影响新用户理解和导航 | 为已配置的 guide/api 页面补齐 Markdown 文档 | `cd docs && npm run build` 已通过 |
| O-002 | 部分完成 | 高 | 低 | README 内容过长，入口信息不够聚焦 | 新用户难以快速判断安装、启动和排障路径 | 已在 README 顶部补充阅读入口，并在文档站介绍页和快速开始页明确 Starter 集成、独立服务、前端连接和上线检查路径；已新增 `docs/api/reference.md` 并把 README 中的大段 API 细节替换为 API 文档入口；后续可继续迁移配置、部署和高级能力长段落 | `node scripts/project-health-check.mjs --docs` 已通过 |
| O-003 | 部分完成 | 高 | 中 | 多模块验证命令分散 | 日常维护时容易漏跑关键检查 | 已新增统一轻量健康检查脚本，可串联版本检查、文档构建和目标模块测试 | `node scripts/project-health-check.mjs --docs` 已通过 |
| O-004 | 已完成 | 中 | 低 | 配置项较多，缺少分层说明 | 用户容易误配生产安全项 | 已在配置文档中按最小可用、必填与模型连接、安全、性能与资源限制、可选能力、导出与文件处理、独立服务环境变量、前端配置和生产基线拆分说明 | `node scripts/project-health-check.mjs --docs` 已通过 |
| O-005 | 已完成 | 中 | 中 | 独立服务和 Starter 两种部署形态说明交叉 | 用户可能混淆 SDK 集成和独立服务部署 | 已新增 `docs/guide/deployment-checklists.md`，分别给出 Starter 集成和独立服务部署检查清单，并接入 README、快速开始、介绍页、独立服务页和 VitePress 侧边栏 | `node scripts/project-health-check.mjs --docs` 已通过 |
| O-006 | 已完成 | 中 | 中 | 前端组件能力复杂，事件和配置入口需要更系统示例 | 宿主项目集成成本上升 | 已新增 `docs/guide/frontend-recipes.md`，覆盖基础接入、自动挂载、同源/独立服务、主题语言、快捷 Prompt、Prompt 模板、事件、错误监控、代码块 IDE、会话限制、模型选择和 Web Component | `node scripts/project-health-check.mjs --docs` 已通过 |
| O-007 | 已完成 | 中 | 中 | 安全能力多但上线前检查入口分散 | 生产默认配置风险不易被发现 | 已扩充生产上线清单，补充鉴权、CORS、SSRF、Headless 抓取、Admin、连接器管理、MCP、RAG、分 action 限流、日志脱敏、运行时配置摘要和 Actuator 暴露边界 | `node scripts/project-health-check.mjs --docs` 已通过 |
| O-008 | 已完成 | 中 | 中 | 后端关键能力多，后续维护需要模块边界说明 | 新功能容易堆叠到错误层级 | 已新增 `docs/guide/backend-architecture.md`，说明后端总体分层、包职责、新功能放置建议、Controller/Service/配置/扩展点规则和维护检查清单 | `node scripts/project-health-check.mjs --docs` 已通过 |

## 推荐实施顺序

1. 先完成 O-001，修复已暴露的文档站 404。
2. 再处理 O-002 和 O-004，把 README 中的核心使用路径和配置说明拆到文档站。
3. 然后处理 O-003，建立统一轻量验证入口。
4. 最后处理 O-006 到 O-008，逐步补齐更细的前端、后端和上线治理文档。

## 本轮执行范围

上一轮已实施 O-001。当前继续推进 O-002 的低风险部分，并完成 O-004、O-005、O-006、O-007 和 O-008：先不大段删除 README 中的历史内容，而是在 README 顶部建立清晰入口，并增强 VitePress 介绍页和快速开始页的阅读路径；随后按配置风险和使用场景重写配置说明；再新增部署路径检查清单，分离 Starter 集成和独立服务部署两条路径；接着补充前端集成配方；然后扩充生产上线清单；最后补充后端架构维护说明。

已新增页面：

- `docs/guide/configuration.md`
- `docs/guide/chat.md`
- `docs/guide/function-calling.md`
- `docs/guide/mcp-server.md`
- `docs/guide/plugins.md`
- `docs/guide/kubernetes.md`
- `docs/api/chat.md`
- `docs/api/capabilities.md`
- `docs/api/admin.md`
- `scripts/project-health-check.mjs`

## 当前验证记录

- `node scripts/check-version-consistency.mjs`：已通过。
- `cd docs && npm run build`：已通过。
- `node scripts/project-health-check.mjs --docs`：已通过。
- 本轮已运行 `node scripts/project-health-check.mjs --docs`：已通过，包含版本一致性检查和文档站构建。
- 配置文档分层后再次运行 `node scripts/project-health-check.mjs --docs`：已通过。
- 新增部署路径检查清单后再次运行 `node scripts/project-health-check.mjs --docs`：已通过。
- 新增前端集成配方后再次运行 `node scripts/project-health-check.mjs --docs`：已通过。
- 扩充生产上线清单后再次运行 `node scripts/project-health-check.mjs --docs`：已通过。
- 新增后端架构维护说明后再次运行 `node scripts/project-health-check.mjs --docs`：已通过。
- 迁移 README API 长段落并新增 REST API 参考后再次运行 `node scripts/project-health-check.mjs --docs`：已通过。

## 剩余风险

- 当前工作区存在用户已有改动，本轮不会修改这些文件，最终需要用户自行决定是否合并这些既有改动。
- 本轮不做完整后端、前端和 E2E 全量验证，只针对文档优化运行了最小验证。
- 仓库中仍有本轮开始前已经存在的未提交改动，需要后续单独确认。
- `scripts/project-health-check.mjs` 的 `--ui-test`、`--server-test` 和 `--all` 已提供入口，但本轮没有运行全量前后端测试。
- README 仍保留部分历史细节，当前已先完成入口聚焦和 API 长段落迁移；后续迁移配置、部署和高级能力段落时需要逐段确认文档站已有等价内容后再精简。
