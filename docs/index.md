---
layout: home
hero:
  name: AI Assistant SDK
  text: 可嵌入的 AI 助手
  tagline: Spring Boot Starter + Vue 3 组件库，为任何 Java 项目添加智能对话能力
  actions:
    - theme: brand
      text: 快速开始
      link: /guide/quick-start
    - theme: alt
      text: API 文档
      link: /api/
    - theme: alt
      text: Docker 部署
      link: /guide/standalone-service
    - theme: alt
      text: 前端连接
      link: /guide/frontend-standalone
    - theme: alt
      text: 排障手册
      link: /guide/troubleshooting
    - theme: alt
      text: 上线清单
      link: /guide/production-checklist
    - theme: alt
      text: 能力矩阵
      link: /CAPABILITY-MATRIX
features:
  - title: 即插即用
    details: 一个 Maven 依赖 + 一行配置即可启用，支持 OpenAI / DeepSeek / 通义千问 / GLM 等多种 LLM
  - title: MCP Server
    details: 实验性的 HTTP JSON-RPC 子集，仅含 initialize、tools/list、tools/call，默认关闭
  - title: 可扩展 SPI
    details: ChatInterceptor / AssistantCapability / ConversationMemoryProvider 三大扩展点，深度定制
  - title: 可验证的发布候选版
    details: 核心 REST/SSE 有自动化与浏览器测试；上线前仍需按安全、容量和供应商条件逐项验收
---
