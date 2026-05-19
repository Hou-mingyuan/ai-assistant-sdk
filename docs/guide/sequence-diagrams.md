# 调用链路序列图

本页用 Mermaid 序列图描述 AI Assistant SDK 4 条最核心的调用链路：

1. [同步对话 `/chat`](#1-同步对话-chat)
2. [流式输出 `/stream`（SSE）](#2-流式输出-streamsse)
3. [RAG 检索增强](#3-rag-检索增强)
4. [ReAct Agent 多步工具调用](#4-react-agent-多步工具调用)

每条链路都标注了 **请求耗时占比** 与 **可观测点**（Metrics / Audit / Event），便于排障与性能优化。

> 本文档由 T6 任务产出，与 [`architecture.md`](architecture.md) 的 Component 图配合阅读。

---

## 1. 同步对话 `/chat`

最常用入口：单轮 LLM 调用，返回完整响应字符串。

```mermaid
sequenceDiagram
    autonumber
    actor User as 浏览器<br/>(Vue 插件)
    participant Filter as Filter 链<br/>(Tracing→Tenant→Auth→<br/>RateLimit→RequestId→Sse→<br/>ApiVer→Admin)
    participant Ctrl as AiAssistantController
    participant Limits as ChatInputLimits
    participant Llm as LlmService<br/>(745 行业务编排)
    participant Memory as ConversationMemory<br/>(Redis > JDBC > 内存)
    participant Quota as TokenUsageTracker
    participant Router as ModelRouter
    participant Compose as PromptComposer
    participant Enrich as RequestEnricher
    participant Content as ContentFilter<br/>(PII + 注入检测)
    participant UrlFetch as UrlFetchService
    participant Block as BlockingLlmCallExecutor
    participant Client as ChatCompletionClient<br/>(OpenAiCompatible)
    participant LLM as LLM API
    participant Post as ResponsePostProcessor
    participant Audit as AuditEventStore
    participant Stats as UsageStats

    User->>+Filter: POST /ai-assistant/chat<br/>{action,text,history,model,...}
    Note over Filter: ① 追踪 trace_id<br/>② 解析 X-Tenant-Id<br/>③ 校验 X-AI-Token<br/>④ 限流（每分钟 60 次/IP）<br/>⑤ 注入 X-Request-Id 响应头
    Filter->>+Ctrl: 转发请求

    Ctrl->>Limits: validateTotalChars(req)
    alt 超过 chat.max-total-chars (默认 300k)
        Limits-->>Ctrl: too-large
        Ctrl-->>User: 400 INPUT_TOO_LARGE
    end

    alt action == "translate"
        Ctrl->>Llm: translate(text, targetLang, model)
    else action == "summarize"
        Ctrl->>Llm: summarize(text, model)
    else action == "chat" (默认)
        Ctrl->>+Llm: chat(text, history, sysPrompt,<br/>model, images, sessionId, pageCtx)

        Llm->>Memory: getHistory(sessionId, tenant)
        Memory-->>Llm: 短期滑动窗口 + 长期事实

        Llm->>Quota: checkQuota(tenant, today)
        alt 配额超限
            Quota-->>Llm: QuotaExceededException
            Llm-->>Ctrl: 抛异常
            Ctrl-->>User: 429 QUOTA_EXCEEDED
        end

        Llm->>Router: route(taskType, tenant, estTokens)
        Router-->>Llm: RoutingDecision{modelId, reason, abGroup}

        Llm->>Compose: composeMessages(...)<br/>system + history + user
        Compose-->>Llm: List<Message>

        Llm->>Enrich: enrich(messages, ...)
        Note over Enrich: ① 注入 page context blocks<br/>② 注入 cross-memory 事实<br/>③ 注入 RAG 检索结果（如启用）<br/>④ 注入 prompt template 渲染结果
        opt 用户输入含 http(s) URL
            Enrich->>UrlFetch: fetchOrCached(url)
            UrlFetch->>UrlFetch: ssrf check + dns 黑名单
            UrlFetch->>UrlFetch: HTTP GET (限 512KB / 15s)
            UrlFetch-->>Enrich: 摘要文本（max 24k 字符）
        end
        Enrich-->>Llm: enriched messages

        Llm->>Content: maskPii(messages) + detectInjection(text)
        Note over Content: PII：5 类（手机/身份证/银行卡/邮箱/IP）<br/>注入：26 条规则（仅 log warn，不阻断）
        Content-->>Llm: messages（已脱敏）

        Llm->>+Block: complete(requestBody, apiKey)
        Block->>+Client: complete(json, apiKey)
        Client->>+LLM: POST /chat/completions<br/>Authorization: Bearer ***
        LLM-->>-Client: 200 {choices:[{message:...}]}
        Client-->>-Block: assistantText
        Block-->>-Llm: assistantText

        Llm->>Post: process(assistantText)
        Note over Post: ① 抽取 <think> 块<br/>② 去除危险标签<br/>③ trim trailing whitespace
        Post-->>Llm: 清理后文本

        Llm->>Quota: recordUsage(tenant, promptTokens, completionTokens)
        Llm->>Memory: appendMessage(sessionId, user+assistant)
        Llm->>Audit: append(AuditEvent{trace, tenant, action, tokens})

        Llm-->>-Ctrl: 业务响应字符串
    end

    Ctrl->>Stats: recordCall(action)
    Ctrl-->>-Filter: ChatResponse.ok(result, meta)
    Filter-->>-User: 200 {success:true, data, runtime:{...}}
```

**可观测点**：
- **Trace**：步骤 ① 起 `trace_id` 贯穿全链路（Micrometer Tracing + OTLP）
- **Metrics**：`ai_assistant.chat.count`、`ai_assistant.chat.latency`、`ai_assistant.tokens.used{tenant}`（步骤 ⑮、⑯）
- **Audit**：步骤 ⑯ 写 AuditEvent（trace、tenant、action、token 用量、模型）
- **Event Bus**：成功完成时 `AiAssistantEventPublisher.publish(ChatCompletedEvent)`

**典型耗时**（单次 LLM 调用 ~3s 量级）：
- Filter 链：< 5ms
- Compose + Enrich + URL fetch（如有）：5-100ms
- ContentFilter：< 2ms
- LLM call：**1.5-5s（≥ 95% 占比）**
- Post + Quota + Memory + Audit：< 10ms

---

## 2. 流式输出 `/stream`（SSE）

打字机效果：LLM 边生成边推到浏览器。

```mermaid
sequenceDiagram
    autonumber
    actor User as 浏览器<br/>(EventSource)
    participant SseFilter as SseCompressionFilter
    participant Filter as Filter 链<br/>(其它)
    participant Ctrl as SseStreamController
    participant Llm as LlmService
    participant Stream as StreamingLlmCallExecutor
    participant Loop as StreamingToolCallingLoop
    participant Client as ChatCompletionClient
    participant LLM as LLM API
    participant Compress as Gzip stream

    User->>+SseFilter: POST /ai-assistant/stream<br/>Accept: text/event-stream
    SseFilter->>Filter: passthrough
    Filter->>+Ctrl: 转发请求
    Ctrl->>+Llm: streamChat(...)

    Llm->>Llm: 同 /chat 的 enrich + filter（步骤略）

    Llm->>+Stream: completeStream(requestBody, apiKey)
    Stream->>+Client: completeStream(json, apiKey)
    Client->>+LLM: POST /chat/completions<br/>{...,"stream":true}

    loop 每收到一个 data: {...} chunk
        LLM-->>Client: data: {choices:[{delta:{content:"片段"}}]}
        Client-->>Stream: emit content delta
        Stream-->>Llm: Flux<String> delta

        opt 检测到 tool_calls 块
            Llm->>Loop: handleToolCalls(call)
            Loop->>Loop: invoke ToolDefinition
            Loop-->>Llm: tool result
            Llm->>+Client: completeStream(updatedRequest)
            Note over Client,LLM: 重新发起新的 LLM 请求<br/>带 tool result 拼接的 messages
        end

        Llm-->>Ctrl: SSE event
        Ctrl->>Compress: 写入 gzip 包装的 EventStreamWriter
        Compress-->>User: data: {"content":"片段"}\n\n
        Note over User: useSendStream.ts 收到 chunk:<br/>① 解析 SSE event<br/>② 累积 assistant.content<br/>③ markdown 流式无高亮渲染<br/>④ 更新 streamingNowMs（1Hz tick）
    end

    LLM-->>-Client: data: [DONE]
    Client-->>-Stream: Flux 完成
    Stream-->>-Llm: completed

    Llm->>Llm: 收尾：写 audit + memory + quota
    Llm-->>-Ctrl: completion meta
    Ctrl-->>-Filter: end SSE
    SseFilter-->>-User: SSE 流关闭
```

**关键设计**：
- **Gzip 压缩**：`SseCompressionFilter` 把 `text/event-stream` 包装成 `Content-Encoding: gzip`，单条对话节省 50%+ 带宽
- **Tool calling loop**：流式过程中若 LLM 返回 `tool_calls`，自动执行工具并再次发起 LLM 请求；与同步 `/chat` 共用 `ToolCallingLoop` 抽象
- **心跳**：默认每 30s 发 `: keepalive\n\n` 注释帧，防止反代/Cloudflare 超时关闭
- **取消**：浏览器关闭 EventSource 时，`useSendStream.ts` 在 useEffect 清理中调用 `abortController.abort()`；服务端 `Flux.takeUntilOther` 感知 cancel 并停止上游 LLM 请求

**前端处理**（`composables/useSendStream.ts`）：
- TTFT 测量：从 `streamStartedAt` 到首 chunk 的间隔显示在 progress chip
- 长会话：超过 `maxMessagesInMemory`（默认 200）从头部丢弃整句
- 流式最后一帧用无高亮渲染（避免 highlight.js 同步阻塞）

---

## 3. RAG 检索增强

启用条件：`ai-assistant.rag-enabled=true` + 显式调用 `RagService.ingest()` 录入文档。

```mermaid
sequenceDiagram
    autonumber
    participant Admin as Admin API<br/>/admin/rag/ingest
    participant Rag as RagService
    participant Embed as EmbeddingProvider<br/>(OpenAiEmbeddingProvider)
    participant Vector as VectorStore<br/>(InMemory / Milvus / ...)

    rect rgb(245, 245, 235)
    Note over Admin,Vector: 阶段 A：文档录入（一次性，离线）
    Admin->>+Rag: ingest(tenantId, docId, text)
    Rag->>Rag: chunk(text, maxChars=1500, overlap=200)
    loop 每个 chunk
        Rag->>Embed: embed(chunk)
        Embed->>Embed: POST LLM /embeddings<br/>model=text-embedding-3-small
        Embed-->>Rag: float[1536]
        Rag->>Vector: upsert(VectorEntry{tenant,docId,chunk,vector})
    end
    Rag-->>-Admin: {ingested: N chunks}
    end

    actor User as 浏览器
    participant Ctrl as AiAssistantController
    participant Llm as LlmService
    participant Enrich as RequestEnricher
    participant Client as ChatCompletionClient
    participant LLM as LLM API

    rect rgb(235, 245, 255)
    Note over User,LLM: 阶段 B：对话检索（每次 /chat 触发）
    User->>+Ctrl: POST /chat {text:"问题"}
    Ctrl->>+Llm: chat(...)
    Llm->>Enrich: enrich(...)
    Enrich->>+Rag: retrieve(tenant, query, topK=5)
    Rag->>Embed: embed(query)
    Embed-->>Rag: float[1536]
    Rag->>Vector: searchSimilar(queryVector, tenant, topK)
    Note over Vector: InMemory: cosine similarity 全表扫<br/>Milvus/Pinecone: ANN 索引（HNSW/IVF）
    Vector-->>Rag: List<VectorEntry> + scores
    Rag-->>-Enrich: relevantChunks

    Enrich->>Enrich: 拼接到 messages：<br/>"参考资料：\n{chunk1}\n{chunk2}\n..."
    Enrich-->>Llm: enriched messages

    Llm->>+Client: complete(...)
    Client->>+LLM: POST /chat/completions
    LLM-->>-Client: 基于 RAG 上下文的回答
    Client-->>-Llm: text
    Llm-->>-Ctrl: result
    Ctrl-->>-User: {data: "依据《xxx》第3节..."}
    end
```

**生产升级路线**：
- **InMemoryVectorStore**：开发 / 小数据集（< 10k chunks）
- **Milvus**：开源 distributed vector DB，自建首选
- **Pinecone**：托管，多租户 SaaS
- **Qdrant**：Rust 实现，性能优秀，filter + vector hybrid 查询

替换方式：实现 `VectorStore` SPI 并注册为 Bean，`@ConditionalOnMissingBean` 让位默认 InMemory。

**Token 成本控制**：
- 每次检索 topK 默认 5，每 chunk 平均 ~500 字符 → 注入约 2500 字符 / 请求
- 通过 `ai-assistant.rag.max-context-chars` 限制（默认与 `chat.history-max-chars` 共享 48k 上限）

---

## 4. ReAct Agent 多步工具调用

`AgentExecutor.execute(plan)` 执行多步规划：LLM 思考 → 调用工具 → 观察结果 → 再思考 → ...

```mermaid
sequenceDiagram
    autonumber
    actor Caller as 调用方<br/>(Admin / 业务代码)
    participant Agent as AgentExecutor<br/>(ReAct 多步)
    participant Tool as ToolRegistry
    participant Llm as LlmService
    participant DataConn as DataConnector<br/>(JDBC/Informat/REST)
    participant Webhook as WebhookDelivery<br/>(可选)

    Caller->>+Agent: execute(plan: AgentPlan)
    Note over Agent: plan = {goal, maxSteps=10, availableTools}

    loop maxSteps 次（命中 STOP 提前结束）
        Agent->>+Llm: think(currentState)
        Note over Llm: system prompt = ReAct 模板<br/>tools = ToolRegistry.list().toJsonSchema()
        Llm->>Llm: chat with tool_calls 模式
        Llm-->>-Agent: AgentStep{thought, action, actionInput}

        alt action == "STOP"
            Agent->>Agent: 记录最终答案
            Note over Agent: 推出循环
        else action == 工具名
            Agent->>+Tool: invoke(toolName, args)
            alt tool == "query_data"（DataConnector）
                Tool->>+DataConn: query(sql / endpoint, params)
                DataConn->>DataConn: 校验 allowedTables / SQL 注入
                DataConn->>DataConn: 执行查询（HikariCP / OkHttp）
                DataConn-->>-Tool: 结果集
            else tool == "list_modules"
                Tool->>DataConn: listModules()
                DataConn-->>Tool: 数据源 schema 信息
            else 其它自定义工具
                Tool->>Tool: invoke ToolDefinition.executor
            end
            Tool-->>-Agent: ToolResult{output, error}

            Agent->>Agent: appendExecutionTrace(step, result)

            opt 当步耗时 > 30s 或 result.bytes > 100k
                Agent->>Agent: truncate observation
            end
        end
    end

    opt plan.webhookUrl != null
        Agent->>+Webhook: deliver(plan.webhookUrl, finalResult, signature)
        Webhook->>Webhook: HMAC-SHA256(secret, body)
        Webhook->>Webhook: POST with retries (1s/3s/9s)
        Webhook-->>-Agent: ack
    end

    Agent-->>-Caller: AgentExecutionResult<br/>{finalAnswer, trace, totalTokens, stepCount}
```

**ReAct 提示词模板**（简化）：
```
You can use the following tools to answer the question:
{tools_json_schema}

Use this format:
Thought: I need to ...
Action: tool_name
Action Input: {...}
Observation: tool result
... (repeat)
Thought: I now have the answer
Action: STOP
Final Answer: ...
```

**安全控制**：
- **maxSteps 默认 10**，防止 LLM 循环 / 无限工具调用
- **每步 observation 截断**：单次工具返回 > 100k 字符自动 trim，避免上下文爆炸
- **工具白名单**：`AgentPlan.availableTools` 显式列出本次允许的工具子集；不在白名单的工具调用直接拒绝
- **Audit**：每次 `invoke(tool, args)` 写 AuditEvent，便于事后回放调用链
- **Webhook 签名**：HMAC-SHA256，接收端必须验证防伪造

**典型场景**：
- "查询本月运单数 + 同比" → `list_modules` → `get_schema` → `query_data`（SQL）→ STOP
- "找出 3 个最高 fuel 消耗的航次，并生成翻译" → `query_data` → translate capability → STOP
- "周报生成"：从 Informat 拉数据 → summarize → 渲染 PromptTemplate → export PDF

---

## 5. 错误与降级路径速查

```mermaid
flowchart TB
    req[请求进入]
    req --> auth{X-AI-Token<br/>校验?}
    auth -- 失败 --> err401[401 Unauthorized]
    auth -- 通过 --> rate{限流<br/>通过?}
    rate -- 失败 --> err429[429 Too Many Requests]
    rate -- 通过 --> validate{输入<br/>合规?}
    validate -- 字符超限 --> err400a[400 INPUT_TOO_LARGE]
    validate -- 通过 --> quota{Token 配额<br/>剩余?}
    quota -- 失败 --> err429q[429 QUOTA_EXCEEDED]
    quota -- 通过 --> call[LLM 调用]
    call --> result{结果?}
    result -- 成功 --> ok[200 ChatResponse.ok]
    result -- LLM 5xx --> retry{重试?<br/>llmMaxRetries}
    retry -- 仍失败 --> fallback{ModelRouter<br/>fallback 存在?}
    fallback -- 是 --> call2[切到 fallback model]
    call2 --> call
    fallback -- 否 --> circuit{Resilience4j<br/>CB 打开?}
    circuit -- 是 --> err503[503 SERVICE_UNAVAILABLE]
    circuit -- 否 --> err500[500 LLM_CALL_FAILED]

    classDef err fill:#fee2e2,stroke:#dc2626,color:#7f1d1d
    classDef ok fill:#dcfce7,stroke:#15803d,color:#14532d
    classDef proc fill:#dbeafe,stroke:#1d4ed8,color:#1e3a8a

    class err401,err429,err400a,err429q,err500,err503 err
    class ok ok
    class req,auth,rate,validate,quota,call,result,retry,fallback,circuit,call2 proc
```

**前端错误处理**（`AiAssistantOptions.onAssistantError`）：

| 服务端错误 | 前端展示 | 用户操作 |
|---|---|---|
| 401 | "请重新登录" + 切到登录页 | 重新登录 |
| 429 | "请求过于频繁，请 1 分钟后再试" | 等待 |
| 400 INPUT_TOO_LARGE | "输入过长，建议分段发送" | 拆分输入 |
| 500 LLM_CALL_FAILED | "AI 服务暂不可用" + Retry 按钮 | 重试 |
| 503 SERVICE_UNAVAILABLE | "AI 服务繁忙" + 提示稍后 | 等待 |
| Network error | 切到 fallback baseUrl（若配置）| 自动恢复 |
