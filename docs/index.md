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
features:
  - title: 即插即用
    details: 一个 Maven 依赖 + 一行配置即可启用，支持 OpenAI / DeepSeek / 通义千问 / GLM 等多种 LLM
  - title: MCP Server
    details: 内置 MCP 协议支持，可直接对接织信等低代码平台的 AI Agent
  - title: 可扩展 SPI
    details: ChatInterceptor / AssistantCapability / ConversationMemoryProvider 三大扩展点，深度定制
  - title: 生产就绪
    details: 内置限流、多租户、Token 配额、A/B 测试、Actuator 健康检查、Docker + Helm 部署
---
