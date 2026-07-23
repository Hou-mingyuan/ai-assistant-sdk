# 架构总览（C4 model）

本文档采用 [C4 model](https://c4model.com/) 的三层视角描述 AI Assistant SDK 的架构：

1. **Level 1 · System Context**：本系统与外部用户、外部服务的关系
2. **Level 2 · Container**：仓库内的进程级运行单元（Java 后端 / Vue 前端 / Docker / K8s / 文档站）
3. **Level 3 · Component**：核心运行单元内的关键组件分布

> 本文档由 T4 任务自动生成，与根目录 `README.md` 的"架构与扩展点"段保持同步。修改时请同步更新两边。

---

## Level 1 · System Context

```mermaid
flowchart LR
    user[("终端用户<br/>浏览器 / WebView / Cursor")]
    admin[("管理员<br/>Admin Dashboard")]
    host[("宿主业务后端<br/>Spring Boot 应用")]

    subgraph aiassistant ["AI Assistant SDK"]
        direction TB
        ai["AI 助手系统<br/>(Starter 集成 或 独立 Docker 服务)"]
    end

    llm[("LLM Provider<br/>OpenAI / DeepSeek / Tongyi /<br/>Doubao / Kimi / Gemini / ...<br/>16 家内置 + OpenAI 兼容")]
    vector[("Vector Store<br/>InMemory（仓库内）<br/>外部实现通过 SPI 注入")]
    redis[("Redis<br/>分布式限流 / Session / Memory<br/>(可选)")]
    jdbc[("JDBC 数据源<br/>业务数据接入工具<br/>(可选)")]
    webhook[("Webhook 接收端<br/>异步任务回调<br/>(可选)")]
    mcpclient[("MCP 客户端<br/>Cursor / Claude Desktop / ...<br/>(可选)")]

    user -- "Vue 插件 / Web Component<br/>SSE / WS / REST" --> ai
    admin -- "/ai-assistant/admin/* REST<br/>X-AI-Token" --> ai
    host -- "嵌入 ai-assistant-spring-boot-starter<br/>(@ConditionalOnMissingBean 接管点)" --> ai

    ai -- "OpenAI 兼容 HTTP<br/>SSE 流" --> llm
    ai -- "embed / query" --> vector
    ai -- "rateLimit / session / memory" --> redis
    ai -- "list_modules / get_schema / query_data" --> jdbc
    ai -- "POST /events<br/>HMAC 签名" --> webhook
    ai -- "JSON-RPC over HTTP" --> mcpclient

    classDef external fill:#e0e7ff,stroke:#4338ca,color:#1e1b4b
    classDef system fill:#10b981,stroke:#047857,color:#fff
    class user,admin,host,llm,vector,redis,jdbc,webhook,mcpclient external
    class ai system
```

### 关键边界

| 边界 | 协议 | 安全控制 |
|---|---|---|
| 用户 ↔ AI Assistant | HTTPS REST / SSE / WS | `AccessToken`(X-AI-Token)、CORS allowlist、IP/Token 限流 |
| 管理员 ↔ Admin REST | HTTPS REST | `AdminToken`（可独立 token，fallback access-token） |
| 宿主业务后端 ↔ Starter | 内 JVM 调用 + `ChatCompletionClient` SPI | `@ConditionalOnMissingBean` 接管点；宿主可注入任意 Bean |
| 系统 ↔ LLM | OpenAI 兼容 HTTPS | `apiKey` 多 key 轮询、`ProviderConnectivityChecker` 启动探测 |
| 系统 ↔ 外部 URL（抓取） | HTTPS GET | `UrlFetchService` + `SsrfPolicy`（私网 / loopback / 元数据黑名单）+ Bytes/Time 上限 |
| 系统 ↔ JDBC | JDBC | `allowedTables` 白名单、SQL 注入检测、`schema` 限定 |

---

## Level 2 · Container

```mermaid
flowchart TB
    subgraph repo ["ai-assistant-sdk 仓库（monorepo）"]
        direction TB

        subgraph javamods ["Java 模块（Maven 多模块）"]
            direction LR
            server["ai-assistant-server<br/>Spring Boot Starter<br/>(136 .java · 16.8K 行)<br/>artifact: ai-assistant-spring-boot-starter"]
            service["ai-assistant-service<br/>独立 Spring Boot 应用<br/>(layers jar · Docker)"]
            client["ai-assistant-client<br/>Java REST 客户端 SDK"]
            server -.被引用.-> service
        end

        subgraph npmpkgs ["npm 包（独立非 Maven）"]
            direction LR
            ui["ai-assistant-ui<br/>@ai-assistant/vue<br/>(26 .vue + 131 .ts + 16 .css ≈ 46K 行)<br/>npm + UMD + ESM + types + WC"]
            playground["ai-assistant-vue-playground<br/>(内部联调，不发布)"]
            ui -.file:.-> playground
        end

        subgraph deploy ["部署工件"]
            docker["Dockerfile<br/>+ 3 份 docker-compose<br/>(本地 / GHCR / prod)"]
            helm["helm/ai-assistant<br/>Kubernetes Chart<br/>(Deployment + Service + HPA + Ingress)"]
            nginx["deploy/<br/>nginx / Caddy 反代样例"]
        end

        subgraph docs ["文档与测试"]
            docsite["docs/<br/>VitePress<br/>(141 .md)"]
            e2e["e2e/<br/>Playwright<br/>(11 .ts)"]
            scripts["scripts/<br/>15 .mjs<br/>(release / coverage / bundle / smoke)"]
        end

        service -.image build.-> docker
        docker -.deploy.-> helm
    end

    host[("宿主业务应用<br/>Spring Boot 3.x")]
    standalone[("Docker / K8s 集群")]
    cdn[("npm registry / GitHub Packages")]

    host -. "pom: ai-assistant-spring-boot-starter:1.0.1" .-> server
    standalone -. "docker pull" .-> docker
    cdn -. "npm install @ai-assistant/vue" .-> ui

    classDef java fill:#fef3c7,stroke:#d97706,color:#78350f
    classDef npm fill:#dcfce7,stroke:#15803d,color:#14532d
    classDef ops fill:#dbeafe,stroke:#1d4ed8,color:#1e3a8a
    classDef ext fill:#f3e8ff,stroke:#7e22ce,color:#581c87

    class server,service,client java
    class ui,playground npm
    class docker,helm,nginx,docsite,e2e,scripts ops
    class host,standalone,cdn ext
```

### Container 维度对比表

| Container | 形态 | 入口 / 工件 | 何时使用 |
|---|---|---|---|
| `ai-assistant-server` | Maven JAR | `com.aiassistant:ai-assistant-spring-boot-starter:1.0.1` | 嵌入现有 Spring Boot 业务后端 |
| `ai-assistant-service` | 可执行 JAR + Docker | `ai-assistant-service-1.0.1.jar` / Docker 镜像 | 独立部署，不修改业务后端 |
| `ai-assistant-client` | Maven JAR | `com.aiassistant:ai-assistant-client:1.0.1` | 任意 Java 应用通过 REST 调用 SDK |
| `ai-assistant-ui` | npm 包 | `@ai-assistant/vue@1.0.1`（umd/esm/types/wc） | 任意 Vue 3 项目；或非 Vue 项目用 `<ai-assistant>` Web Component |
| `helm/ai-assistant` | Helm Chart | `helm install` | Kubernetes 集群部署 |

---

## Level 3 · Component（Spring Boot Starter 内部）

```mermaid
flowchart TB
    subgraph external ["前端 / 浏览器"]
        ui_vue["@ai-assistant/vue<br/>Vue 3 / Web Component"]
    end

    subgraph filters ["Filter 链（按 setOrder 顺序）"]
        direction TB
        f_tracing["TracingFilter<br/>(-4)"]
        f_apiver["ApiVersionFilter<br/>(-5)"]
        f_sse["SseCompressionFilter<br/>(-3)"]
        f_tenant["TenantFilter<br/>(-2)"]
        f_req["RequestIdFilter<br/>(-1)"]
        f_rate["RateLimit / RedisRateLimit<br/>(0)"]
        f_auth["AiAssistantAuthFilter<br/>(1)"]
        f_admin["AdminAuthFilter<br/>(2 · /ai-assistant/admin/*)"]
    end

    subgraph controllers ["Controllers"]
        c_ai["AiAssistantController<br/>/chat /stream /models"]
        c_stream["SseStreamController<br/>/sse (typed SSE)"]
        c_ws["AiAssistantWebSocketHandler<br/>WebSocket (可选)"]
        c_file["FileUploadController<br/>/file/summarize /file/translate"]
        c_export["AssistantExportController<br/>/export (xlsx/docx/pdf)"]
        c_admin["AdminDashboardController<br/>/ai-assistant/admin/*"]
        c_async["AsyncTaskController<br/>/async/chat → 202 + 轮询"]
        c_capability["CapabilityController<br/>/capabilities"]
        c_session["SessionController<br/>/session/*"]
        c_url["AiAssistantController<br/>/url-preview"]
    end

    subgraph services ["核心 Service"]
        s_llm["LlmService<br/>(745 行业务编排)"]
        s_url["UrlFetchService<br/>(741 行·缓存·截断·SSRF)"]
        s_export["AssistantExportService<br/>(517 行·PDF/DOCX/XLSX)"]
        s_file["FileParserService<br/>(PDF / DOCX / XLSX / CSV)"]
        s_session["SessionStore<br/>(InMemory / Redis)"]
    end

    subgraph llmgw ["LLM 网关层"]
        gw_client["ChatCompletionClient<br/>(SPI · @ConditionalOnMissingBean)"]
        gw_openai["OpenAiCompatibleChatClient<br/>(默认实现 · 16 家 provider)"]
        gw_block["BlockingLlmCallExecutor"]
        gw_stream["StreamingLlmCallExecutor"]
        gw_tool["ToolCallingLoop<br/>+ StreamingToolCallingLoop"]
        gw_compose["PromptComposer"]
        gw_enrich["RequestEnricher"]
        gw_post["ResponsePostProcessor"]
    end

    subgraph capabilities ["能力扩展"]
        cap_tool["ToolRegistry<br/>+ ToolDefinition"]
        cap_agent["AgentExecutor<br/>(执行调用方给定步骤)"]
        cap_router["ModelRouter<br/>(任务 / 成本 / A/B)"]
        cap_rag["RagService<br/>+ VectorStore + EmbeddingProvider"]
        cap_memory["ConversationMemoryProvider<br/>(Redis > JDBC > InMemory)"]
        cap_prompt["PromptTemplateRegistry<br/>({{var}} {{#if}})"]
        cap_mcp["McpServerController<br/>JSON-RPC (可选)"]
        cap_connector["DataConnector<br/>+ JDBC + Informat + REST"]
    end

    subgraph crosscutting ["横切关注点"]
        cc_content["ContentFilter<br/>(PII 5 类 + 注入 26 规则)"]
        cc_ssrf["SsrfPolicy<br/>(DNS + 私网黑名单)"]
        cc_rbac["RbacProvider<br/>(默认 AllowAll)"]
        cc_audit["AuditEventStore<br/>+ AuditLogger"]
        cc_quota["TokenUsageTracker<br/>(按租户日期 + 配额)"]
        cc_health["HealthIndicator<br/>+ Metrics + ConnectivityChecker"]
        cc_event["AiAssistantEventPublisher"]
        cc_circuit["ResilientLlmClient<br/>(Resilience4j retry + CB)"]
    end

    ui_vue ==> f_tracing
    f_tracing --> f_apiver --> f_sse --> f_tenant --> f_req --> f_rate --> f_auth --> f_admin
    f_admin ==> c_ai
    f_admin ==> c_stream
    f_admin ==> c_ws
    f_admin ==> c_file
    f_admin ==> c_export
    f_admin ==> c_admin
    f_admin ==> c_async
    f_admin ==> c_capability
    f_admin ==> c_session
    f_admin ==> c_url

    c_ai --> s_llm
    c_stream --> s_llm
    c_ws --> s_llm
    c_file --> s_file --> s_llm
    c_url --> s_url
    c_export --> s_export
    c_async --> s_llm

    s_llm --> gw_compose
    gw_compose --> gw_enrich
    gw_enrich --> cc_content
    gw_enrich --> s_url
    gw_enrich --> cap_rag
    gw_enrich --> cap_memory
    gw_enrich --> cap_prompt
    cc_content --> gw_block
    cc_content --> gw_stream
    gw_block --> gw_client
    gw_stream --> gw_client
    gw_client -. tool calls .-> gw_tool
    gw_tool --> cap_tool
    cap_tool --> cap_connector
    cap_tool --> cap_agent
    s_llm --> gw_post
    gw_post --> cc_quota
    s_llm --> cap_router
    s_llm --> cc_audit
    s_llm -. publish .-> cc_event

    gw_client -. 默认实现 .-> gw_openai
    gw_client -. 限流/熔断 .-> cc_circuit

    s_url -. 安全策略 .-> cc_ssrf

    classDef ctl fill:#fef3c7,stroke:#d97706,color:#78350f
    classDef svc fill:#dcfce7,stroke:#15803d,color:#14532d
    classDef gw fill:#fee2e2,stroke:#dc2626,color:#7f1d1d
    classDef cap fill:#dbeafe,stroke:#1d4ed8,color:#1e3a8a
    classDef cc fill:#f3e8ff,stroke:#7e22ce,color:#581c87
    classDef flt fill:#fff7ed,stroke:#ea580c,color:#7c2d12
    classDef ui fill:#10b981,stroke:#047857,color:#fff

    class c_ai,c_stream,c_ws,c_file,c_export,c_admin,c_async,c_capability,c_session,c_url ctl
    class s_llm,s_url,s_export,s_file,s_session svc
    class gw_client,gw_openai,gw_block,gw_stream,gw_tool,gw_compose,gw_enrich,gw_post gw
    class cap_tool,cap_agent,cap_router,cap_rag,cap_memory,cap_prompt,cap_mcp,cap_connector cap
    class cc_content,cc_ssrf,cc_rbac,cc_audit,cc_quota,cc_health,cc_event,cc_circuit cc
    class f_tracing,f_apiver,f_sse,f_tenant,f_req,f_rate,f_auth,f_admin flt
    class ui_vue ui
```

### Spring Boot 自动装配拓扑

T2 重构后，自动装配按职能拆为 7 个 sibling Configuration，由主入口 `@Import` 聚合：

```mermaid
flowchart LR
    main["AiAssistantAutoConfiguration<br/>(主入口 57 行)<br/>@ConditionalOnClass(WebClient)<br/>@Conditional(ApiKeyConfigured)"]

    main -- @Import --> llm["LlmAutoConfiguration<br/>(141 行)<br/>ChatCompletionClient · LlmService<br/>ToolRegistry · ModelRouter · Agent<br/>Resilience4j"]
    main -- @Import --> web["WebAutoConfiguration<br/>(265 行)<br/>所有 Controller · CORS · ExceptionHandler<br/>Capabilities · Plugin · MCP · WebSocket"]
    main -- @Import --> sec["SecurityAutoConfiguration<br/>(177 行)<br/>所有 Filter (8 个)<br/>ContentFilter · Rbac · Audit"]
    main -- @Import --> rag["RagAutoConfiguration<br/>(32 行)<br/>VectorStore · EmbeddingProvider<br/>RagService"]
    main -- @Import --> stor["StorageAutoConfiguration<br/>(72 行)<br/>SessionStore (Redis/内存)<br/>ConversationMemory · Webhook"]
    main -- @Import --> obs["ObservabilityAutoConfiguration<br/>(109 行)<br/>Banner · Advisor · Connectivity<br/>Health · Metrics · EventPublisher"]
    main -- @Import --> conn["ConnectorAutoConfiguration<br/>(84 行)<br/>DataConnector · JDBC · URL fetch<br/>Headless · HealthScheduler"]

    spi["spring.factories /<br/>AutoConfiguration.imports"] -. only references main .-> main

    classDef main fill:#10b981,stroke:#047857,color:#fff,font-weight:bold
    classDef sib fill:#fef3c7,stroke:#d97706,color:#78350f
    classDef spifile fill:#dbeafe,stroke:#1d4ed8,color:#1e3a8a

    class main main
    class llm,web,sec,rag,stor,obs,conn sib
    class spi spifile
```

> 这种 `@Import` 聚合的好处：宿主应用方使用方式不变（spring.factories 仍只列主类），但每个 Configuration 文件 < 280 行，新增/修改 Bean 时仅需改对应 sibling 文件。

---

## Component 维度统计

| 层 | 组件数 | 总行数 | 关键文件 |
|---|---:|---:|---|
| **Controller** | 14 | 1,919 | `AiAssistantController` `SseStreamController` `AdminDashboardController` `BatchController` `AsyncTaskController` |
| **Service** | 22 | 4,773 | `LlmService` (745) `UrlFetchService` (741) `AssistantExportService` (517) `FileParserService` |
| **Config** | 23 | 2,140（T2 后 ~2,000） | `AiAssistantProperties` (513) `AiAssistantAutoConfiguration` (57) + 7 sibling Configuration `ProviderDefaults` |
| **Connector** | 9 | 1,738 | `DataConnector` `JdbcConnector` `ConnectorHealthScheduler` `ConnectorFactory` |
| **Security** | 7 | 659 | `ContentFilter` `DefaultSsrfPolicy` `RbacProvider` `AuditLogger` `LoggingAuditEventStore` |
| **LLM Gateway** | (在 service/llm 下) | ~700 | `ChatCompletionClient` SPI · `OpenAiCompatibleChatClient` · 4 个 Executor/Loop |
| **RAG** | 5 | 318 | `RagService` `VectorStore` `InMemoryVectorStore` `OpenAiEmbeddingProvider` `EmbeddingProvider` |
| **Tool / Agent / Routing** | 1+1+1 | 341 | `ToolRegistry` `AgentExecutor` `ModelRouter` |
| **Memory** | 4 | ~110 | `ConversationMemoryProvider` `InMemoryConversationMemoryProvider` `RedisConversationMemoryProvider` `JdbcConversationMemoryProvider` |
| **Prompt** | 2 | 171 | `PromptTemplateRegistry` `PromptTemplate` |
| **Stats** | 2 | 193 | `UsageStats` `TokenUsageTracker` |
| **Observability** | 2 | 80 | `AiAssistantHealthIndicator` `AiAssistantMetrics` |

---

## 与文档站其它页面的关系

- [`backend-architecture.md`](backend-architecture.md)：本文档的"模块边界与扩展点维护建议"详细版
- [`configuration.md`](configuration.md)：组件对应的配置项分层说明
- [`chat.md`](chat.md) / [`function-calling.md`](function-calling.md)：核心交互流程
- [`plugins.md`](plugins.md)：`DataConnector` 扩展点
- [`mcp-server.md`](mcp-server.md)：MCP Server 组件
