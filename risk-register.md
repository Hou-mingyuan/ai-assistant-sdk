# 风险登记册（Risk Register）

> 来源：对 `ai-assistant-sdk` 的一轮深度分析（2026-06）。
> 本文件是风险的**唯一跟踪清单**；历史优化轨迹见 `task_plan.md` / `progress.md`（已封档），
> 实时进度以 `git log` + `CHANGELOG.md` 为准。

## 状态总览

实质整改已落入提交 `379efae`（`chore: risk remediation R1/R3/R5/R8/R9 (+R2/R7 docs)`）。

| ID | 风险 | 严重度 | 状态 | 处置 |
| --- | --- | --- | --- | --- |
| R1 | `AiAssistant.vue` 3100 行巨石组件 | 🔴 高 | 已缓解 | ESLint `max-lines` 棘轮 3800→3200，冻结增长；后续随拆分继续下调 |
| R2 | 过度工程 / 计划文件自身成负担 | 🔴 高 | 已缓解 | `task_plan.md`、`progress.md` 加“历史归档”头，改以 git/CHANGELOG 为准 |
| R3 | `useSendStream.ts` 930 行 | 🟡 中 | 进行中 | 已抽出纯函数层 `sendStreamHelpers.ts`（-145 行，全量 re-export，零行为变化）；剩余流状态机/UI 副作用待续拆 |
| R4 | 行尾 CRLF 噪音 | 🟡 中 | 已核实=no-op | `.gitattributes` 已 `eol=lf`；`git add --renormalize .` 暂存 0 文件 → HEAD 本就 LF，工作区 CRLF 仅本机显示，入库自动归一，无需提交 |
| R5 | SSRF DNS 重绑定（TOCTOU） | 🟡 中 | 已缓解 | 新增默认关闭的 `ai-assistant.url-fetch.pin-resolved-ip`：http 连接钉死“已校验的 IP 字面量”（校验==连接同一 IP），关闭 http 重绑定（覆盖 169.254 云元数据）；https 因 SNI/证书不钉 IP，逐跳重校验保持；JVM 不允许 Host 头时安全降级 |
| R6 | 进程内限流/会话多副本不一致 | 🟢 低 | 本就实现 | `MultiReplicaStorageAdvisor` 已对内存态 vector/session/token/memory 发结构化告警 |
| R7 | 计划/文档与代码漂移 | 🟡 中 | 已缓解 | 同 R2，已在归档头标明以 git/CHANGELOG 为准 |
| R8 | `LlmService` 层叠构造函数 | 🟢 低 | 已缓解 | 新增 `LlmService.Builder`（保留原构造，向后兼容），两个 auto-config 装配点改用 builder；未来加依赖不再需新构造 |
| R9 | 模型输出仅前端 DOMPurify 兜底 XSS | 🟢 低 | 已缓解+文档 | 核实前端 DOMPurify 配置严格（默认拦 script/on*/javascript:）；`docs/guide/security-csp.md` 新增“渲染模型输出的安全边界”，明确直连 REST API 的宿主必须自行净化 |
| R10 | 前端主包体积 | 🟢 低 | 本就优化 | 实测主包仅 224KB gzip（旧 464KB 数据已过时），重特性 642KB 全懒加载，mermaid 已 optional peer；不做高风险主包手术 |

## 验证基线（commit 379efae 前）

- 后端：`mvn -pl ai-assistant-server test` → 759 tests, 0 fail, BUILD SUCCESS。
- 前端：`npm run build` → vue-tsc + vite + Package export check OK (27 paths)。
- 前端：`vitest run` → 82 文件 / 685 tests 全绿。
- 新增针对性单测：`HttpContentFetcherTest`（R5，6 个）；R3 由既有 `useSendStream.spec.ts`（36 个）经 re-export 守护。

## 后续可选项（未做，按需推进）

- R3 续拆：把 `useSendStream` 剩余的 SSE 流状态机与 UI 副作用再分层。
- R1 续降：随主组件继续瘦身，把 lint 上限从 3200 继续下调。
- R4 本机清理（可选）：如不想看到本机 CRLF 误报，可重新检出或调 `core.autocrlf`，不影响仓库。
- R5 彻底版：如需对 https 也防重绑定，需替换为带 DNS 钩子的 HTTP 客户端（大改动，单独评估）。
