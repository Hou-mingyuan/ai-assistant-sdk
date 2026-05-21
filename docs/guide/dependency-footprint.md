# 依赖足迹与可选能力

本页说明 Starter、独立服务和前端包的主要依赖边界，帮助接入方判断哪些能力是默认可用，哪些能力需要宿主或部署环境显式启用。

## 后端 Starter

`ai-assistant-spring-boot-starter` 面向宿主 Spring Boot 应用。它的依赖可以分为三类：

| 类别 | 依赖 / 能力 | 说明 |
| --- | --- | --- |
| 基础运行 | `spring-boot-autoconfigure`、Validation、Jackson、Caffeine、Micrometer core | Starter 自动装配、请求校验、JSON、轻量缓存和基础指标所需。 |
| Web 入口 | Spring Web、WebFlux、WebSocket、Actuator | 在 `pom.xml` 中标为 optional；宿主按实际入口引入，独立服务会显式带上这些能力。 |
| 导出与文件处理 | PDFBox、Apache POI | 当前 `/export` 和文件解析运行期依赖这些库，因此不是 optional。若宿主完全不开放导出/Office 解析，可在后续版本考虑拆成单独 feature artifact。 |
| 多副本与存储 | Redis、JDBC | optional；只有宿主提供 Redis/JDBC 依赖和连接配置时，Redis session、Redis rate limit、JDBC memory 等能力才会接管。 |
| 稳定性与可观测 | Resilience4j、Micrometer tracing、OpenTelemetry OTLP | optional；需要熔断/重试或链路追踪时由宿主引入并配置。 |
| 低频扩展 | Playwright、Springdoc OpenAPI、Logstash encoder | optional；分别用于 headless 抓取、OpenAPI UI、结构化日志。 |

### 接入建议

- 只需要基础聊天接口时，优先从最小 Starter 接入开始，不要主动打开 Admin、MCP、Headless、RAG、连接器管理等高风险能力。
- 多副本部署时，Redis/JDBC 不是“配置一个环境变量就生效”。必须有对应依赖、连接配置和自动装配条件，或者把限流/会话一致性前移到平台层。
- PDF/Office 导出能力目前随 Starter 一起提供，生产环境应关注 PDFBox/POI 的安全扫描结果和宿主版本冲突。

## 独立服务

`ai-assistant-service` 是 Docker 友好的独立服务。它显式引入 Web、WebFlux、WebSocket、Actuator、Jackson JSR310 和 JSON logging encoder，用于开箱即用的 HTTP/SSE/WebSocket、健康检查和结构化日志。

独立服务默认不引入 Redis、JDBC 或 Playwright。若部署需要全局限流、跨副本会话、对话记忆持久化或 Headless 抓取，应在镜像/运行环境中补齐依赖与配置，或优先使用网关、平台 Redis、外部向量库等基础设施。

## 前端组件包

`@ai-assistant/vue` 的默认运行依赖集中在 Vue 渲染、Markdown、高亮、HTML 清理和截图：

| 依赖 | 用途 |
| --- | --- |
| `dompurify` | 清理 Markdown 渲染后的 HTML。 |
| `marked` / `marked-highlight` / `highlight.js` | Markdown 与代码高亮。 |
| `html2canvas` | 截图能力。 |

Mermaid 不是默认 dependency。代码块 Mermaid 渲染通过动态 `import('mermaid')` 尝试加载；宿主不安装 Mermaid 时会降级展示源码，不会增加默认包体积。

可以用下面的只读报告查看当前 baseline 的包体构成：

```bash
node scripts/bundle-composition-report.mjs
```

报告按 gzip 体积分组主入口、Web Component、样式、worker、secondary entries 和 feature chunks。它不重新 build，只读取 `scripts/.bundle-size-baseline.json`，适合在拆分 secondary entry 前做归因。

## 何时继续拆分

如果接入方明确不需要导出、Office/PDF 解析、Headless 抓取、RAG 或连接器，后续可考虑把这些能力进一步拆成独立 artifact 或 feature package。但拆分前需要确认：

- 已有公开 API 和部署文档如何迁移。
- Starter 用户缺少 feature artifact 时是否能得到明确启动提示，而不是运行期 500。
- 独立服务镜像是否仍保留开箱即用体验。

## Feature artifact 拆分路线

拆包目标不是让默认接入变复杂，而是让“只要聊天能力”的宿主可以更容易控制依赖、安全扫描面和镜像体积。建议按风险从低到高推进，每一步都保持现有 Starter 兼容。

### 候选 artifact

| 候选包 | 承接能力 | 主要依赖 | 拆分难度 | 兼容策略 |
| --- | --- | --- | --- | --- |
| `ai-assistant-export-support` | `/export`、PDF / DOCX / XLSX 导出、导出图片嵌入 | PDFBox、Apache POI | 中 | Starter 先继续默认引入；新增条件 Bean 和缺依赖时的清晰错误。 |
| `ai-assistant-file-support` | 文件上传摘要 / 翻译、Office/PDF 文本抽取 | PDFBox、Apache POI | 中 | 与导出可先共包，等 API 边界稳定后再拆。 |
| `ai-assistant-headless-support` | Playwright Headless 抓取 | Playwright | 低 | 当前已 optional，优先只抽自动装配和文档。 |
| `ai-assistant-rag-support` | RAG ingest / retrieve、Embedding、VectorStore 默认实现 | 向量库适配、embedding client | 中高 | 保留 `VectorStore` SPI；默认 InMemory 仅限开发。 |
| `ai-assistant-connector-support` | JDBC / REST / Informat connector、connector tool registrar | JDBC、外部平台 SDK | 中高 | 保留 `DataConnector` SPI；管理端点继续默认关闭。 |
| `ai-assistant-observability-support` | OpenAPI UI、OTLP tracing、结构化日志扩展 | springdoc、OTLP、logstash encoder | 低 | 大部分已 optional，优先整理为文档和 starter 条件入口。 |

### 推荐迁移顺序

1. **先拆 Headless / Observability 文档边界**：这些能力已经接近 optional，先把自动装配条件、依赖入口和错误提示写清楚，回归风险最低。
2. **再拆 Export + File support**：PDFBox/POI 是当前最大默认依赖足迹，但 `/export` 和文件解析已有公开 API。拆分前必须补齐缺依赖时的启动提示或 4xx/501 响应，避免运行期 500。
3. **最后拆 RAG / Connector**：这两类能力涉及后台管理、工具注册、租户、安全和存储一致性，适合在 SPI 和生产配置检查进一步稳定后再拆。

### 兼容性原则

- `ai-assistant-spring-boot-starter` 在一个小版本内不突然移除现有能力；先提供 feature artifact 和迁移提示，再考虑把重型依赖从默认 starter 中移出。
- `ai-assistant-service` 独立镜像继续保持开箱即用；即使内部拆包，镜像仍应显式引入需要的 feature artifact。
- 每个拆出的 artifact 都需要一页文档说明：适用场景、依赖、启用配置、默认关闭项、安全注意事项和最小测试命令。
- CI 需要分别覆盖“只引入 core starter”和“引入完整 feature set”两条路径，避免 core 用户被重型依赖重新污染。
