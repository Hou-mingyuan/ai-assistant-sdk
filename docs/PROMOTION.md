# AI Assistant SDK · 涨 Star / 曝光作战手册

> 目标：把这个「内容很硬但没曝光」的项目，推到对的人面前，拿下第一批 100 → 1000 Star。
>
> 现状诊断：项目质量高、README 详实，但 ① 无演示图 ② 原本无英文（已补 README_EN）③ 无对外曝光 ④ 仓库元数据未优化。下面按「投入产出比」从高到低排序。

## 第 0 步：仓库元数据（10 分钟，必做）

在 GitHub 仓库首页右上角 **About** 齿轮里设置：

- **Description**（一句话，带关键词，决定搜索命中）：
  > 可嵌入任意 Java + Vue 项目的企业级 AI 助手：16 家大模型、RAG、Agent、多租户，一个 Spring Boot Starter 开箱即用。

  英文：`Embeddable enterprise AI assistant for any Java + Vue app: 16 LLM providers, RAG, agents, multi-tenant. One Spring Boot starter.`
- **Website**：填文档站地址（若用 GitHub Pages 部署 VitePress）。
- **Topics**（标签，极大影响被搜到）：

  `ai` `llm` `spring-boot` `vue3` `rag` `agent` `chatbot` `openai` `deepseek` `function-calling` `java` `sdk` `enterprise` `mcp` `ai-assistant`
- **Social preview**（Settings → Social preview）：上传一张 1280×640 预览图，别人分享链接时显示，点击率翻倍。

## 第 1 步：README 视觉（1–2 小时，ROI 最高）

- [ ] 录制 `docs/assets/demo.gif` 首屏动图（见 `docs/assets/README.md`）
- [ ] 补 3–4 张核心截图（对话 / RAG / 管理后台）
- [ ] （可选）做一张 banner / social preview 图

> 视觉决定第一印象，缺图的项目 Star 转化率极低。这一步比写任何文案都值。

## 第 2 步：发一个正式 Release（20 分钟）

- 打 tag `v1.0.1`，写 Release Notes（复用 `CHANGELOG.md`）。
- 有 Release 的项目显得「在维护、开箱可用」，也会进入 GitHub 的 Releases 信息流。

## 第 3 步：内容营销（核心获客）

**中文渠道**（你有 CSDN 基础，天然优势）：
- 掘金、思否 SegmentFault、CSDN、知乎、开源中国 OSChina、V2EX（`分享创造` 节点）
- 微信公众号 / 技术交流群

**英文渠道**（涨 Star 天花板更高）：
- Reddit：`r/java`、`r/vuejs`、`r/selfhosted`、`r/opensource`、`r/SideProject`
- Hacker News：`Show HN: AI Assistant SDK – drop an AI assistant into any Java + Vue app`
- dev.to、Medium、Product Hunt（发布日集中拉票）
- Twitter/X：带 `#buildinpublic` `#opensource` `#LLM`

**文章标题参考**：
- 《我把企业级 AI 助手做成了 Spring Boot Starter，一行接入 16 家大模型》
- 《5 分钟给你的 Vue 项目加一个带 RAG 的 AI 助手》
- 《支持多租户 + PII 脱敏的 AI 助手 SDK 是怎么设计的》

**文章结构模板**：痛点（每个项目都想加 AI，但重复造轮子）→ 演示 GIF → 5 分钟接入代码 → 亮点（多模型 / RAG / Agent / 企业能力）→ 架构图 → GitHub 链接 + 求 Star。

## 第 4 步：收录到 Awesome 列表（长尾流量）

给这些列表提 PR，把本项目加进去（附一句话价值 + 截图）：
- `awesome-java`、`awesome-spring-boot`、`awesome-vue`、`awesome-llm`、`awesome-chatgpt`、`awesome-selfhosted`、`awesome-mcp-servers`

## 第 5 步：持续运营

- 及时回复 Issue / PR（响应速度直接影响口碑与回访）。
- 每次更新写 CHANGELOG + 发小版本 Release。
- README 顶部保持 Star 引导 + Star History 图（已加）。
- 把项目 Pin 到 GitHub 个人主页，并写进简历作品集。

## 一句话优先级

先补 **demo.gif + 元数据 + 英文 README（已完成）**，再发 **1 篇中文长文 + 1 个 Show HN**，就能看到第一波明显增长。
