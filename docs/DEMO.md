# AI Assistant SDK 演示指南

本指南提供两条可重复演示路径：独立服务 + Playground，以及 Spring Boot Starter 宿主。默认 `demo` Provider 不需要外部 Key，但会经过真实的 REST/SSE 控制器、过滤器、服务层和前端请求链路。

> Demo 输出是确定性测试数据，响应和页面都会明确标识 `Demo / mock`，不能用来评价真实模型质量。真实 Provider 不可用时，服务不会把 Demo 输出伪装成成功结果。

## 环境

- Docker Engine/Desktop + Compose v2
- Node.js 22（运行自动 smoke；Playground 由 Docker 从源码构建）
- Starter 路径额外需要 JDK 21、Maven 3.9+
- Demo 无账号；启用访问令牌后，调用方需发送 `X-AI-Token`

## 路径 A：独立服务与 Playground

### 一键脚本

Windows：

```powershell
.\scripts\demo-standalone.ps1
```

Linux / macOS：

```bash
chmod +x scripts/demo-standalone.sh
./scripts/demo-standalone.sh
```

脚本会复制缺失的 `.env`，由 Docker 从源码构建服务和 Playground，启动 `docker-compose.demo.yml`，再执行自动 smoke。

默认入口：

| 入口 | 地址 |
| --- | --- |
| Playground | `http://localhost:3000/` |
| 后端健康（经 Playground 反代） | `http://localhost:3000/ai-assistant/health` |
| Actuator 存活探针 | `http://localhost:3000/actuator/health/liveness` |

端口可在本地 `.env` 覆盖。不要提交包含密钥的 `.env`。

### 手动等价命令

```bash
cp .env.example .env
docker compose -f docker-compose.demo.yml up -d --build
node scripts/smoke-demo-compose.mjs
```

Windows Command Prompt 将第一行换成 `copy .env.example .env`。

## 路径 B：Starter 示例

`ai-assistant-demo` 是纳入仓库的最小 Spring Boot 宿主，静态页面使用实际 Web Component 包，不依赖外部 CDN。

```powershell
# Windows
.\scripts\demo-starter.ps1
```

```bash
# Linux / macOS
bash scripts/demo-starter.sh
```

脚本使用 lockfile 构建真实 Web Component，再打包并启动 Starter 宿主。可用 `AI_ASSISTANT_DEMO_PORT` 覆盖本地端口。

打开 `http://localhost:8080/`。页面可检查健康状态，并进入 Web Component 对话页。

真实 HTTP 集成测试：

```bash
mvn -pl ai-assistant-demo -am test
```

该测试在随机端口启动宿主，验证 Demo Provider 健康、`/chat` 和 `/stream`，不会占用固定端口。

## 单独运行零密钥 smoke

```bash
cp .env.example .env
docker compose up -d --build
node scripts/smoke-zero-key.mjs http://localhost:8080/ai-assistant
```

脚本依次执行 8 项检查；任何一项失败都会非零退出：

| # | 检查 | 预期 |
| ---: | --- | --- |
| 1 | `GET {base}/health` | HTTP 200；`success=true`、`status=running`、`provider=demo`、`mode=demo`、`mock=true` |
| 2 | `GET {origin}/actuator/health/liveness` | HTTP 200；`status=UP` |
| 3 | `GET {origin}/actuator/health/readiness` | HTTP 200；`status=UP` |
| 4 | `GET {base}/stats` | HTTP 200；JSON 对象 |
| 5 | `GET {base}/runtime/config` | HTTP 200；包含 `service`、`security`、`features`、`limits`，且运行模式为 Demo |
| 6 | `GET {base}/health/provider` | HTTP 200；`status=UP`、`provider=demo`、`mock=true` |
| 7 | `POST {base}/chat` | HTTP 200；包含 Demo 标识、原输入和 `meta.provider=demo` |
| 8 | `POST {base}/stream` | HTTP 200、`text/event-stream`；流中包含 Demo 标识和原输入 |

等价 curl 示例：

```bash
curl -sf http://localhost:8080/ai-assistant/health
curl -sf http://localhost:8080/ai-assistant/health/provider
curl -sf -X POST http://localhost:8080/ai-assistant/chat \
  -H "Content-Type: application/json" \
  -d '{"text":"ping","action":"chat"}'
curl -N -X POST http://localhost:8080/ai-assistant/stream \
  -H "Content-Type: application/json" \
  -H "Accept: text/event-stream" \
  -d '{"text":"stream ping","action":"chat"}'
```

## 3–5 分钟核心演示

1. 打开 Playground，确认状态条显示后端已连接、Provider 为 Demo。
2. 打开右下角助手，发送一条消息，观察 `/ai-assistant/stream` 的逐段响应。
3. 在响应中确认清晰的 Demo 标识；点击停止或重试，检查交互反馈。
4. 打开 Form Fill，复制样例、粘贴到助手、预览字段映射、填充并撤销。
5. 切换到 Admin 页面；未提供 Admin Token 时，页面应明确提示且不发送受保护请求。

## 切换真实 Provider

编辑本地 `.env`：

```dotenv
AI_ASSISTANT_PROVIDER=openai
AI_ASSISTANT_BASE_URL=https://api.openai.com/v1
AI_ASSISTANT_MODEL=gpt-4o-mini
AI_ASSISTANT_API_KEY=<由本地密钥存储注入>
```

然后重建服务：

```bash
docker compose -f docker-compose.demo.yml up -d --build
```

浏览器 Network 中应看到 `POST /ai-assistant/stream` 返回 `text/event-stream`。实际模型质量、配额和地区可用性取决于所选供应商，仓库的离线验收不声明公网调用已经成功。

## 停止与清理

```bash
docker compose -f docker-compose.demo.yml down
docker compose down
```

## 相关文档

- [能力矩阵](./CAPABILITY-MATRIX.md)
- [独立服务](./guide/standalone-service.md)
- [前端连接独立服务](./guide/frontend-standalone.md)
- [配置说明](./guide/configuration.md)
- [生产检查清单](./guide/production-checklist.md)
- [根目录部署文档](https://github.com/Hou-mingyuan/ai-assistant-sdk/blob/main/DEPLOYMENT.md)
- [根目录安全文档](https://github.com/Hou-mingyuan/ai-assistant-sdk/blob/main/SECURITY.md)
- [根目录性能文档](https://github.com/Hou-mingyuan/ai-assistant-sdk/blob/main/PERFORMANCE.md)
