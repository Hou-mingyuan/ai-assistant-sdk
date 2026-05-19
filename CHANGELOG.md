# Changelog

> 由 `scripts/generate-changelog.mjs` 从 git log 自动生成。
> 采用 [Conventional Commits](https://www.conventionalcommits.org/) 类型分组。

## [Unreleased]

_K-wave: K36 集成 prompt history · K37 TTS · K38 RAG drop · K39 cross-session search · K40 CompareRegionsView · K41 a11y · K42 N-way · K43 KB picker · K44 ChatInputArea spec + K36 bug fix · K45 selection-grain · K46 code-block hover · K47 all-columns · K48 keyboard shortcuts_

### ✨ Features

- **ui:** K47 - all-columns view in CompareRegionsDialog (N parallel cols + synced scroll) [`bab984f`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/bab984f69917c5193e1976fd0ce10bd52a268b9a)
- **ui:** K46 - hover 'Add to Compare' button on every assistant code block [`fbbe385`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/fbbe38586f8fd9a798b8e2a12360c678dd09b532)
- **ui:** K48 - keyboard shortcuts (1-9 / N / Esc) in the KB picker popover [`a47b3e8`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/a47b3e80a85f89f889cacbef6a061368c08733c3)
- **ui:** K45 - selection-granular Compare (right-click any text/code selection to mark) [`447f99d`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/447f99d7185ea1e8fdbcd93e115e41ffdef5bd43)
- **ui:** K43 - KB target picker popover after FAB drop when 2+ KBs exist [`fda9de2`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/fda9de2f89dc962f43b8ebc88f708af6fa9c6c23)
- **ui:** K42 - N-way (up to 4) Compare regions with pair-tab strip [`3655962`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/36559620f6fbb53b4643369691977a1d83e4cc94)
- **ui:** K40 - CompareRegionsView with side-by-side line diff for assistant messages [`09d6a66`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/09d6a66c06ea786c3bfd76d456730fbe6e3ff520)
- **ui:** K39 - cross-session message search with snippet jumping in SessionsDrawer [`b71de16`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/b71de16e599e1ec8f63b39d03ad9a8943dbf4de3)
- **ui:** K38 - drag-and-drop file onto FAB to ingest into Knowledge Base [`eb7dfec`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/eb7dfec712b13f9c422fdfe1dc85e371c4ff58d7)
- **ui:** K37 - audio output prefs in PersonalizeDialog + auto-read assistant replies [`7a88882`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/7a88882f5ebc0d5d3ac1a713564f10c4f57acb5b)
- **ui:** K36 - integrate usePromptHistory into AiAssistant send() (Up/Down recall) [`30b6d56`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/30b6d5622370c66c055cdc72f518b8bb24bd44a6)

### 🎨 Style

- K36a - apply prettier to 53 frontend files (no behaviour change) [`f25ab1c`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/f25ab1c5303b3cfb4b1234c0937aea49cd327454)

### 🧪 Tests

- **ui:** K44 - ChatInputArea component-level integration spec + uncover K36 boolean-prop bug [`eab89ec`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/eab89ec0291d3f02cecd0dbb918d75b260cda275)

### 🌱 Other

- a11y(ui): K41 - reduced-motion + ARIA live + focus on dialog open for K36-K40 features [`3ba1ef9`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/3ba1ef9b3e3b32ee0d0daaa11a65316cd5111cd1)

#### 重点 user-visible 改动

- **K36** terminal 风格 ↑/↓ prompt 回放（送出 record · 空输入框 ↑ 召回 · Esc 退出）。**K44 同步修复 K36 长期被 Vue Boolean 默认 false 静默禁用的 bug**。
- **K37** PersonalizeDialog "Audio output" 段：voice 选择 · 0.5–2x 语速 · 自动朗读 toggle，全 4 语言完整翻译。
- **K38** 关闭面板时拖拽文件到悬浮球 → ingest 到 "Quick Ingest" KB。**K43 多 KB 时** 弹 picker popover，**K48 还支持 1-9 / N / Esc 键盘** 选择。
- **K39** SessionsDrawer 搜索框增 cross-session 全文搜索 — 黄色高亮命中片段，点击跳转 + 闪烁。
- **K40 + K42 + K45 + K46 + K47** Compare 系列：单条 → N-way → pair tab → 选区 → 代码块 hover + → All columns 同步滚动。 LCS 算法 178 行 + 12 单测 + 完整 dialog UI。

## [v1.0.1] 2026-05-13

_Earliest commit → HEAD_

### ✨ Features

- **ui:** G1 - All sessions drawer (filter + time bucket grouping) [`104b4ba`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/104b4ba08d669f88e5939d6e88c798e55b0f32c9)
- **playground:** G5 - AdminDemoPanel showcasing adminApi SDK usage [`6d4cdeb`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/6d4cdeb2f75c3acd65fa00c61620d628e9100d62)
- **ui:** F3 - active search match jump pulse animation [`539ccf5`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/539ccf57d4007683b21850a7bccf858bb7186ef7)
- **ui:** F4 - code block language chip + collapse for long snippets [`7ec9691`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/7ec969168fbbc2823c5653b0d373c44b7a5ca46b)
- **ui:** E2 - TTFT (Time To First Token) display in stream progress chip [`c726a07`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/c726a07451316ab7b6b9c47a8151a145f855f0b7)
- **ui:** E1 - keyboard shortcuts cheat sheet (Ctrl+/ to open) [`35801ab`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/35801ab65b4efd831f6f60568137a3a20159c1b6)
- **ui:** D3 - Admin SDK module (adminApi.ts) wrapping 15 /admin/* endpoints [`e8f9bcc`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/e8f9bcc1ade22520a64ca2e8a7e32fba01cc42b2)
- **ui:** D5 - stream progress chip (chars + elapsed) during generation [`a68f102`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/a68f102d30183752db6a375581e2814bc58410c4)
- **ui:** D4 - page-context visualization + one-click toggle [`f5e5b04`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/f5e5b0410e62a62d0d001f4e7ab707e38e3ca7c5)
- **server:** inject frontend page context into LLM + classify error types [`2ce2d4d`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/2ce2d4da1dac35c3b867d8648963b3401459d38a)
- **security:** add AdminAuthFilter for /admin/** endpoints [`9f3567f`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/9f3567f38298169ec415e2b19828eafadea55412)
- **ui:** UX 第四波 - 5 项顺眼调整 [`efea80b`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/efea80bc97b709eedf15c4b15f75062be3b81513)
- **ui:** UX 第三波 - 模式按钮胶囊 / 顶栏图标统一 / 滚动到底 / 链接卡 / 图片lightbox / 响应式 / 暗色切换 [`f9884d6`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/f9884d699f66b53db3c980caf5bb383c6eee04d8)
- **ui:** C10 虚拟滚动接入 MessageList（opt-in via options.virtualScroll） [`8f5b3ef`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/8f5b3eff64fe50226bd72d54d3b3c33062d4b0dc)
- **ui:** B8 测试 + A4 TTS 暂停/继续 + B7 服务端模板拉取 [`d1b1c66`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/d1b1c661fa51365e774c48a977166521e2d5bcac)
- **ui:** MCP 工具自动注册为 plugin（useMcpAutoPlugin） [`21ff602`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/21ff60251c7abd0fb05098d07c76c0949d1c3fe0)
- **ui:** AI 助手进化功能 第二轮（A1/A4/B7/B8/A3/C10/C9） [`44eea04`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/44eea0465cb905ccb584d14e0f0a912885cf5788)
- **server:** warn when in-memory state runs in a multi-replica deployment [`a47f715`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/a47f7155e4a66632259fbd111ef5b9c1e6fffc11)
- **server:** warn when in-process rate limit runs on multi-replica [`ae36bad`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/ae36bad64c8cb8bb603b344c91ac30f7678c0f87)
- **server:** add capability banner + annotate yml defaults [`892af10`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/892af102d6486ee6433d6b7f6d2fb21f6d9b2fcd)
- **ui:** add Vite plugin for zero-config auto-mount [`e60015f`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/e60015fbcf2876102e691de01879d88f182e04d5)
- **ui:** add 11 UX improvements for chat widget - auto-resize textarea, scroll-to-bottom, timestamps, char counter, error retry, ctrl+enter toggle, bubble animations, sound notification, upload progress, expanded languages, multi-select delete [`59a377d`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/59a377d0d90c6a7060b9f69d11e881350ad8fa57)
- harden session store, PII validation, structured audit logging [`4cd9553`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/4cd9553c00fd951430370b243bf4668c73eaf087)
- show assistant diagnostics error details [`d6d9d07`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/d6d9d074ba3e7e3639c2d4dd889c43e4674c787d)
- optimize assistant diagnostics experience [`23cb501`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/23cb501e21a95f03c05cb1ac03b6de7e43e9e0df)
- track playground and e2e smoke checks [`0843b11`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/0843b11152e9be2b1b57b51c02a48e3f84ad0b1e)
- expose safe runtime config summary [`7b0192a`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/7b0192afab0f6dc530ce6c37c6350113f905419d)
- smoke test published image and add proxy examples [`0738239`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/07382398c1dc5ca0717bd3c925c62f5636a47e83)
- add production compose template [`a9d7ce0`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/a9d7ce0bb1ccde0e773d641dac98f9ce43b32d4c)
- add structured logging for standalone service [`4814a20`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/4814a2023f05e7a46fe75376dbbdead37e61dce5)
- add standalone smoke test and docker hub publish [`42d28ef`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/42d28efbc63484948b2365a5e71bcc3d8b92ea46)
- add standalone image release and deployment docs [`d5b3a39`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/d5b3a397dce15cb3b65e5765c73e94e346a801e4)
- add standalone image metadata and limits [`80fd134`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/80fd13488d7826a195ba6b3226df43da8364422a)
- expose standalone service runtime tuning [`6154866`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/61548669970e1bfcc6c66809459ef2b08da9da19)
- add standalone assistant service [`f439454`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/f439454b8d06ebd6bd282139468dae1de5207538)
- complete 14-point evolution - observability, SSE, function calling, MCP server, plugin system, Docker, docs [`1b8e6a0`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/1b8e6a0debc1da2dccff16c25d3ca83ed2ff0f15)
- add SPI extension layer, code quality tools, and coverage gates [`927ff26`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/927ff2611c1be4a8ebab1a990f777b1491ec9c45)
- integrate ContentFilter, TokenUsageTracker, ModelRouter, RagService into LlmService main flow; fix frontend i18n and a11y issues [`0cf9df2`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/0cf9df25f38c2db43cd1903539f2e21f96f9faa3)
- add API provider connectivity check on startup. Auto-tests connection with GET /models when app starts, logs clear success/failure banner. Adds GET /health/provider and POST /health/provider/recheck endpoints. Runs in virtual thread to avoid blocking startup. [`2f33d08`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/2f33d0859c636bcbf4880420c84927a09fd823f1)
- upgrade to 16 AI providers with latest 2026 models. Add Gemini, SiliconFlow, Groq, Yi, Spark, Baichuan, Stepfun, Hunyuan, Ollama. Update defaults: OpenAI gpt-5.4-mini, Qwen qwen-plus, Zhipu glm-5.1, Kimi moonshot-v1-auto. Add provider aliases: glm, google, xunfei, tencent, lingyiwanwu. 210 tests pass. [`90eb068`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/90eb06801e32a35f506e11f18231016b3f6dfc20)
- implement 12 evolution features - RAG, memory, prompt templates, token tracking, agent executor, content filter, model router, A/B testing, admin dashboard. All 157 tests passing. [`bf7946e`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/bf7946e57e94a66dc6af65cec33fcd172ef146f9)
- add 10 architecture-level optimizations including async webhook, tenant isolation, health scheduler, rate limit headers, SSE compression, JSON logging. All 123 tests passing. [`7a99c93`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/7a99c93a15c88215265a6e54bfbb5db70570837f)
- 10 architecture-level optimizations including write ops, circuit breaker, tool caching, error codes [`209cee5`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/209cee5dcae422eeea6f81a212d00237bff652e5)
- implement 15 comprehensive optimizations across security, performance, testing, and DevOps [`2f460e8`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/2f460e85aa9c4ace4df9d0f6e774e13208f95b3e)
- add JDBC/REST connectors, unit tests, and Web Component wrapper [`a8f8b39`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/a8f8b396a4cf6c3d7d6d3182d2432d16f335164c)
- add DataConnector plugin architecture for external data sources [`960be39`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/960be39e94489996c3a1b87ddc3f7bd65811bbc7)
- major feature expansion - vision, function calling, plugins, multi-session, voice, workflows, CI/CD, Docker, docs [`20ee9c3`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/20ee9c31b72ffa1121f4a09830821d3111969485)
- client system prompt and model picker; export and UI fixes [`3a5b5a7`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/3a5b5a73a852debc1be73edc402d706861af3997)

### 🐛 Bug Fixes

- **ui:** 杜绝横向滚动条 - body/empty/mode-bar 强制 overflow-x:hidden + wrap [`7ba69b3`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/7ba69b300490d59c042be846259910d7f4687660)
- **ui:** assistant message grid layout (thinking+bubble stack vertical) [`65032a7`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/65032a7472fbc22b147d1be9a447e63606d4a62e)
- **ui:** 助手消息气泡被 flex 挤成竖排 - 给 bubble/thinking/tool 兄弟 flex:1 撑满剩余空间 [`283a837`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/283a8373c23cad18544201d3c7d900176911b192)
- **docker:** include application/BOOT-INF/lib/* in ENTRYPOINT classpath [`5e6d183`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/5e6d1834b2cb4663deb9b17abd6801374038d5a5)
- **playground:** update default proxy target from 8080 to 18080 [`a6cb8d0`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/a6cb8d0ee1f9ba6bfba5e36ad601a24b9b826286)
- **ui:** preserve SSE data leading whitespace + stop button accessibility [`9be3138`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/9be31387d4290f50e2532b78059032c7ddf3d85b)
- **server:** remove duplicate waitDuration from ResilientLlmClient [`2b073ec`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/2b073ecd4f75e4e148c863f0eec1c271284c5e58)
- **e2e:** pin Playwright webServer to 127.0.0.1:5273 for Windows IPv6 compat [`a765f0d`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/a765f0dfa5e68cd38802378c1335d9f1b0c15e8b)
- **server:** use CamelCase PII rule names so the combined regex compiles [`2be0130`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/2be013059cb83da7af6dbb89c478f996b32f30ac)
- review pass - fix PersonalizeDialog ID, cache RTF, update docs and CHANGELOG [`63a14f7`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/63a14f793b9bb3a5741286ffdf3076405069e821)
- add diagnostics copy fallback [`2bfb4f3`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/2bfb4f3603463635d249cbf8314d6b1da7bf5a1f)
- improve assistant code wall lifecycle and diagnostics a11y [`a0ccc26`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/a0ccc267360af0f44165db5bab3e6fa86e147c6b)
- respect reduced motion in assistant effects [`7469363`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/74693639a5af04af1002cc75f691a020305474c1)
- warn on public standalone access without token [`35ed34d`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/35ed34d17010c22a2bc9ec5ca95b730de1be0716)
- tighten standalone docker build validation [`139f19a`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/139f19ab18e791d206b6aa19f9167f5aee96cdca)
- use layered standalone docker image [`95793c7`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/95793c7ea44ee86d470fc2fb40ec9801a60b80c3)
- improve standalone container lifecycle [`ac4b2a9`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/ac4b2a9f09b9c578c5197b09b6d2d2e758530ead)
- restrict standalone actuator exposure [`45a6a64`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/45a6a64cb04741ad3c4c308f7e2ac8d106cd33b6)
- harden standalone docker runtime [`204aea8`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/204aea80fce6dc63f26e33a84a553746034a3cf5)
- support proxied standalone docker deployment [`a9d0f94`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/a9d0f94775e7a94624fd81befd98709c4ffe034c)
- make standalone docker build reproducible [`94ea645`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/94ea645574369e0e09f01ca8f53613bcaa5cecb3)
- sanitize origins and tenant headers [`e646c5a`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/e646c5a598271ef6423f8436d9b1b01c32f6ef20)
- parse frontend sse events robustly [`6d62d21`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/6d62d2117868db4181d6327fce1c2e88277d4ca8)
- normalize frontend api urls [`ae48241`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/ae4824152e7900d9fbaa2744869b79119a7440a6)
- cap export image prefetch urls [`c98ebee`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/c98ebeec352fa06e246252896a204183e7ea45e4)
- harden request path and token boundaries [`5958027`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/59580271b868afcef070d2d63f64565612fc0f8b)
- sanitize client model list [`4f16d33`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/4f16d33ea7070aeca17f8f91cf152c04ceb84ebf)
- normalize assistant context path [`b6379b1`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/b6379b18c283f2b72687f5c5da33da7443656e27)
- validate java client configuration [`13bc84d`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/13bc84d65552a610427f23dbfcc1d9f89028d3d9)
- sanitize error messages in CapabilityController and McpServerController to prevent info disclosure [`c2ebe89`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/c2ebe89579dd22b3ce5954348054edd9a4e74ed3)
- resolve 15 code review issues - quota race, async timeout, info leak, plugin safety, input validation [`6553ae8`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/6553ae843acca94a8f2fcd8bedb9cb75901761c4)
- resolve 36 code review issues - auth, streaming filter, quota, a11y, null safety, lifecycle cleanup [`2dabee4`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/2dabee4e90a43cffa4ec5e457696d8c95062ed02)
- update all provider default models to latest official versions [`57883c7`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/57883c79a1b55c46673c73a33728f000188fbc1b)
- update DeepSeek default to deepseek-v4-flash per official API docs. Add comprehensive model options in README per official sources (OpenAI gpt-5.5 series, DeepSeek V4, Qwen3.x, GLM-5.1, Gemini 3.1). [`34dc039`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/34dc0390455e3bd300c1a831dbf8e4811bab81cd)
- prevent infinite loop in chunkText, add null validation in AdminDashboardController endpoints [`cb81617`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/cb81617bd401e485aab8d0fd06fdf31fecd59b5d)
- SSE compression actually applies GZIP, fix AsyncTaskController memory leak and HttpClient reuse [`e8b1578`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/e8b1578696fe44a4872f6b84fa5095ca9ef6b5ea)
- circuit breaker exception tracking, connector registration deserialization, thread safety for ToolRegistry and ConnectorHealthController [`792faf5`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/792faf5bdbb87c74db6e830da3bd185154c9ed98)
- address 5 issues found in second-round deep code review [`ffc8cf5`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/ffc8cf5af8244dcfd194606fb8eedfed324a465c)
- address 3 issues found during deep code review [`3299e6b`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/3299e6b3f69ffad7de199472c7a101b6632e760f)
- repair all 26 failing frontend tests (57/57 pass) [`3f3aa77`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/3f3aa77a1135fc48c7712f21a06e34e25fc4b2eb)
- review fixes for connectors and Web Component [`e24096c`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/e24096c262d2ababa082dd4bb946914295e7654f)
- security and reliability improvements across 6 core files [`1546657`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/1546657f93565777c9317cb48856f72a22cfb1c5)
- lambda effectively-final violation in LlmService.executeToolsWithProgress [`bf0a784`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/bf0a7845ce601eb8d5b6e7ddfc03e273d71bf175)
- remove duplicate ensurePanelInViewport and fix type mismatch in usePanelGeometry [`9409c47`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/9409c47f286e7b838dfc487d4326650f8316ebaa)
- comprehensive code quality improvements and security hardening [`aebdb50`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/aebdb50fe9984d2ad8b0d2b3578aa72aa1d72e19)
- add WebSocket handshake authentication to prevent unauthenticated LLM access [`a0d8e3a`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/a0d8e3a52b72ea709c5ea6c7b693cf46fe59fd3d)

### ⚡ Performance Improvements

- **ui:** D1 - measure real message heights via ResizeObserver for virtual scroll [`b36b260`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/b36b26087f54036ee7b5c687ba373a9e8112e085)
- concurrent URL fetching, stream audit token estimation, fix AuditLogger compat [`91b33e2`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/91b33e2f862420642955da102da6d8a4366a2194)
- optimize JdbcConnector and Web Component [`dd58cfe`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/dd58cfe763777c57a26e949506d2089a976a002d)

### ♻️ Refactors

- **ui:** D2 - unify settings into a single gear button with popover menu [`61f0c5a`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/61f0c5ab8ea32817c49e82cdf143e63831daec17)
- **ui:** extract useSendStream composable from AiAssistant SFC [`9fd718f`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/9fd718f9dfe911ef172abcfa6bffef0693e00332)
- **ui:** extract useChatOrchestrator composable [`df8a9d2`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/df8a9d25d91100837f713a6c5e2164ae4b5b2759)
- **ui:** extract AssistantHeader from the AiAssistant SFC [`5436d4c`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/5436d4c46ae2efefc411c15bef5528cb354f1bda)
- **ui:** extract MessageList from the AiAssistant SFC [`c61761f`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/c61761f4266d5aaddcd49ab0af688111a97fed6d)
- **server:** extract LlmService into a 3-stage pipeline [`25ffecd`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/25ffecd1d5406d5ffbd45e506b1c6f4c0823237a)
- **server:** extract SsrfPolicy abstraction from UrlFetchSafety [`7b5f9d2`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/7b5f9d2e3da6d8c28f4cb1881fa4c9da7f312e91)
- **server:** regroup rate-limit, security, admin properties into nested classes [`4423d3a`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/4423d3afca77ab023a15fb17124764abc749cd3e)
- **server:** extract OpenAI response parsing into a dedicated class [`8ae0980`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/8ae09803b8d3bec692e2e357b4d359ffc620e86c)
- **server:** extract HTML text utils out of UrlFetchService [`703eefe`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/703eefe0560d010ddeecea8997fd3a89e1bd84b9)
- **ui:** extract image paste/drop logic into a composable [`cb44b5f`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/cb44b5fefef8bfe32235b83a29321bd4906c4786)
- **server:** group RAG properties into a nested RagProperties [`4596a31`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/4596a3190c676b3be4483e62037768eb9b5edfab)
- **ui:** split 98 KB AiAssistant.styles.css into 8 ordered slices [`7aeb786`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/7aeb78647c5cd47e4f1c5d965f52004c94c15817)
- **ui:** split i18n.ts into per-locale modules [`292605b`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/292605b467aa97b3c57962b3ae83372dde542eac)
- raise quality gates, add root POM, split large component, add LICENSE [`199d765`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/199d765b03bd4d2ddece5c134e3940e3bb7fc4e2)
- **ui:** extract CodeWall to composable, add codewall toggle, lightweight stream rendering, expand translation languages [`f0a1ca3`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/f0a1ca3d035734f31c8e64102e1e354cca2c9fde)
- eliminate code duplication and clean up wildcard imports [`7bf7139`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/7bf713909aed13b6af5ec88380f09e0fc3370d10)
- improve ConnectorFactory JDBC type error messaging [`d3dcef6`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/d3dcef66a4088c0266b74171182e8b6c63995f2e)

### 🎨 Style

- **server:** apply google-java-format to server-side codebase [`671c523`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/671c523dc69080c93629763722b8b08f2fcca17d)
- **ui:** modern theme v2 - 紫粉→科技蓝青渐变 (sky/cyan/blue) [`26649af`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/26649afbd78c7ac511d280972740b336f7e59cc0)
- **ui:** UX 现代化第一/二波 - 视觉清理 + 空状态 starter + 悬浮球图标 [`98e9748`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/98e9748f5b0fc0d03b6a597b6a17b08e30cef494)

### 📚 Documentation

- **changelog:** record round-2 refactor (SsrfPolicy, multi-replica advisor, LlmService pipeline, AiAssistant SFC split) [`ef75278`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/ef75278425f0c4c0cb9faa8f692240d5622ae140)
- **guide:** add an integration decision tree to the landing page [`fc953b2`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/fc953b2b3a2545343b2b932286958c2b91e0fd86)
- **readme:** rewrite as 266-line signpost (was 1559 lines) [`23aa62f`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/23aa62fdff7c61a1089580026e6e77364bc4d405)
- expand assistant optimization docs [`efb3504`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/efb3504ee317f0c31599a4ee64b03a893ad48b58)
- add production readiness checklist [`739415b`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/739415bc693048e64f4a5a2e3716b3cb9f6d3fdb)
- add deployment troubleshooting guide [`4b364be`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/4b364beddce022590461fc69d55ea470fafb8669)
- add standalone frontend integration guide [`f36bc6e`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/f36bc6e0ff44c698e3cde5218c5681a43b94d5cb)
- clarify standalone frontend integration [`2b49762`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/2b497621f4bd3d58f523d744a5d1646aa4a857d8)
- comprehensive README update - document all implemented backend capabilities including RAG, Admin API, async tasks, multi-tenant, PII masking, model routing, agent executor, prompt templates, token tracking, connector health monitoring, and 11 missing config properties [`bcd3d29`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/bcd3d2980e60ad2f4147e5f649854b531d51130d)
- add Data Connector and Web Component sections to README [`e544477`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/e5444773937033fa3446e45caacc3079728340cd)

### 🧪 Tests

- **server,e2e:** rewrite AutoConfiguration smoke tests + improve stream E2E [`dd9b8a7`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/dd9b8a716c602a413188a1df93c06f98419908fe)
- **e2e:** add useSendStream Playwright spec and fix Windows webServer probe [`aa05f98`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/aa05f98de9f1ae6c156f6c1ec3679eea13fbbf5c)
- **server:** add unit tests for the LlmService 3-stage pipeline helpers [`c5d9557`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/c5d9557ef047ef12e1730066d18e2c3849ae9fca)
- **server:** make the LlmResponseCache LRU eviction test deterministic [`a98341c`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/a98341c138eb4eea5ecfefc9496e93bf1a226df6)
- **ui:** align hljsRegistered.spec with the lazy-load core/extended split [`68d2eac`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/68d2eac41cb1be8df31e38ad5f7bd995a9eb1a0f)
- complete missing unit tests and fix AgentExecutor stopOnError bug. Add AdminDashboardControllerTest 19 tests, ConversationMemoryTest 10 tests, AgentExecutorTest 10 tests, PromptTemplateRegistryTest 8 tests, SseCompressionFilterTest 4 tests. Fix AgentExecutor.execute failed step not added to results before break. Total 208 tests 0 failures. [`8fcda8b`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/8fcda8b49339d2e78859b0bac475dde3fa564eb3)
- add unit tests for CircuitBreaker, ConnectorFactory, and ToolRegistry (28 new tests) [`d2f468c`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/d2f468c0483dd16cd8009cab4f2f541ad4a74240)

### 🔧 Chores

- G6 + G4 - bundle size CI gate + progress.md fourth-round summary [`9b5445f`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/9b5445fc6cc2e49c3ffbddec731f751e5de1012f)
- **scripts:** F5 - one-click release script (version bump + CHANGELOG + tag) [`b909cfd`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/b909cfd3049a2fb05a6e1410c06efb5ea8a540a5)
- **scripts:** F2 - bundle size watchdog with gzip + baseline diff [`102cbd8`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/102cbd80a5d6f524d66bb380e31c6909fcf39d11)
- **scripts:** E3 - auto-generate CHANGELOG.md from conventional commits [`bbece20`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/bbece2091b55f2f51c48a5f291b1f681fa2c7963)
- **ui:** clean up pre-existing lint warnings (0 error / 0 warning) [`7fa9a87`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/7fa9a87da618fa8b257ca86dc094d939844e4122)
- **deps:** apply round-3 patch upgrades (option A, batch 2) [`8238ba1`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/8238ba1de869cf03b22bff1104455ce08f7a71cd)
- **deps:** bump Spring Boot 3.5.0 to 3.5.3 and jackson-databind 2.18.3 to 2.18.4 [`c947248`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/c9472484cb7a95e976935bbaf927e4507c529875)
- **docker:** unignore root pom and client module for multi-module build [`a2cd656`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/a2cd656eea0af6b2188f9c3063969e3842db61bf)
- upgrade tech stack (Java 21, Spring Boot 3.5, Vite 6, Node 22) + fix critical/major code issues [`73627c9`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/73627c96b295766bb124297d35966bfd45611bf6)
- remove .cursor from repo; ignore entire .cursor directory [`5ac0b67`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/5ac0b6763ceb239f1f3d9e74382d332f77285ec1)
- stop tracking demo and playground; document optional local copies [`185a27b`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/185a27b24e91804c3d003612458d9a7358926c5b)
- initial import AI Assistant SDK (Spring starter, Vue UI, demo, playground) [`1be5665`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/1be5665c37596b566e30503d5f098735746cf38f)

### 🤖 CI

- harden release package publishing [`e744b15`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/e744b15a0ab485317f4ab5fec4b620c8aabd52b7)
- publish java sdk packages [`a4add3d`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/a4add3d845038cb1d867003b9ba4426eb0aaf3c1)
- harden docker image release flow [`9335c30`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/9335c30e49704a2bce3ca01b0d92a3dec85c96ec)
- check package version consistency [`e99531b`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/e99531b8bbe7ff972b8b3a13cadf888479f59c5d)
- validate repository deployment config [`41c3951`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/41c3951ef2f56665a5145f7e8ad74c3f3344cf91)
- add dependency update automation [`fb6343a`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/fb6343afed2eb68bcc5623c42fc14a340eb8e9cc)
- build docs on changes [`88c28c4`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/88c28c44927f30f1b6e6879185ccda1622f12949)

### 🌱 Other

- test-add-e2e-ci [`322b08a`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/322b08a558ad014425433610c8a092fdaabbc5cb)
- test-harden-llm-backend-coverage [`20bfd90`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/20bfd909aec47a9ee0f4fba24a8372c04c276082)
- frontend-harden-markdown-cache-coverage [`d16b114`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/d16b1144d5c92355ea467658f0279d4eec0c224a)
- frontend-raise-coverage-gates [`140461d`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/140461d7c2eb02e9db7bab50856548916d7fc6c9)
- frontend-harden-multi-session-lifecycle-coverage [`6370f27`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/6370f27a0b1700b4eb4a78805020e39a403e0e67)
- frontend-harden-markdown-renderer-coverage [`84ab2ac`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/84ab2ac2f17391c0fc97b260233670b4806478af)
- frontend-harden-stream-fallback-coverage [`43bbc4f`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/43bbc4f50b3e8b37ad83eff44bbd2258fb0069cf)
- frontend-harden-session-search-coverage [`4c6b729`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/4c6b72949931ae6a7079199ea3f5ab1be365b11f)
- frontend-harden-plugin-registry-coverage [`c61a664`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/c61a66430fd13c0a823ee02f0aa670fd6e4171c7)
- frontend-harden-multi-session-coverage [`37049b5`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/37049b534644ba5b903864b7702427c3d9773f48)
- frontend-complete-utils-coverage [`1ab11c7`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/1ab11c75c4db00373139b336d9718c5f23059e57)
- frontend-expand-api-test-coverage [`46864ee`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/46864ee9e7090fdaa997a209baae8aac1fe0615c)
- frontend-test-highlight-registration-coverage [`7d60548`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/7d6054808468c15cf3e441e37b0d25011a910160)
- ci-reduce-duplicate-workflow-runs [`a488b2a`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/a488b2aeb643693bf4fa138f42e5546607cb625d)
- ci-group-dependabot-updates [`d279eab`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/d279eab2c45c5064dbc7aad9b53cc347e9bd6896)
- ci-upgrade-actions-node24-compatible [`782d32d`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/782d32d508b5f4f99a55308a0fba788a965ead50)
- ci-opt-in-node24-actions-runtime [`fb1ecec`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/fb1ecec2f7541ce76968fdb040a42bf1aba75232)
- ci-add-docs-build-job [`b14a390`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/b14a390412e7d7f5e0ac402002ae1af363c0c047)
- docs-expand-standalone-production-guidance [`58f21bd`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/58f21bd9af8219ba95589457ac9d24fbae7b1e81)
- ci-add-image-sbom-provenance-and-scans [`7186b6e`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/7186b6e034ee13e671171622008cccc3f1c5d43e)
- frontend-harden-package-exports [`83a4034`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/83a40342a93195110700389d4959698cdcefcd96)
- ci-fix-standalone-docker-and-clean-frontend-lint [`149db54`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/149db546ecb9ded255c316be42f569b2421a0865)
- ci-restore-release-and-validation-gates [`9a2222f`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/9a2222f689cf063e433c522c49cdf6d088c791d9)
-  fix: cap extracted file text length [`dcf8372`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/dcf837288baebce8cca3589ae575e4dfc1ebadc7)
-  fix: validate uploaded file type boundaries [`a126a19`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/a126a191abc45cef35079c54971d9877aaf99a7b)
-  fix: validate async task webhook and ids [`57ffea9`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/57ffea9b5b4eff1049fd8a59519719776ed45bff)
-  fix: defensively copy in-memory sessions [`2d56f8d`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/2d56f8d49db143063da18659acfebb6f35b24ca8)
-  fix: validate controller input boundaries [`1b2bbf3`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/1b2bbf3d00b4b9d00fd351f879f951fec8326067)
-  fix: harden outbound URL safety checks [`daee941`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/daee941c845ec84ac03e9a836163ddfd59d14742)
-  fix: require explicit opt-in for mcp server [`7453e14`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/7453e14093ab5b9e559a78b9edd60bd8dd6da306)
-  fix: harden assistant management surfaces [`4472ed8`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/4472ed86a63620eacf134dd40ae95c8223bda1e1)
- Harden assistant SDK and add client tests [`deaeaa4`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/deaeaa47c4e5ba0af8b55df67719d1d6ec6dc133)

## 2026-05-13

### ✨ Features

- **ui:** E2 - TTFT (Time To First Token) display in stream progress chip [`c726a07`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/c726a07451316ab7b6b9c47a8151a145f855f0b7)
- **ui:** E1 - keyboard shortcuts cheat sheet (Ctrl+/ to open) [`35801ab`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/35801ab65b4efd831f6f60568137a3a20159c1b6)
- **ui:** D3 - Admin SDK module (adminApi.ts) wrapping 15 /admin/* endpoints [`e8f9bcc`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/e8f9bcc1ade22520a64ca2e8a7e32fba01cc42b2)
- **ui:** D5 - stream progress chip (chars + elapsed) during generation [`a68f102`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/a68f102d30183752db6a375581e2814bc58410c4)
- **ui:** D4 - page-context visualization + one-click toggle [`f5e5b04`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/f5e5b0410e62a62d0d001f4e7ab707e38e3ca7c5)
- **server:** inject frontend page context into LLM + classify error types [`2ce2d4d`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/2ce2d4da1dac35c3b867d8648963b3401459d38a)
- **security:** add AdminAuthFilter for /admin/** endpoints [`9f3567f`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/9f3567f38298169ec415e2b19828eafadea55412)
- **ui:** UX 第四波 - 5 项顺眼调整 [`efea80b`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/efea80bc97b709eedf15c4b15f75062be3b81513)
- **ui:** UX 第三波 - 模式按钮胶囊 / 顶栏图标统一 / 滚动到底 / 链接卡 / 图片lightbox / 响应式 / 暗色切换 [`f9884d6`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/f9884d699f66b53db3c980caf5bb383c6eee04d8)
- **ui:** C10 虚拟滚动接入 MessageList（opt-in via options.virtualScroll） [`8f5b3ef`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/8f5b3eff64fe50226bd72d54d3b3c33062d4b0dc)
- **ui:** B8 测试 + A4 TTS 暂停/继续 + B7 服务端模板拉取 [`d1b1c66`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/d1b1c661fa51365e774c48a977166521e2d5bcac)
- **ui:** MCP 工具自动注册为 plugin（useMcpAutoPlugin） [`21ff602`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/21ff60251c7abd0fb05098d07c76c0949d1c3fe0)
- **ui:** AI 助手进化功能 第二轮（A1/A4/B7/B8/A3/C10/C9） [`44eea04`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/44eea0465cb905ccb584d14e0f0a912885cf5788)

### 🐛 Bug Fixes

- **ui:** 杜绝横向滚动条 - body/empty/mode-bar 强制 overflow-x:hidden + wrap [`7ba69b3`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/7ba69b300490d59c042be846259910d7f4687660)
- **ui:** assistant message grid layout (thinking+bubble stack vertical) [`65032a7`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/65032a7472fbc22b147d1be9a447e63606d4a62e)
- **ui:** 助手消息气泡被 flex 挤成竖排 - 给 bubble/thinking/tool 兄弟 flex:1 撑满剩余空间 [`283a837`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/283a8373c23cad18544201d3c7d900176911b192)

### ⚡ Performance Improvements

- **ui:** D1 - measure real message heights via ResizeObserver for virtual scroll [`b36b260`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/b36b26087f54036ee7b5c687ba373a9e8112e085)

### ♻️ Refactors

- **ui:** D2 - unify settings into a single gear button with popover menu [`61f0c5a`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/61f0c5ab8ea32817c49e82cdf143e63831daec17)

### 🎨 Style

- **server:** apply google-java-format to server-side codebase [`671c523`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/671c523dc69080c93629763722b8b08f2fcca17d)
- **ui:** modern theme v2 - 紫粉→科技蓝青渐变 (sky/cyan/blue) [`26649af`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/26649afbd78c7ac511d280972740b336f7e59cc0)
- **ui:** UX 现代化第一/二波 - 视觉清理 + 空状态 starter + 悬浮球图标 [`98e9748`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/98e9748f5b0fc0d03b6a597b6a17b08e30cef494)

### 🔧 Chores

- **ui:** clean up pre-existing lint warnings (0 error / 0 warning) [`7fa9a87`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/7fa9a87da618fa8b257ca86dc094d939844e4122)

## 2026-05-12

### 🐛 Bug Fixes

- **docker:** include application/BOOT-INF/lib/* in ENTRYPOINT classpath [`5e6d183`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/5e6d1834b2cb4663deb9b17abd6801374038d5a5)
- **playground:** update default proxy target from 8080 to 18080 [`a6cb8d0`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/a6cb8d0ee1f9ba6bfba5e36ad601a24b9b826286)
- **ui:** preserve SSE data leading whitespace + stop button accessibility [`9be3138`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/9be31387d4290f50e2532b78059032c7ddf3d85b)
- **server:** remove duplicate waitDuration from ResilientLlmClient [`2b073ec`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/2b073ecd4f75e4e148c863f0eec1c271284c5e58)
- **e2e:** pin Playwright webServer to 127.0.0.1:5273 for Windows IPv6 compat [`a765f0d`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/a765f0dfa5e68cd38802378c1335d9f1b0c15e8b)

### 🧪 Tests

- **server,e2e:** rewrite AutoConfiguration smoke tests + improve stream E2E [`dd9b8a7`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/dd9b8a716c602a413188a1df93c06f98419908fe)

## 2026-05-11

### ♻️ Refactors

- **ui:** extract useSendStream composable from AiAssistant SFC [`9fd718f`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/9fd718f9dfe911ef172abcfa6bffef0693e00332)

### 🧪 Tests

- **e2e:** add useSendStream Playwright spec and fix Windows webServer probe [`aa05f98`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/aa05f98de9f1ae6c156f6c1ec3679eea13fbbf5c)

### 🔧 Chores

- **deps:** apply round-3 patch upgrades (option A, batch 2) [`8238ba1`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/8238ba1de869cf03b22bff1104455ce08f7a71cd)
- **deps:** bump Spring Boot 3.5.0 to 3.5.3 and jackson-databind 2.18.3 to 2.18.4 [`c947248`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/c9472484cb7a95e976935bbaf927e4507c529875)

## 2026-05-10

### ✨ Features

- **server:** warn when in-memory state runs in a multi-replica deployment [`a47f715`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/a47f7155e4a66632259fbd111ef5b9c1e6fffc11)
- **server:** warn when in-process rate limit runs on multi-replica [`ae36bad`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/ae36bad64c8cb8bb603b344c91ac30f7678c0f87)
- **server:** add capability banner + annotate yml defaults [`892af10`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/892af102d6486ee6433d6b7f6d2fb21f6d9b2fcd)

### 🐛 Bug Fixes

- **server:** use CamelCase PII rule names so the combined regex compiles [`2be0130`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/2be013059cb83da7af6dbb89c478f996b32f30ac)

### ♻️ Refactors

- **ui:** extract useChatOrchestrator composable [`df8a9d2`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/df8a9d25d91100837f713a6c5e2164ae4b5b2759)
- **ui:** extract AssistantHeader from the AiAssistant SFC [`5436d4c`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/5436d4c46ae2efefc411c15bef5528cb354f1bda)
- **ui:** extract MessageList from the AiAssistant SFC [`c61761f`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/c61761f4266d5aaddcd49ab0af688111a97fed6d)
- **server:** extract LlmService into a 3-stage pipeline [`25ffecd`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/25ffecd1d5406d5ffbd45e506b1c6f4c0823237a)
- **server:** extract SsrfPolicy abstraction from UrlFetchSafety [`7b5f9d2`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/7b5f9d2e3da6d8c28f4cb1881fa4c9da7f312e91)
- **server:** regroup rate-limit, security, admin properties into nested classes [`4423d3a`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/4423d3afca77ab023a15fb17124764abc749cd3e)
- **server:** extract OpenAI response parsing into a dedicated class [`8ae0980`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/8ae09803b8d3bec692e2e357b4d359ffc620e86c)
- **server:** extract HTML text utils out of UrlFetchService [`703eefe`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/703eefe0560d010ddeecea8997fd3a89e1bd84b9)
- **ui:** extract image paste/drop logic into a composable [`cb44b5f`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/cb44b5fefef8bfe32235b83a29321bd4906c4786)
- **server:** group RAG properties into a nested RagProperties [`4596a31`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/4596a3190c676b3be4483e62037768eb9b5edfab)
- **ui:** split 98 KB AiAssistant.styles.css into 8 ordered slices [`7aeb786`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/7aeb78647c5cd47e4f1c5d965f52004c94c15817)
- **ui:** split i18n.ts into per-locale modules [`292605b`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/292605b467aa97b3c57962b3ae83372dde542eac)

### 📚 Documentation

- **changelog:** record round-2 refactor (SsrfPolicy, multi-replica advisor, LlmService pipeline, AiAssistant SFC split) [`ef75278`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/ef75278425f0c4c0cb9faa8f692240d5622ae140)
- **guide:** add an integration decision tree to the landing page [`fc953b2`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/fc953b2b3a2545343b2b932286958c2b91e0fd86)
- **readme:** rewrite as 266-line signpost (was 1559 lines) [`23aa62f`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/23aa62fdff7c61a1089580026e6e77364bc4d405)

### 🧪 Tests

- **server:** add unit tests for the LlmService 3-stage pipeline helpers [`c5d9557`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/c5d9557ef047ef12e1730066d18e2c3849ae9fca)
- **server:** make the LlmResponseCache LRU eviction test deterministic [`a98341c`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/a98341c138eb4eea5ecfefc9496e93bf1a226df6)
- **ui:** align hljsRegistered.spec with the lazy-load core/extended split [`68d2eac`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/68d2eac41cb1be8df31e38ad5f7bd995a9eb1a0f)

### 🔧 Chores

- **docker:** unignore root pom and client module for multi-module build [`a2cd656`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/a2cd656eea0af6b2188f9c3063969e3842db61bf)

## 2026-05-07

### ✨ Features

- **ui:** add Vite plugin for zero-config auto-mount [`e60015f`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/e60015fbcf2876102e691de01879d88f182e04d5)

### 🐛 Bug Fixes

- review pass - fix PersonalizeDialog ID, cache RTF, update docs and CHANGELOG [`63a14f7`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/63a14f793b9bb3a5741286ffdf3076405069e821)

### ♻️ Refactors

- raise quality gates, add root POM, split large component, add LICENSE [`199d765`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/199d765b03bd4d2ddece5c134e3940e3bb7fc4e2)

### 🔧 Chores

- upgrade tech stack (Java 21, Spring Boot 3.5, Vite 6, Node 22) + fix critical/major code issues [`73627c9`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/73627c96b295766bb124297d35966bfd45611bf6)

## 2026-05-06

### ✨ Features

- **ui:** add 11 UX improvements for chat widget - auto-resize textarea, scroll-to-bottom, timestamps, char counter, error retry, ctrl+enter toggle, bubble animations, sound notification, upload progress, expanded languages, multi-select delete [`59a377d`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/59a377d0d90c6a7060b9f69d11e881350ad8fa57)
- harden session store, PII validation, structured audit logging [`4cd9553`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/4cd9553c00fd951430370b243bf4668c73eaf087)

### ⚡ Performance Improvements

- concurrent URL fetching, stream audit token estimation, fix AuditLogger compat [`91b33e2`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/91b33e2f862420642955da102da6d8a4366a2194)

### ♻️ Refactors

- **ui:** extract CodeWall to composable, add codewall toggle, lightweight stream rendering, expand translation languages [`f0a1ca3`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/f0a1ca3d035734f31c8e64102e1e354cca2c9fde)

## 2026-04-30

### ✨ Features

- show assistant diagnostics error details [`d6d9d07`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/d6d9d074ba3e7e3639c2d4dd889c43e4674c787d)
- optimize assistant diagnostics experience [`23cb501`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/23cb501e21a95f03c05cb1ac03b6de7e43e9e0df)
- track playground and e2e smoke checks [`0843b11`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/0843b11152e9be2b1b57b51c02a48e3f84ad0b1e)

### 🐛 Bug Fixes

- add diagnostics copy fallback [`2bfb4f3`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/2bfb4f3603463635d249cbf8314d6b1da7bf5a1f)
- improve assistant code wall lifecycle and diagnostics a11y [`a0ccc26`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/a0ccc267360af0f44165db5bab3e6fa86e147c6b)
- respect reduced motion in assistant effects [`7469363`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/74693639a5af04af1002cc75f691a020305474c1)

### 📚 Documentation

- expand assistant optimization docs [`efb3504`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/efb3504ee317f0c31599a4ee64b03a893ad48b58)

## 2026-04-29

### ✨ Features

- expose safe runtime config summary [`7b0192a`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/7b0192afab0f6dc530ce6c37c6350113f905419d)
- smoke test published image and add proxy examples [`0738239`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/07382398c1dc5ca0717bd3c925c62f5636a47e83)
- add production compose template [`a9d7ce0`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/a9d7ce0bb1ccde0e773d641dac98f9ce43b32d4c)
- add structured logging for standalone service [`4814a20`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/4814a2023f05e7a46fe75376dbbdead37e61dce5)
- add standalone smoke test and docker hub publish [`42d28ef`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/42d28efbc63484948b2365a5e71bcc3d8b92ea46)
- add standalone image release and deployment docs [`d5b3a39`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/d5b3a397dce15cb3b65e5765c73e94e346a801e4)
- add standalone image metadata and limits [`80fd134`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/80fd13488d7826a195ba6b3226df43da8364422a)
- expose standalone service runtime tuning [`6154866`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/61548669970e1bfcc6c66809459ef2b08da9da19)
- add standalone assistant service [`f439454`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/f439454b8d06ebd6bd282139468dae1de5207538)

### 🐛 Bug Fixes

- warn on public standalone access without token [`35ed34d`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/35ed34d17010c22a2bc9ec5ca95b730de1be0716)
- tighten standalone docker build validation [`139f19a`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/139f19ab18e791d206b6aa19f9167f5aee96cdca)
- use layered standalone docker image [`95793c7`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/95793c7ea44ee86d470fc2fb40ec9801a60b80c3)
- improve standalone container lifecycle [`ac4b2a9`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/ac4b2a9f09b9c578c5197b09b6d2d2e758530ead)
- restrict standalone actuator exposure [`45a6a64`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/45a6a64cb04741ad3c4c308f7e2ac8d106cd33b6)
- harden standalone docker runtime [`204aea8`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/204aea80fce6dc63f26e33a84a553746034a3cf5)
- support proxied standalone docker deployment [`a9d0f94`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/a9d0f94775e7a94624fd81befd98709c4ffe034c)
- make standalone docker build reproducible [`94ea645`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/94ea645574369e0e09f01ca8f53613bcaa5cecb3)
- sanitize origins and tenant headers [`e646c5a`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/e646c5a598271ef6423f8436d9b1b01c32f6ef20)
- parse frontend sse events robustly [`6d62d21`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/6d62d2117868db4181d6327fce1c2e88277d4ca8)
- normalize frontend api urls [`ae48241`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/ae4824152e7900d9fbaa2744869b79119a7440a6)
- cap export image prefetch urls [`c98ebee`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/c98ebeec352fa06e246252896a204183e7ea45e4)
- harden request path and token boundaries [`5958027`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/59580271b868afcef070d2d63f64565612fc0f8b)
- sanitize client model list [`4f16d33`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/4f16d33ea7070aeca17f8f91cf152c04ceb84ebf)
- normalize assistant context path [`b6379b1`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/b6379b18c283f2b72687f5c5da33da7443656e27)
- validate java client configuration [`13bc84d`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/13bc84d65552a610427f23dbfcc1d9f89028d3d9)

### 📚 Documentation

- add production readiness checklist [`739415b`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/739415bc693048e64f4a5a2e3716b3cb9f6d3fdb)
- add deployment troubleshooting guide [`4b364be`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/4b364beddce022590461fc69d55ea470fafb8669)
- add standalone frontend integration guide [`f36bc6e`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/f36bc6e0ff44c698e3cde5218c5681a43b94d5cb)
- clarify standalone frontend integration [`2b49762`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/2b497621f4bd3d58f523d744a5d1646aa4a857d8)

### 🤖 CI

- harden release package publishing [`e744b15`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/e744b15a0ab485317f4ab5fec4b620c8aabd52b7)
- publish java sdk packages [`a4add3d`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/a4add3d845038cb1d867003b9ba4426eb0aaf3c1)
- harden docker image release flow [`9335c30`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/9335c30e49704a2bce3ca01b0d92a3dec85c96ec)
- check package version consistency [`e99531b`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/e99531b8bbe7ff972b8b3a13cadf888479f59c5d)
- validate repository deployment config [`41c3951`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/41c3951ef2f56665a5145f7e8ad74c3f3344cf91)
- add dependency update automation [`fb6343a`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/fb6343afed2eb68bcc5623c42fc14a340eb8e9cc)
- build docs on changes [`88c28c4`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/88c28c44927f30f1b6e6879185ccda1622f12949)

### 🌱 Other

- test-add-e2e-ci [`322b08a`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/322b08a558ad014425433610c8a092fdaabbc5cb)
- test-harden-llm-backend-coverage [`20bfd90`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/20bfd909aec47a9ee0f4fba24a8372c04c276082)
- frontend-harden-markdown-cache-coverage [`d16b114`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/d16b1144d5c92355ea467658f0279d4eec0c224a)
- frontend-raise-coverage-gates [`140461d`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/140461d7c2eb02e9db7bab50856548916d7fc6c9)
- frontend-harden-multi-session-lifecycle-coverage [`6370f27`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/6370f27a0b1700b4eb4a78805020e39a403e0e67)
- frontend-harden-markdown-renderer-coverage [`84ab2ac`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/84ab2ac2f17391c0fc97b260233670b4806478af)
- frontend-harden-stream-fallback-coverage [`43bbc4f`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/43bbc4f50b3e8b37ad83eff44bbd2258fb0069cf)
- frontend-harden-session-search-coverage [`4c6b729`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/4c6b72949931ae6a7079199ea3f5ab1be365b11f)
- frontend-harden-plugin-registry-coverage [`c61a664`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/c61a66430fd13c0a823ee02f0aa670fd6e4171c7)
- frontend-harden-multi-session-coverage [`37049b5`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/37049b534644ba5b903864b7702427c3d9773f48)
- frontend-complete-utils-coverage [`1ab11c7`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/1ab11c75c4db00373139b336d9718c5f23059e57)
- frontend-expand-api-test-coverage [`46864ee`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/46864ee9e7090fdaa997a209baae8aac1fe0615c)
- frontend-test-highlight-registration-coverage [`7d60548`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/7d6054808468c15cf3e441e37b0d25011a910160)
- ci-reduce-duplicate-workflow-runs [`a488b2a`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/a488b2aeb643693bf4fa138f42e5546607cb625d)
- ci-group-dependabot-updates [`d279eab`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/d279eab2c45c5064dbc7aad9b53cc347e9bd6896)
- ci-upgrade-actions-node24-compatible [`782d32d`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/782d32d508b5f4f99a55308a0fba788a965ead50)
- ci-opt-in-node24-actions-runtime [`fb1ecec`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/fb1ecec2f7541ce76968fdb040a42bf1aba75232)
- ci-add-docs-build-job [`b14a390`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/b14a390412e7d7f5e0ac402002ae1af363c0c047)
- docs-expand-standalone-production-guidance [`58f21bd`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/58f21bd9af8219ba95589457ac9d24fbae7b1e81)
- ci-add-image-sbom-provenance-and-scans [`7186b6e`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/7186b6e034ee13e671171622008cccc3f1c5d43e)
- frontend-harden-package-exports [`83a4034`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/83a40342a93195110700389d4959698cdcefcd96)
- ci-fix-standalone-docker-and-clean-frontend-lint [`149db54`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/149db546ecb9ded255c316be42f569b2421a0865)
- ci-restore-release-and-validation-gates [`9a2222f`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/9a2222f689cf063e433c522c49cdf6d088c791d9)
-  fix: cap extracted file text length [`dcf8372`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/dcf837288baebce8cca3589ae575e4dfc1ebadc7)
-  fix: validate uploaded file type boundaries [`a126a19`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/a126a191abc45cef35079c54971d9877aaf99a7b)
-  fix: validate async task webhook and ids [`57ffea9`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/57ffea9b5b4eff1049fd8a59519719776ed45bff)
-  fix: defensively copy in-memory sessions [`2d56f8d`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/2d56f8d49db143063da18659acfebb6f35b24ca8)

## 2026-04-28

### 🌱 Other

-  fix: validate controller input boundaries [`1b2bbf3`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/1b2bbf3d00b4b9d00fd351f879f951fec8326067)
-  fix: harden outbound URL safety checks [`daee941`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/daee941c845ec84ac03e9a836163ddfd59d14742)
-  fix: require explicit opt-in for mcp server [`7453e14`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/7453e14093ab5b9e559a78b9edd60bd8dd6da306)
-  fix: harden assistant management surfaces [`4472ed8`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/4472ed86a63620eacf134dd40ae95c8223bda1e1)
- Harden assistant SDK and add client tests [`deaeaa4`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/deaeaa47c4e5ba0af8b55df67719d1d6ec6dc133)

## 2026-04-27

### ✨ Features

- complete 14-point evolution - observability, SSE, function calling, MCP server, plugin system, Docker, docs [`1b8e6a0`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/1b8e6a0debc1da2dccff16c25d3ca83ed2ff0f15)
- add SPI extension layer, code quality tools, and coverage gates [`927ff26`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/927ff2611c1be4a8ebab1a990f777b1491ec9c45)
- integrate ContentFilter, TokenUsageTracker, ModelRouter, RagService into LlmService main flow; fix frontend i18n and a11y issues [`0cf9df2`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/0cf9df25f38c2db43cd1903539f2e21f96f9faa3)
- add API provider connectivity check on startup. Auto-tests connection with GET /models when app starts, logs clear success/failure banner. Adds GET /health/provider and POST /health/provider/recheck endpoints. Runs in virtual thread to avoid blocking startup. [`2f33d08`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/2f33d0859c636bcbf4880420c84927a09fd823f1)
- upgrade to 16 AI providers with latest 2026 models. Add Gemini, SiliconFlow, Groq, Yi, Spark, Baichuan, Stepfun, Hunyuan, Ollama. Update defaults: OpenAI gpt-5.4-mini, Qwen qwen-plus, Zhipu glm-5.1, Kimi moonshot-v1-auto. Add provider aliases: glm, google, xunfei, tencent, lingyiwanwu. 210 tests pass. [`90eb068`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/90eb06801e32a35f506e11f18231016b3f6dfc20)
- implement 12 evolution features - RAG, memory, prompt templates, token tracking, agent executor, content filter, model router, A/B testing, admin dashboard. All 157 tests passing. [`bf7946e`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/bf7946e57e94a66dc6af65cec33fcd172ef146f9)
- add 10 architecture-level optimizations including async webhook, tenant isolation, health scheduler, rate limit headers, SSE compression, JSON logging. All 123 tests passing. [`7a99c93`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/7a99c93a15c88215265a6e54bfbb5db70570837f)
- 10 architecture-level optimizations including write ops, circuit breaker, tool caching, error codes [`209cee5`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/209cee5dcae422eeea6f81a212d00237bff652e5)
- implement 15 comprehensive optimizations across security, performance, testing, and DevOps [`2f460e8`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/2f460e85aa9c4ace4df9d0f6e774e13208f95b3e)

### 🐛 Bug Fixes

- sanitize error messages in CapabilityController and McpServerController to prevent info disclosure [`c2ebe89`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/c2ebe89579dd22b3ce5954348054edd9a4e74ed3)
- resolve 15 code review issues - quota race, async timeout, info leak, plugin safety, input validation [`6553ae8`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/6553ae843acca94a8f2fcd8bedb9cb75901761c4)
- resolve 36 code review issues - auth, streaming filter, quota, a11y, null safety, lifecycle cleanup [`2dabee4`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/2dabee4e90a43cffa4ec5e457696d8c95062ed02)
- update all provider default models to latest official versions [`57883c7`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/57883c79a1b55c46673c73a33728f000188fbc1b)
- update DeepSeek default to deepseek-v4-flash per official API docs. Add comprehensive model options in README per official sources (OpenAI gpt-5.5 series, DeepSeek V4, Qwen3.x, GLM-5.1, Gemini 3.1). [`34dc039`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/34dc0390455e3bd300c1a831dbf8e4811bab81cd)
- prevent infinite loop in chunkText, add null validation in AdminDashboardController endpoints [`cb81617`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/cb81617bd401e485aab8d0fd06fdf31fecd59b5d)
- SSE compression actually applies GZIP, fix AsyncTaskController memory leak and HttpClient reuse [`e8b1578`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/e8b1578696fe44a4872f6b84fa5095ca9ef6b5ea)
- circuit breaker exception tracking, connector registration deserialization, thread safety for ToolRegistry and ConnectorHealthController [`792faf5`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/792faf5bdbb87c74db6e830da3bd185154c9ed98)
- address 5 issues found in second-round deep code review [`ffc8cf5`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/ffc8cf5af8244dcfd194606fb8eedfed324a465c)
- address 3 issues found during deep code review [`3299e6b`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/3299e6b3f69ffad7de199472c7a101b6632e760f)

### ♻️ Refactors

- eliminate code duplication and clean up wildcard imports [`7bf7139`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/7bf713909aed13b6af5ec88380f09e0fc3370d10)
- improve ConnectorFactory JDBC type error messaging [`d3dcef6`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/d3dcef66a4088c0266b74171182e8b6c63995f2e)

### 📚 Documentation

- comprehensive README update - document all implemented backend capabilities including RAG, Admin API, async tasks, multi-tenant, PII masking, model routing, agent executor, prompt templates, token tracking, connector health monitoring, and 11 missing config properties [`bcd3d29`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/bcd3d2980e60ad2f4147e5f649854b531d51130d)

### 🧪 Tests

- complete missing unit tests and fix AgentExecutor stopOnError bug. Add AdminDashboardControllerTest 19 tests, ConversationMemoryTest 10 tests, AgentExecutorTest 10 tests, PromptTemplateRegistryTest 8 tests, SseCompressionFilterTest 4 tests. Fix AgentExecutor.execute failed step not added to results before break. Total 208 tests 0 failures. [`8fcda8b`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/8fcda8b49339d2e78859b0bac475dde3fa564eb3)
- add unit tests for CircuitBreaker, ConnectorFactory, and ToolRegistry (28 new tests) [`d2f468c`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/d2f468c0483dd16cd8009cab4f2f541ad4a74240)

## 2026-04-26

### ✨ Features

- add JDBC/REST connectors, unit tests, and Web Component wrapper [`a8f8b39`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/a8f8b396a4cf6c3d7d6d3182d2432d16f335164c)
- add DataConnector plugin architecture for external data sources [`960be39`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/960be39e94489996c3a1b87ddc3f7bd65811bbc7)

### 🐛 Bug Fixes

- repair all 26 failing frontend tests (57/57 pass) [`3f3aa77`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/3f3aa77a1135fc48c7712f21a06e34e25fc4b2eb)
- review fixes for connectors and Web Component [`e24096c`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/e24096c262d2ababa082dd4bb946914295e7654f)
- security and reliability improvements across 6 core files [`1546657`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/1546657f93565777c9317cb48856f72a22cfb1c5)

### ⚡ Performance Improvements

- optimize JdbcConnector and Web Component [`dd58cfe`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/dd58cfe763777c57a26e949506d2089a976a002d)

### 📚 Documentation

- add Data Connector and Web Component sections to README [`e544477`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/e5444773937033fa3446e45caacc3079728340cd)

## 2026-04-11

### 🐛 Bug Fixes

- lambda effectively-final violation in LlmService.executeToolsWithProgress [`bf0a784`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/bf0a7845ce601eb8d5b6e7ddfc03e273d71bf175)
- remove duplicate ensurePanelInViewport and fix type mismatch in usePanelGeometry [`9409c47`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/9409c47f286e7b838dfc487d4326650f8316ebaa)
- comprehensive code quality improvements and security hardening [`aebdb50`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/aebdb50fe9984d2ad8b0d2b3578aa72aa1d72e19)

## 2026-04-07

### ✨ Features

- major feature expansion - vision, function calling, plugins, multi-session, voice, workflows, CI/CD, Docker, docs [`20ee9c3`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/20ee9c31b72ffa1121f4a09830821d3111969485)

### 🐛 Bug Fixes

- add WebSocket handshake authentication to prevent unauthenticated LLM access [`a0d8e3a`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/a0d8e3a52b72ea709c5ea6c7b693cf46fe59fd3d)

## 2026-04-06

### ✨ Features

- client system prompt and model picker; export and UI fixes [`3a5b5a7`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/3a5b5a73a852debc1be73edc402d706861af3997)

### 🔧 Chores

- remove .cursor from repo; ignore entire .cursor directory [`5ac0b67`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/5ac0b6763ceb239f1f3d9e74382d332f77285ec1)
- stop tracking demo and playground; document optional local copies [`185a27b`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/185a27b24e91804c3d003612458d9a7358926c5b)
- initial import AI Assistant SDK (Spring starter, Vue UI, demo, playground) [`1be5665`](https://github.com/Hou-mingyuan/ai-assistant-sdk/commit/1be5665c37596b566e30503d5f098735746cf38f)
