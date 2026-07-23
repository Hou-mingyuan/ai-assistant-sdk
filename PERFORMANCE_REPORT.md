# AI Assistant SDK 性能验收报告

本报告记录可复现的本地基线。结果用于发现明显回退，不代表真实上游模型的生产延迟或容量。

## 2026-07-22 最终验收结果

环境：Windows 11、Docker Desktop、JDK 21、Node.js 22、Chromium 150、Lighthouse 13.4.1。`docker-compose.demo.yml` 使用显式 `demo` provider，由生产 Nginx 在被忽略的本地端口 `19014` 反代真实 Spring Boot 服务；未修改产品默认端口，也未启动重复的数据库或缓存容器。

### 本地接口

| 路径 | 样本与并发 | p50 | p95 | p99 | 最大值 | 门槛 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `GET /ai-assistant/health` | 100，5 并发 | 11.44 ms | **16.34 ms** | 18.67 ms | 30.42 ms | p95 < 400 ms |
| `POST /ai-assistant/chat` | 30，3 并发 | 17.78 ms | **22.90 ms** | 23.23 ms | 23.23 ms | p95 < 1,000 ms |
| `POST /ai-assistant/stream` 首个 SSE 事件 | 30，3 并发 | 28.66 ms | **35.00 ms** | 36.74 ms | 36.74 ms | p95 < 1,000 ms |

130 次普通 HTTP 请求和 30 次 SSE 请求全部成功。阻塞与 SSE 响应都校验了明确的 Demo 标识和原始输入回显。与 2026-07-20 的本机基线相比，健康、阻塞对话和 SSE 首事件 p95 分别由 23.59 ms、27.59 ms、77.40 ms 降至 16.34 ms、22.90 ms、35.00 ms；本次路径额外包含生产 Nginx 反代，因此只用于回归判断，不外推到真实模型。

### Lighthouse

Playground 是开发者工具页面，不考核 SEO；其余三类指标按统一完成标准验收。

| 配置 | Performance | Accessibility | Best Practices | FCP | LCP | TBT | CLS | 传输量 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 移动端（默认模拟，首次） | **80** | **100** | **100** | 1.36 s | 1.80 s | 825 ms | 0 | 52 KiB |
| 移动端（默认模拟，复跑） | **84** | **100** | **100** | 1.30 s | 1.64 s | 630 ms | 0 | 52 KiB |
| 桌面端（desktop preset） | **99** | **100** | **100** | 0.32 s | 0.38 s | 85 ms | 0 | 52 KiB |

桌面端三项稳定达到门槛；移动端 Accessibility 与 Best Practices 为 100，Performance 两次为 80-84。两次移动报告都包含 Lighthouse 的 CPU 校准告警：测试设备比默认移动模拟预期更慢，可能压低 Performance 分数；桌面报告无运行警告。以上结果来自无扩展、无登录状态的全新无头 Chromium 会话，保留两次移动结果，不用单次高分替代波动范围。

## 2026-07-20 基线

环境：Windows 11、Java 21、独立服务、显式 `demo` provider、本地回环网络。验收通过被忽略的本地配置运行在 `19010`，未修改产品默认端口。

| 路径 | 样本与并发 | p50 | p95 | p99 | 最大值 | 门槛 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `GET /ai-assistant/health` | 100，5 并发 | 11.03 ms | **23.59 ms** | 28.43 ms | 30.13 ms | p95 < 400 ms |
| `POST /ai-assistant/chat` | 30，3 并发 | 14.69 ms | **27.59 ms** | 28.10 ms | 28.10 ms | p95 < 1,000 ms |
| `POST /ai-assistant/stream` 首个 SSE 事件 | 30，3 并发 | 50.76 ms | **77.40 ms** | 77.97 ms | 77.97 ms | p95 < 1,000 ms |

所有请求均成功，且阻塞与 SSE 响应都校验了明确的 Demo 标识和原始输入回显。`/chat` 与 `/stream` 数据只反映确定性的本地 Demo 实现；真实 provider 必须在目标网络、模型与配额条件下另行压测。

## 复现

先以显式 Demo provider 启动服务，再运行。也可以把地址替换为生产 Playground 的同源反代地址：

```bash
node performance/demo-contract-benchmark.mjs http://127.0.0.1:8080/ai-assistant
```

可选第二个参数会保存 JSON 结果：

```bash
node performance/demo-contract-benchmark.mjs \
  http://127.0.0.1:8080/ai-assistant \
  performance-result.json
```

脚本先预热，然后测量 100 次健康请求、30 次阻塞请求和 30 次 SSE 请求；任一 p95 超过报告中的门槛时退出码非零。

生产 Playground 的 Lighthouse 复现命令：

```bash
npx lighthouse http://127.0.0.1:3000/ \
  --only-categories=performance,accessibility,best-practices \
  --output=json --output-path=mobile.json

npx lighthouse http://127.0.0.1:3000/ --preset=desktop \
  --only-categories=performance,accessibility,best-practices \
  --output=json --output-path=desktop.json
```

## 健康端点负载烟测

`performance/k6-smoke.js` 保留 5 VU × 30 秒的健康端点烟测，默认门槛为 p95 < 400 ms、失败率 < 1%。它不调用聊天接口，不产生真实模型费用：

```bash
k6 run performance/k6-smoke.js
```

## 未覆盖范围

- 真实 OpenAI-compatible provider 的网络延迟、限额和价格；
- RAG 大规模向量库、Redis 多副本和长会话容量；
- 生产网关、TLS、代理缓冲与地域网络；
- 长时间 soak、峰值并发和故障注入。

生产压测应在隔离环境中使用受控配额，并同步观察 CPU、堆内存、上游 429/5xx、SSE 断流和恢复行为。
