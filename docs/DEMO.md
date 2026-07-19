# AI Assistant SDK — 作品集演示指南

> 目标：在 **不依赖宿主业务项目** 的前提下，用独立 Docker 服务 + Vue Playground 完成作品集验收。  
> 部署细节见 [DEPLOYMENT.md](../DEPLOYMENT.md)；接入手册见 [USAGE.md](./USAGE.md)。

---

## 两种演示路径

| 路径 | 需要 LLM Key | 验收内容 |
| --- | --- | --- |
| **零密钥 smoke（推荐 CI / 作品集基线）** | 否 | health、stats、runtime、`/chat` 路由（503 表示未配置 Key，链路仍通） |
| **完整 UI 演示** | 是 | Playground 悬浮球 → SSE 流式对话 |

与 [ai-service-agent](https://github.com/Hou-mingyuan/ai-service-agent) 的内置 Mock 不同，本 SDK 的 **真实 LLM 对话** 需配置 `AI_ASSISTANT_API_KEY`；零密钥路径覆盖 **服务可用性 + 聊天 API 接线**，不调用上游计费。

---

## 一键 Demo（双容器 · Playground + 后端）

Docker Desktop 中显示为 **`ai-assistant-demo`** 分组（`docker-compose.demo.yml`）。

### Windows

```powershell
cd d:\project-hub\ai-assistant-sdk
.\scripts\demo-standalone.ps1
```

### Linux / macOS

```bash
cd ai-assistant-sdk
chmod +x scripts/demo-standalone.sh
./scripts/demo-standalone.sh
```

脚本会：

1. 若无 `.env` 则从 `.env.example` 复制（**Key 可留空**，仅跑 smoke）
2. 若缺少 `ai-assistant-vue-playground/dist/`，自动 `npm install && npm run build`
3. `docker compose -f docker-compose.demo.yml up -d --build`
4. 执行 `node scripts/smoke-demo-compose.mjs`

默认访问：

| 端点 | URL |
| --- | --- |
| Playground | http://localhost:3000/ |
| 健康检查（经 nginx 反代） | http://localhost:3000/ai-assistant/health |

端口可通过 `.env` 中 `AI_ASSISTANT_WEB_PORT` 覆盖。

### 手动等价命令

```bash
cp .env.example .env
cd ai-assistant-vue-playground && npm install && npm run build && cd ..
docker compose -f docker-compose.demo.yml up -d --build
node scripts/smoke-demo-compose.mjs
```

Hub Profile 验证记录：[ai-portfolio/docker/verify-ai-assistant-sdk.md](../../ai-portfolio/docker/verify-ai-assistant-sdk.md)

---

## 零密钥 smoke（单容器后端）

仅启动独立服务（无 Playground UI）：

```bash
cp .env.example .env
# AI_ASSISTANT_API_KEY 可留空
docker compose up -d --build
node scripts/smoke-zero-key.mjs http://localhost:8080/ai-assistant
```

### curl 验收

```bash
# 健康
curl -sf http://localhost:8080/ai-assistant/health

# Provider 探测（无 Key 时为 DOWN，属预期）
curl -sf http://localhost:8080/ai-assistant/health/provider

# Chat 路由（无 Key 时 HTTP 503，success=false — 证明 /chat 已挂载，未调用 LLM）
curl -sf -X POST http://localhost:8080/ai-assistant/chat \
  -H "Content-Type: application/json" \
  -d '{"text":"ping","action":"chat"}' || true
```

最后一行在无 Key 时 curl 会因 503 非零退出；smoke 脚本已按 **503 + JSON** 判定通过。

### `smoke-zero-key.mjs` 验收清单（与脚本一致）

`node scripts/smoke-zero-key.mjs <baseUrl>` 依次探测以下端点（默认 `http://localhost:8080/ai-assistant`，Hub 为 `http://localhost:18080/ai-assistant`）：

| # | 检查项 | 请求 | 预期 |
| ---: | --- | --- | --- |
| 1 | assistant health | `GET {base}/health` | HTTP 200，`success=true` 且 `status=running` |
| 2 | actuator liveness | `GET {origin}/actuator/health/liveness` | HTTP 200，`status=UP` |
| 3 | stats | `GET {base}/stats` | HTTP 200，JSON 对象 |
| 4 | runtime config | `GET {base}/runtime/config` | HTTP 200，`success=true` 且含 `service` / `security` / `features` / `limits` |
| 5 | provider health (no key) | `GET {base}/health/provider` | HTTP 200，`status` 为 `DOWN` / `PENDING` / `UNKNOWN` |
| 6 | chat routing | `POST {base}/chat` body `{"text":"ping","action":"chat"}` | HTTP **503**，`success=false`（证明 `/chat` 已挂载、未调用 LLM） |

全部通过后输出 `Zero-key smoke passed: …`。Playground 演示页会探测 #1 与 #5，显示「后端已连接 · 未配置 API Key」或「Provider UP · 可体验 SSE 流式对话」。

### 带 Access Token 的 smoke（可选）

```bash
node scripts/smoke-standalone-service.mjs http://localhost:8080/ai-assistant your-token
```

---

## 完整流式对话演示（需 API Key）

1. 编辑 `.env`，填入 `AI_ASSISTANT_API_KEY`（及可选 `AI_ASSISTANT_PROVIDER` / `AI_ASSISTANT_MODEL`）
2. 重启：`docker compose -f docker-compose.demo.yml up -d --build`
3. 打开 http://localhost:3000/ ，点击右下角悬浮球提问
4. Network 面板应看到 `POST /ai-assistant/stream` 返回 `text/event-stream`

**5 分钟演示路线：**

1. 自由对话 — 验证 SSE 打字机
2. 切换翻译 / 摘要模式
3. （可选）上传文档或启用 RAG — 见 [配置说明](guide/configuration.md)

---

## Project Hub Profile

Portfolio 统一编排（端口 **18080**）：

```powershell
# 一键（推荐）：启动 Hub Profile + 零密钥 smoke
cd ai-assistant-sdk
.\scripts\demo-hub.ps1
# 或双击 scripts\一键Hub演示.bat
```

手动等价：

```powershell
cd ai-portfolio/docker
docker compose -f docker-compose.profiles.yml --profile ai-assistant-sdk up -d --build
curl http://localhost:18080/ai-assistant/health
node ../../ai-assistant-sdk/scripts/smoke-zero-key.mjs http://localhost:18080/ai-assistant
```

Playground 流式 UI（本地 dev，代理到 Hub 18080）：

```powershell
cd ai-assistant-sdk/ai-assistant-vue-playground
npm run dev
```

页面会自动探测 `/health` 与 `/health/provider`，显示连接状态与 SSE 体验步骤。

与 `docker-compose.demo.yml`（默认 **3000**）端口段不同，可并行运行。

---

## 停止与清理

```bash
docker compose -f docker-compose.demo.yml down
# 或单容器：
docker compose down
```

---

## 相关文档

- [DEPLOYMENT.md](../DEPLOYMENT.md) — 部署模式与运维
- [docs/guide/standalone-service.md](guide/standalone-service.md) — 独立服务详解
- [docs/guide/frontend-standalone.md](guide/frontend-standalone.md) — 前端连远程后端
- [PERFORMANCE.md](../PERFORMANCE.md) — k6 smoke 与容量调优
