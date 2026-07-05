# AI Assistant SDK · 深度代码审查报告

> 审查范围：后端 `ai-assistant-server`（161 个 Java 文件）+ 前端 `ai-assistant-ui`（262 个 Vue/TS 文件）。
> 方式：对核心链路做**深度抽样审查**（LLM 编排、限流、熔断、配额、SSRF、HTTP 抓取、前端 API 层与主组件），非逐行全量。
> 结论先行：**这是一个生产级、高质量的代码库**，工程纪律好（零 `printStackTrace`/`TODO`/调试残留、大量提取可测类、完善的 a11y）。下面的优化项多为"锦上添花"，按维度 + 优先级列出。

> **📌 本轮已修复（后端，编译 + 14 项单测全绿）**
> - ✅ **S1 无界 Map 内存 DoS** — `InMemoryTokenUsageTracker` 增加 `MAX_TENANTS=100k` 上限 + LRU 淘汰；`RateLimitFilter` 限流表满时改为 LRU 淘汰而非对新客户端 429。（更正：`X-Tenant-Id` 原本**已由** `TenantFilter.SAFE_TENANT_ID`=`[a-zA-Z0-9_.:-]{1,64}` 做格式/长度校验，真正缺的是「条目数量上限」，已补。）
> - ✅ **P1 限流「假滑动窗口」** — `RateEntry` 由固定窗口（每 60s 归零 count）改为**真滑动窗口**（时间戳日志，仅保留 60s 内的请求），消除窗口边界 2× 突刺。
> - ⏳ **U1 `AiAssistant.vue` 2640 行拆分** — 属大重构（对外组件，须保行为/API/a11y 不变），建议分步执行，方案见下。

---

## 一、总体评价

**做得好的地方（值得保持）**
- 熔断器 `CircuitBreaker` 用 CAS 实现「半开单探针」，防止后端刚恢复被并发惊群打挂。
- 配额 `InMemoryTokenUsageTracker.tryReserveQuota` 用 CAS 预留，防并发穿透。
- SSRF 防护 `DefaultSsrfPolicy` 覆盖极全（IPv4/IPv6、内嵌 v4、云元数据 `100.100.100.200`、CGN `100.64/10`、link-local、ULA、文档网段…），并有 OkHttp `SsrfPinningHttpFetcher` 关闭 DNS 重绑定窗口。
- 限流 `RateLimitFilter` 默认忽略可伪造的 `X-Forwarded-For`（需显式配置可信代理跳数），安全默认值正确。
- 前端 `api.ts`：SSE 健壮解析（`\r\n`、trailing、cancel）、模型请求 in-flight 去重 + TTL 缓存、统一 `AbortSignal.timeout`。
- 前端 a11y 到位：`role="dialog"`、`aria-modal`、`aria-live` 屏读播报、`trapFocus` 焦点陷阱。

---

## 二、后端 · 功能与架构

| # | 问题 | 位置 | 影响 | 建议 | 优先级 |
|---|------|------|------|------|--------|
| F1 | `LlmService` 构造函数与 `chat/chatStream` **重载爆炸**（telescoping，十余个重载 + 两个多参构造） | `service/LlmService.java` | 认知负担高、易错、维护难 | 已有 `Builder`，进一步用**参数对象** `ChatOptions`（userMessage/history/systemPrompt/model/images/sessionId/pageContext）收敛重载 | 中 |
| F2 | 多处 `new ObjectMapper()` 各自新建 | `LlmService`(L55)、`RateLimitFilter`(L30) 等 | ObjectMapper 构造较重；实例分散不利统一配置 | 注入共享的单例 `ObjectMapper` Bean | 中 |
| F3 | 配额预留用 `properties.getMaxTokens()` 作为每请求估算 | `LlmService.checkQuotaAndReserve` | 过度预留 → 配额可能**提前误拒** | 用已有的 `LlmRequestBuilder.estimateTokens(...)` 做更贴近的预留 | 低 |
| F4 | 拦截器/记忆异常统一 `catch(Exception)` 后仅 debug 日志 | `LlmService.recordToMemory`、`runAfter/BeforeInterceptors` | 失败被静默吞掉，排障困难 | 关键路径失败上报指标（MeterRegistry counter）而非仅日志 | 低 |

---

## 三、后端 · 性能与并发

| # | 问题 | 位置 | 影响 | 建议 | 优先级 |
|---|------|------|------|------|--------|
| P1 | 注释称「sliding-window」，实为**固定窗口**（每 60s 归零 `count`） | `config/RateLimitFilter.java` `RateEntry.tryAcquireWithInfo` | 窗口切换瞬间可放行 **2× 突发**；文档措辞误导 | 要精确就换**滑动日志/令牌桶**；否则至少修正注释 | 中 |
| P2 | `putCachedText` 用 `synchronized` 全局串行化写；淘汰是「清过期 + 删迭代器第一个」，**非 LRU** | `service/HttpContentFetcher.java` L268 | 高并发抓取锁竞争；缓存命中率不稳 | 换 **Caffeine**（LRU + TTL + maxSize，无锁并发） | 中 |
| P3 | 进程内缓存各自造轮子（`LlmResponseCache`、`fetchCache`、前端 `modelsCache`…） | 多处 | 淘汰策略不一致、重复代码 | 后端统一 Caffeine；抽一层 cache 抽象 | 中 |
| P4 | 流式记忆 `StringBuilder fullResponse` 累积整段回复 | `LlmService.chatStreamWithImages` L538 | 超长回复占内存（功能必需，但无上限） | 对超长回复截断记忆（配合已有 `chat-history-max-chars`） | 低 |

