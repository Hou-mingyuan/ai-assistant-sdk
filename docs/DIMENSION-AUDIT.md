# AI Assistant SDK 发布维度审计

本页记录 v1.0.1 发布候选版需要覆盖的审计维度，不给出脱离当前构建结果的主观分数。功能状态以[能力矩阵](./CAPABILITY-MATRIX.md)为准，性能数字以仓库内当次真实运行报告为准。

## 审计范围

| 维度 | 当前边界 | 发布证据 |
| --- | --- | --- |
| 文档 | 中英文 README、快速开始、API、部署、安全、性能、故障排查和能力矩阵必须与代码一致。 | VitePress 构建与死链检查通过。 |
| Starter | Java 21 / Spring Boot 3 宿主可在无 Micrometer Registry、零密钥 Demo 和真实 Provider 配置下启动。 | 自动装配测试、`ai-assistant-demo` 随机端口集成测试。 |
| 独立服务 | Docker 与原生 JAR 使用同一 REST/SSE 契约；默认 Demo 模式不需要外部 Key。 | 健康、同步聊天和 SSE smoke。 |
| Java Client | 认证头、租户头、阻塞式同步响应、SSE、超时与结构化错误一致。 | Maven `verify` 和客户端测试。 |
| Vue / Web Component | 包导出、类型、SSE、错误反馈、移动布局、键盘与宿主滚动锁。 | Vitest、发布构建、Playwright 和真实浏览器检查。 |
| Playground | Demo、Admin、Form Fill 页面不使用假按钮，能显示真实后端状态。 | Playground 测试、浏览器核心流程与截图。 |
| 高级能力 | RAG、Agent、MCP、WebSocket、Admin、Artifact 不得超出代码实际范围。 | 能力矩阵与专项测试。 |
| 安全 | 鉴权、租户上下文、CORS、SSRF、上传限制、PII、注入告警、限流和密钥脱敏。 | 后端边界测试、secret scan、生产配置检查。 |
| 性能 | 固定 Demo 环境分别记录普通 HTTP p95、SSE TTFT 和页面质量；外部模型延迟单列。 | 可重复命令、原始输出与环境信息。 |
| 开箱启动 | 干净目录可按 README 完成依赖安装、启动、健康检查和一次核心对话。 | 干净目录实测命令、耗时和结果。 |

## 不接受的证据

- 把 Demo Provider 的确定性回复称为真实模型效果。
- 把只定义了 `VectorStore` 接口称为已支持某个外部向量数据库。
- 把 `AgentExecutor` 的调用方步骤执行称为自主 ReAct 规划。
- 把 MCP 的三个 JSON-RPC 方法称为完整 MCP 规范实现。
- 用静态页面、占位截图、跳过测试或过期的历史分数代替当前运行结果。

## 发布判定

只有在后端、前端、文档、浏览器 E2E、容器 smoke、性能、安全和干净环境启动均有当次证据，且没有已知 P0/P1 或核心流程可复现问题时，才能把发布候选版判定为可验收。

相关入口：[演示指南](./DEMO.md) · [快速开始](./guide/quick-start.md) · [生产检查](./guide/production-checklist.md)
