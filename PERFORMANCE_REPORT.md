# AI Assistant SDK · 性能压测报告（Health Smoke）

> **范围**：仅探测 **health / liveness** 端点，**不调用** `/chat`、`/stream` 等 LLM 接口，避免密钥消耗。

## 目标端点

| 端点 | 说明 |
| --- | --- |
| `GET {BASE}/health` | 应用健康（默认 `BASE=http://host:8080/ai-assistant`） |
| `GET {ORIGIN}/actuator/health/liveness` | Spring Actuator 存活探针 |

Hub Profile 默认：`BASE=http://localhost:18080/ai-assistant`

## 预期指标（Smoke）

| 指标 | p95 目标 | 说明 |
| --- | --- | --- |
| `/ai-assistant/health` | **< 400 ms** | 本地 / Hub 单实例 |
| `/actuator/health/liveness` | **< 400 ms** | 同上 |
| HTTP 失败率 | **< 1%** | k6 `http_req_failed` |
| 并发 | 5 VU × 30s | 默认可重复 smoke |

> `/chat`、`/stream` 依赖上游 LLM，延迟与配额相关，**不在本 smoke 门槛内**。容量规划见 [PERFORMANCE.md](./PERFORMANCE.md)。

## 运行方式

### 1. 启动服务

```bash
# 独立 Docker
docker compose up -d --build

# 或 Hub Profile（端口 18080）
cd ai-portfolio/docker
docker compose -f docker-compose.profiles.yml --profile ai-assistant-sdk up -d --build
```

### 2. Node smoke（无 k6）

```bash
node scripts/smoke-standalone-service.mjs http://localhost:8080/ai-assistant
# Hub:
node scripts/smoke-standalone-service.mjs http://localhost:18080/ai-assistant
```

### 3. k6 smoke

```bash
k6 run performance/k6-smoke.js
# Hub:
k6 run performance/k6-smoke.js -e BASE_URL=http://localhost:18080/ai-assistant
```

## 文件

| 文件 | 用途 |
| --- | --- |
| `performance/k6-smoke.js` | k6 health + liveness 压测 |
| `scripts/smoke-standalone-service.mjs` | Node 多功能 smoke（含 stats/runtime） |
| `PERFORMANCE.md` | 容量与生产调优说明 |

## 结果记录

| 日期 | 环境 | BASE | health p95 | liveness p95 | 失败率 | 备注 |
| --- | --- | --- | --- | --- | --- | --- |
| 2026-07-06 | Hub Profile | :18080 | **30.8 ms** | **25.2 ms** | **0%** | k6 docker · 5 VU × 30s · verify-all 可达 |
| 2026-07-06 | Hub Profile (Round-5) | :18080 | **176.8 ms** | **198.3 ms** | **0%** | project-hub-2 复跑 · 399 iter · 0 失败 · 阈值全过 |
| 2026-07-06 | Hub Profile (Round-5) | :18080 | **50.6 ms** | **45.9 ms** | **0%** | project-hub-1 复跑 · 532 iter · 阈值全过 · verify-all 可达 |
| 2026-07-06 | local docker | :8080 | _pending-local_ | _pending-local_ | — | `k6 run performance/k6-smoke.js`（栈未在本轮启动） |

### Hub :18080 复测命令（已通过）

```powershell
docker run --rm `
  -e BASE_URL=http://host.docker.internal:18080/ai-assistant `
  -v D:/project-hub/ai-assistant-sdk/performance:/scripts `
  grafana/k6:latest run /scripts/k6-smoke.js
```

### Local :8080 复测命令（pending-local）

> **pending-local** 含义：命令与阈值已文档化，Hub `:18080` 已有 Round-5 实测；本地 `:8080` 需在 `docker compose up` 且端口未被占用时自行复跑，将 p95 回填上表。协作 CI / 多项目并行时若 8080 冲突，可跳过实跑、仅保留本块。

**前置**：`curl -sf http://localhost:8080/ai-assistant/health` 返回 200。

```bash
k6 run performance/k6-smoke.js
# 等价：k6 run performance/k6-smoke.js -e BASE_URL=http://localhost:8080/ai-assistant
```

```powershell
docker compose up -d --build
docker run --rm `
  -e BASE_URL=http://host.docker.internal:8080/ai-assistant `
  -v D:/project-hub/ai-assistant-sdk/performance:/scripts `
  grafana/k6:latest run /scripts/k6-smoke.js
```

回填格式：将上表 `:8080` 行的 `_pending-local_` 替换为实测 p95（ms）与失败率。

## 限制

- 未覆盖 SSE 长连接、RAG 检索、多副本 Redis 会话。
- 生产压测前请配合网关限流与 LLM 配额监控。