---

## 四、后端 · 安全（本项目强项，仅剩少数硬化点）

| # | 问题 | 位置 | 攻击场景 | 建议 | 严重度 |
|---|------|------|----------|------|--------|
| S1 | **无界 Map 内存 DoS**：租户维度不设上限 | `stats/InMemoryTokenUsageTracker.usageByTenant/reservedTokens`；`config/RateLimitFilter.counters`(满则对新客户端 429) | `X-Tenant-Id` 由请求头驱动，攻击者刷**大量随机 tenantId** → 撑大内存 / 占满限流表把正常新用户挤成 429 | 校验 `X-Tenant-Id`（白名单/格式/长度），对 tenant 维度加 **LRU + 上限**；限流表满时按 LRU 淘汰而非拒绝新客户端 | 高 |
| S2 | DNS 重绑定（TOCTOU）残留窗口 | `service/HttpContentFetcher.fetchBytes` JDK 路径 | 未装 OkHttp 时，`https` 无法 pin IP，`validate()` 与实际连接之间可被重绑定到内网 | 生产**默认依赖/强制** OkHttp pinning 路径；文档醒目提示；或对 https 也做 resolved-IP 校验 + 连接层复核 | 中 |
| S3 | 重定向逐跳已校验，但**响应体大小**仅 JDK 路径 `readNBytes(max)` 限制 | `HttpContentFetcher` | 若自定义抓取器忘记限流可 OOM | 在门面层统一强制 max-bytes + 超时，纳入测试 | 低 |
| S4 | 错误信息回显 host/IP | `DefaultSsrfPolicy` 异常消息含 `address not allowed: <ip>` | 可被用作**内网探测**的信息侧信道（区分「不允许」与「解析失败」） | 对外错误统一为模糊文案，详情仅进服务端日志 | 低 |

> 说明：S1/S2 是否已在 `TenantFilter`/最新 SSRF 提交中缓解，建议结合当前工作区未提交改动一并核实（`git status` 显示 SSRF 相关文件正在演进）。

---

## 五、前端 · UI/性能/工程

| # | 问题 | 位置 | 影响 | 建议 | 优先级 |
|---|------|------|------|------|--------|
| U1 | **巨型容器组件 2640+ 行** | `components/AiAssistant.vue` | 认知负担重、diff 冲突多、单测难；`<script setup>` 聚合了海量状态与 composable 编排 | 把状态编排继续**下沉到 composable**（如 `useChatSession`/`usePanelLayout`/`useArtifactPanel`），主组件只做装配与模板 | 高 |
| U2 | SSE 消费 `buffer` 无上限 | `utils/api.ts` `streamChat` L583 | 服务端异常不发 `\n\n` 分隔时 buffer 可无限增长 | 加 buffer 上限，超限报错中断 | 中 |
| U3 | 大量 `useXxx` composable（数十个）与 `.spec` | `composables/` | 拆分是优点，但需防重复/循环依赖 | 建一张 composable 依赖/职责图，合并重叠项 | 低 |
| U4 | 主题/样式按区域切片 `styles/01..08-*.css` | `components/styles/` | 组织清晰，但跨切片改动需同步 | 维持约定即可；补一份样式区块地图 | 低 |

**前端正面**：Markdown 高亮按需懒加载、长列表有 `useMessageVirtualScroll`、`content-visibility` 优化、i18n 4 语言且有 `i18n.spec` —— 性能与工程基础扎实。

---

## 六、综合优化清单（按 ROI / 优先级）

**高优先级（建议先做）**
1. **S1 无界 Map 内存 DoS**：校验 `X-Tenant-Id` + tenant 维度 LRU/上限；限流表满时 LRU 淘汰而非拒绝新用户。
2. **U1 主组件瘦身**：`AiAssistant.vue` 状态编排下沉 composable，2640 行 → 目标 < 800 行。
3. **P1 限流窗口**：修正「sliding-window」措辞或改令牌桶，消除边界 2× 突刺。

**中优先级**
4. P2/P3 抓取缓存 + 各进程内缓存统一换 **Caffeine**（LRU+TTL，无锁）。
5. S2 DNS 重绑定：生产默认启用 OkHttp pinning，文档强提示。
6. F2 共享单例 `ObjectMapper`。
7. U2 SSE buffer 上限保护。

**低优先级（打磨）**
8. F1 用 `ChatOptions` 参数对象收敛 `chat/chatStream` 重载。
9. F3 配额预留改用 `estimateTokens`。
10. S4 SSRF 对外错误文案模糊化。

---

## 七、审查范围声明

本次为**核心链路深度抽样**，已精读：`LlmService`、`RateLimitFilter`、`CircuitBreaker`、`InMemoryTokenUsageTracker`、`DefaultSsrfPolicy`、`HttpContentFetcher`、`utils/api.ts`、`AiAssistant.vue`（结构）。
未逐一展开：RAG/Agent/MCP/Connector 具体实现、Admin 控制器、导出（PDF/DOCX/XLSX）、Helm/CI、全部前端子组件与 composable。如需，可对上述模块做第二轮专项审查。
