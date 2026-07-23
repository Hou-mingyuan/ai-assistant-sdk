# AI Assistant SDK 优化进度

## 2026-07-22 v1.x 发布候选 Goal

- 2026-07-23 从全新本地 clone 检出远端 `42b2631`，仅在被忽略的 `.env` 中把宿主端口设为 `19010`，容器内部保持 `8080`；README Compose 构建启动成功（`584.8s`），随后健康状态为 `healthy`，零密钥 HTTP/SSE smoke `8/8`，实际镜像内 17 个 Netty 构件均为 `4.1.136.Final`。同一远端提交的 GitHub Actions 干净 checkout 用时约 2 分钟完成 Compose 构建、健康等待和 `8/8` smoke。
- 运行日志复核发现正常 SSE 下游结束被审计成 `ERROR`；已新增 `CANCELLED` 结果与取消回归测试。Starter 全量 `verify`、仓库发布门禁 `98/98` 均通过；当前源码重建到宿主 `19011` 后再次 smoke `8/8`，审计日志明确为 `SUCCESS/CANCELLED/SUCCESS` 且无假错误。
- 远端 `42b2631` 的 CI、Standalone Docker、Docs、Helm 全绿：E2E `32/32`，完整 publish 构建生成 Web Component 并校验 27 个导出，Trivy Security、Backend、Frontend、Playground、Compose smoke 均通过。新增审计修复仍需最后一轮远端 CI 复验。
- 2026-07-23 CI 复核推翻了此前“安全扫描最终为 0”的结论：Trivy 当日更新后的数据库在 Netty `4.1.135.Final` 中识别出 `CVE-2026-59901`、`CVE-2026-55831`、`CVE-2026-55833`、`CVE-2026-56745` 四个 HIGH。旧结论只代表旧数据库快照，不再作为最终证据。
- 已将 Starter、独立服务和 Demo 的 Netty 基线固定为 `4.1.136.Final`；Starter 在 Spring Boot BOM 前优先导入 Netty BOM。三个模块的实际 Maven dependency tree 均只解析到 `4.1.136.Final`，带 Redis profile 的独立服务 JAR 内 17 个 `netty-*.jar` 也全部为该版本。
- 远端 E2E 失败根因不是等待时间，而是干净 checkout 只运行 `build:lib`，没有生成 `@ai-assistant/vue/wc` 指向的 `dist/ai-assistant-wc.mjs`。CI 已改用 `build:publish`，并增加静态契约防止退回不完整构建；本地完整发布构建通过，27 个公开导出可解析，真实后端 Web Component 定向 E2E `1/1`、完整零重试 E2E `32/32` 通过。
- 本轮重新验证：仓库脚本 `98/98`、UI `801/801`、Playground `14/14`、Maven `846/846`，failure/error/skip 均为 `0`；lint 为 `0 error / 17 warning`，Prettier 与 `git diff --check` 通过。远端 E2E/Security CI 仍需以新提交结果作为最终关闭证据。
- 真实浏览器重新检查当前 `0747ed7` 页面：模型菜单在 `1440x900`、`768x1024`、`375x812` 均位于面板内，与快捷工具间距分别约 `10.5/9/9px`；Obsidian/Cobalt/Pulse/Circuit/Ember 的双闪星实际颜色依次为 `#171717/#2457d6/#0891b2/#0f766e/#c2410c`，切回默认 Obsidian 后恢复黑色。
- E2E flaky 修复已完成无重试复验：原三项超时文件以 `--retries=0 --repeat-each=2` 得到 `14/14`，随后完整套件以 `--retries=0` 得到 `32/32` 一次通过（`3.2m`）。配置保留产品断言，只把 expect/整例冷启动预算调为 `10s/45s`，本地 worker 从 5 限为 3、CI 限为 1。
- 当前主工作树 109 份 Surefire XML 按顶层模块重新结构化汇总为 `846/846`：server `827`、Demo `3`、Client `14`、observability support `2`，failure/error/skip 均为 `0`；被忽略的 `.local` 干净 clone 报告未混入计数。
- 最终安全快照 `.local/security-scan-20260723-final` 覆盖当前 `797` 个 Git 可交付文件（约 `16.6 MB`）：固定版本 Trivy `0.72.0` 的 HIGH/CRITICAL、secret、misconfiguration 均为 `0`；OWASP Dependency-Check `12.2.2` 分析 `1734` 个依赖/`404` 个唯一依赖，vulnerable dependency 与 vulnerability 均为 `0`，仅使用 2 条到 `2026-10-22` 到期的精确 Kotlin runtime 误报 suppression。四个 npm 工作区 audit 均为 `0 vulnerabilities`。
- UI ESLint 最新结果为 `0 error / 17 warning` 并正常退出：`MessageList.vue` 仅比 800 行维护阈值多 2 行；`PersonalizeDialog.vue` 的 16 项为可选 prop 未声明 default，调用方已有传值/显式缺省分支。它们不影响构建、运行、类型或核心流程，不构成 P0/P1/P2；作为低风险维护项保留，避免在最终浏览器验收后引入无业务价值的行为改动。
- 主工作树首轮最终 E2E 共 `32` 项，退出码为 0，但 Web Component、runtime provider、prompt history 三项在 5-worker 冷启动首轮分别因 5 秒元素等待或 30 秒整例上限超时，重试后通过；未把该轮记为全绿。失败截图显示目标 UI 随后均已渲染，已将本地 worker 限为 3、expect 调为 10 秒、整例调为 45 秒，断言和 retry 策略不变，进入 `retries=0` 复验。
- 用户截图中的模型下拉排版判定为不合理：旧版桌面与快捷工具重叠约 `22px`，手机重叠约 `44px` 且右侧越界约 `32px`，属于明确可用性缺陷而非主观审美。已在 `99-enterprise-overhaul.css` 将菜单改为 `border-box`、右对齐 `220px` 宽并按响应式高度额外避让 `18px`，同时加入 E2E 与静态几何回归。
- 修复后真实 Chromium 三视口复验通过：`1440x900` 菜单与快捷工具间距约 `10.5px`，`768x1024` 约 `9px`，`375x812` 约 `9px` 且左右边界完整位于面板内；console `0 error / 0 warning`，templates/models 动态请求均为 `200`。证据位于 `.local/acceptance-fe361f8-19015/output/playwright/final-fe361f8/`。
- 最终干净 clone `.local/acceptance-0747ed7-19013` 初始 HEAD 精确为 `0747ed7`、Git 干净，`node_modules/dist/target=0`；被忽略的本地配置仅发布 `19013 -> 8080`，后端只在容器内 `8080`，未启动或修改 MySQL、Redis、Chroma。README `demo-standalone.ps1` 在排除旧本项目 Vite 端口占用后 `66.5s` 通过，zero-key `8/8` 与 standalone `5/5` 全绿。
- 同一干净 clone 中，清除 `NODE_TLS_REJECT_UNAUTHORIZED` 后真实 `@ai-assistant/vue@1.0.1` tarball 安装到全新系统临时项目并解析 ESM/CJS/Web Component/CSS 共 `8` 个公开入口，耗时 `97.5s`，未再出现 TLS 绕过警告。
- Java Client 文档命令 `mvn -f ai-assistant-client/pom.xml verify` 通过：`14/14`，JAR 与 Spotless 全绿；Starter reactor `mvn -pl ai-assistant-demo -am verify` 通过：server `827/827`、Demo `3/3`，覆盖静态页面、health、liveness/readiness、同步 Chat 和 SSE。
- README Starter 一键脚本在空闲端口 `19012` 完成 `npm ci`、Vue/Web Component publish build、Starter JAR 打包与真实启动；首页和 Web Component 页均为 `200`、本地 bundle 生效、远程资源为 false，zero-key health/probes/stats/runtime/provider/chat/SSE `8/8` 通过。验收后只停止该 JAR 进程并确认 `19012` 已关闭，`19013` 独立服务容器保持运行。
- 2026-07-22 续跑确认：Goal 仍为 active，当前 Compose 页面为 `http://127.0.0.1:19014/`；真实 Chromium 快照确认 Obsidian 默认选中、五套主题与助手入口均可见。下一步验证切换主题后 Playground、标题和回复头像三处双闪星同步变色。
- 真实 Chromium 已展开助手面板；标题区、空状态、模式切换、输入框与发送控件完整可见。继续以浏览器计算样式和持久化值验证 Obsidian -> Circuit/Cobalt 的主题联动。
- 已核对主题同步实现：Playground 与组件共享两个 localStorage key 和 `ai-assistant-theme-change` 事件，主题 mark 随 Obsidian/Cobalt/Pulse/Circuit/Ember 变化。进入计算样式与真实 SSE 回复头像验证。
- 一次 Sparkles 源码组合检索因 Windows 引号转义失败，未产生改动；已改为单一字面量检索路线。
- 真实 Chromium 切换到 Circuit 后，`playground-theme` 与 `ai-assistant.theme.palette.v1` 均为 `forest`；Playground CSS 为 `#065f46 -> #2dd4bf`，组件 CSS 为 `#065f46/#0f766e/#2dd4bf`，标题/空状态/FAB Sparkles 计算 stroke 均为 `rgb(15, 118, 110)`。
- Circuit radio 的真实浏览器选中态已确认；输入真实 SSE 验收消息后发送按钮由 disabled 变为可点击，准备发起后端流式请求。
- 当前 `19014` 后端真实 SSE 完成并返回明确 `[DEMO MODE - deterministic local response, not real AI]` 响应，耗时 UI 显示 `0.3s`；回复头像 Sparkles 已出现，标题与头像的实际 stroke 均为 Circuit 的 `rgb(15, 118, 110)`，两个 storage key 保持 `forest`。
- 同一浏览器会话切换 Cobalt 后，两个 storage key 同步为 `sky`，`--ai-brand-mark=#2457d6`；标题、回复头像与 FAB Sparkles 的实际 color/stroke 全部同步为 `rgb(36, 87, 214)` 且 `fill=none`。
- Pulse 主题浏览器联动通过：两个 key 均为兼容值 `plum`，mark=`#0891b2`，标题/头像/FAB 三处 Sparkles stroke 均为 `rgb(8, 145, 178)`。
- Ember 主题浏览器联动通过：两个 key 均为兼容值 `sunset`，mark=`#c2410c`，标题/头像/FAB 三处 Sparkles stroke 均为 `rgb(194, 65, 12)`。
- 切回 Obsidian 后两个 key 均恢复 `graphite`，mark=`#171717`，标题/头像/FAB 三处 Sparkles color/stroke 均恢复 `rgb(23, 23, 23)` 且 `fill=none`；五套主题联动闭环完成。
- 已确认浏览器验收工具可直接设置精确 viewport、保存命名截图、读取 console 与请求明细；接下来产出 `1440x900`、`768x1024`、`375x812` 当前构建证据。
- 当前构建 Obsidian 桌面 `1440x900` 截图 `output/playwright/tech-themes-obsidian-19014-1440x900.png` 已人工检查：默认 Sparkles 近黑，页面/面板主视觉为黑白灰，主题色仅作为可选 accent，未见紫色品牌残留、文字截断或横向溢出。
- Circuit 平板 `768x1024` 截图 `output/playwright/tech-themes-circuit-19014-768x1024.png` 已生成；页面与面板宽度、主题色和导航响应式正常。截图中快捷模板区与末条回复底部视觉距离很近，先以 DOM 几何确认是否真实遮挡，未确认前不记为通过或缺陷。
- 平板布局修复后的真实 SSE 复验通过：`768x1024` 消息可见区域与快捷模板交集为 `0`，间距 `4px`，回复操作栏和 reaction bar 均完整可见；最终截图为 `output/playwright/tech-themes-circuit-19014-768x1024-final.png`。
- 手机 `375x812` Pulse 主题复验通过：`plum/plum` 存储与 `#0891b2` 品牌令牌一致，标题/历史头像/FAB 双闪星同步，面板无横向溢出、可见控件全部至少 `44px`；截图为 `output/playwright/tech-themes-pulse-19014-375x812-recheck.png`。
- 桌面 `1440x900` Obsidian 主题复验通过：`graphite/graphite` 存储、`#171717` 品牌令牌和三处 Sparkles 计算样式一致；面板完整落入视口、无横向溢出或消息/模板遮挡，截图为 `output/playwright/tech-themes-obsidian-19014-1440x900-final.png`。
- 真实 Chromium 三页回归结束：Demo/Admin/Form Auto-Fill 均可进入，控制台 `0 error / 0 warning`，动态接口与真实 SSE 均为 `200`；`theme-current-19014` 会话已关闭。
- 完整 release check 通过：95 个脚本测试、OpenAPI 类型/快照、UI 发布构建、27 个导出、bundle/依赖/CSS 预算全部通过；`!important` 从基线 1787 降到 1776。
- Maven 六模块 `clean verify` 通过，109 份 Surefire 报告汇总为 `846/846`、0 failure/error/skip；UI `801/801`、Playground `14/14`、Playwright E2E `31/31`，UI lint 为 0 error，格式、Playground 和 docs 构建均通过。
- npm 全新临时消费项目成功解析 8 个公开导出；`19014` zero-key `8/8`、standalone `5/5`。最新 Demo benchmark 160/160 成功，health/chat/SSE TTFT p95 为 `16.34/22.90/35.00ms`。
- 四个 npm 工作区 audit 均为 0 vulnerabilities；当前 797 个 Git 可交付文件的固定 digest Trivy 0.72 离线扫描为 `HIGH/CRITICAL=0`、secret=0、misconfiguration=0。OWASP Dependency-Check 12.2.2 使用本地 2026-07-22 数据库、`CVSS >= 9` 和精确 suppression 后 `BUILD SUCCESS`。
- Lighthouse 主题版真实 JSON 已如实同步到 `PERFORMANCE_REPORT.md`：移动两次 Performance `80/84`、Accessibility/Best Practices `100/100`，均带慢 CPU 校准告警；桌面 `99/100/100` 且无运行告警。
- 提交前人工差异复查补掉暗色粒子层最后一处紫色 RGB，并把暗面板背景改为中性黑；主题契约补充遗漏色值后 `5/5`，全源紫色字面量扫描无匹配。
- 暗色残留修复后的 `project-health-check --release-check-full` 重新通过：95 个仓库脚本、OpenAPI、UI 发布构建、27 个导出、bundle、依赖、CSS 和 support boundary 全绿；该轮才作为主题阶段最终自动化证据。
- DOM 几何确认 P2：`.ai-footer-quick-toggles` 与末条助手 bubble 垂直重叠 `22.85px`；根因是末端 CSS 将快捷模板行绝对定位到 footer 上方且不预留布局空间。进入最小样式修复与回归测试。
- 新增布局契约首次因测试闭合符号错误未进入断言；语法已修正，重新获取缺少预留空间的有效红灯。
- 有效 RED：主题/布局契约 `4/5`，仅“快捷模板必须预留响应式布局行”失败。CSS 改为保留绝对悬浮视觉，同时 footer 通过 `--ai-quick-toggle-min-height + 8px` 预留空间并锁定单行；GREEN `5/5`。
- 修复后定向验证：`ChatInputArea.spec.ts` `28/28`、目标 CSS Prettier、脚本 `node --check` 与 `git diff --check` 全部通过；准备重建 `19014` 当前源码容器做真实浏览器复验。
- 当前源码 Compose 重建完成（159.2s）：仅 `ai-assistant`/`web`，两容器 healthy；Web 镜像 `sha256:f648de12...`，后端保持内部 `8080`，宿主仅 `19014 -> 8080`。启动无 error，demo 环境保留预期空 token/CORS 警告。
- 新构建平板几何确认 CSS 生效：footer `margin-top=52px`，消息 viewport `bottom=766.2`，快捷模板 `top=770.2`，可见区域间隔 `4px`，页面横向溢出 `0`。原始 bubble rect 延伸到滚动容器裁剪区外，需用裁剪后矩形和 scroll-bottom 状态复核。
- 修复后平板 scroll 已在底部（距底 `1.2px`），但面板固定 `520px`、消息 viewport 仅 `180px`，截图只露出回复操作栏；继续定位 `useWrapperStyles`/平板断点扩大消息可见区。一次只读检索包含不存在路径，已记录并收窄。
- 随后一次可选测试检索返回码 1 又使并行组丢失输出，未改产品文件；停止并行可选查询，改为逐条读取已确认路径。
- `usePanelGeometry.spec.ts` 路径假设再次失败；已确认实现默认 `PANEL_H=520`，下一步从实际测试文件清单定位覆盖位置。
- 新增纯 geometry 测试有效 RED `0/3`（helper 不存在）；实现平板 `601-820px` 默认高度 `680px`、低视口 `height-80px` clamp 后，geometry/resize/wrapper 定向 `12/12`、主题布局契约 `5/5`、目标 Prettier 与 diff check 均通过。
- 平板高度版 Web 镜像重建为 `sha256:f379c452...`，两容器 healthy、宿主仍仅 `19014`。Compose 因依赖关系同时重建后端 manifest 并重建容器，但 Maven/运行层全缓存且后端镜像创建时间未变；未触碰 shared-infra。

### 用户追加黑色主题统一要求

- 已把“黑色双闪星 + 全局黑白灰科技主题 + 清除紫色品牌残留”纳入完成门槛；现有黑色图标提交不视为完成。
- 初步代码审计确认 Playground 和 UI 历史样式仍存在可见紫色/靛蓝品牌色，下一步从主题变量、Playground 页面层和 Web Component 最终样式层精确收敛，并补测试和真实浏览器证据。
- 当前分支 `agent/v1.0.1-release-candidate` 工作树干净，相对远端 ahead 3 / behind 2；保留全部现有提交，最终以非破坏性整合处理分叉。
- 已定位三层根因：组件默认 `sky`/彩色预设、最终 CSS 的紫色硬编码、Playground 页面自己的紫/青渐变。后续采用统一 ink/graphite 中性色令牌，状态语义色保持独立。
- 已检查历史真实运行图 `entry-desktop.png` 与 `panel-empty-desktop.png`，确认蓝色星形、紫色面板光晕和彩色主题色块均可见；这些截图作为修改前视觉基线。
- 一次递归图片检索误扫入本地干净 clone 的 Git 对象并在 10 秒超时，未修改文件；已收窄为已确认的截图路径，不再重复宽范围递归查询。
- 已读主题核心实现：`00-enterprise-tokens.css`、`09-modern-overhaul.css`、`ColorThemeSwitcher.vue`、`AiAssistant.vue` 和 Playground 主题状态；决定修改源令牌并保留历史主题 ID，而不是增加高优先级补丁层。
- 颜色计数确认最终 CSS 仍有大量可见靛蓝/紫色硬编码；将以确定性颜色映射和静态扫描测试收敛，而不是只更新默认变量。
- 测试检索再次把 `ColorThemeSwitcher*` / `AiAssistant*.spec.ts` 作为 Windows 字面 glob 传给 `rg`，返回路径语法错误且未修改文件；后续只使用已确认目录与 `rg -g`，不再使用字面 glob。
- 新增 `scripts/frontend-ink-theme.test.mjs`，首轮 `0/4` 按预期失败；完成基础令牌、五个中性预设、Playground/Admin 品牌色和字体栈修改后复跑为 `2/4`。
- 当前剩余失败为 `AiAssistant.vue` 的旧默认 fallback 与 Sparkles 仍引用主题变量；全源扫描另发现多个功能弹窗的靛紫 RGB 字面量，下一步统一映射并把静态契约扩大到整个 UI 源目录。
- 已通过 `apply_patch` 对整个 `ai-assistant-ui/src` 清理 311 行紫色字面量，并同步组件/Playground/Admin 源令牌与中性色预设；未增加 `!important`，未改公共事件和业务逻辑。
- `node --test scripts/frontend-ink-theme.test.mjs` 已从 `0/4`、`2/4`、`3/4` 收敛到 `4/4` 全绿；下一步验证格式、组件测试、构建和浏览器视觉。
- 新增 `ColorThemeSwitcher.spec.ts`，验证 5 个中性色 radio、Obsidian 选中态和切换事件；UI 全量为 `102` 个文件、`796/796` 通过。
- UI Prettier 通过，ESLint 0 error（仅 `MessageList.vue` 既有 802 行 warning），`git diff --check` 通过；Playground 组件测试 `13/13` 通过。

### 用户追加星形品牌视觉

- 已核对两张参考图和当前未提交差异：入口已改用 Lucide `Sparkles`，本轮继续将标题栏、空状态和助手消息头像统一为无圆底星形，并保留原布局占位与可点击区域。
- 恢复阶段首次把 `cmd /c` 的 `&&` 交给外层 PowerShell 解析而失败，随后拆成独立命令；另两次把 Windows 不支持的 `*.spec.ts`/`icons*` 字面 glob 传给 `rg`，已改用 `rg -g` 和已确认路径，不再重复这些调用形式。
- 标题栏、空状态和助手消息头像已渲染真实 `AssistantIcon sparkles`；末端样式已禁用旧品牌伪元素，并清除头像的渐变背景、边框、圆角、球状阴影和旧 loading 动画。定向 UI `23/23`、Playground `9/9`、两包定向 Prettier 均通过；定向 ESLint 0 error，仅有 `MessageList.vue` 既有 max-lines warning。
- 全量复验通过：UI `101` 个文件 `795/795`、Playground `2` 个文件 `13/13`、UI Prettier、ESLint 0 error。Vue ESM/CJS、Web Component、类型声明和 `27` 个公共导出构建通过，Playground `5842` 模块生产构建通过；仅保留既有 max-lines 与 Vite 大 chunk warning，均无新增运行错误。
- 首轮 `--release-check-full` 的 90 项脚本测试、OpenAPI、前端构建、包导出、bundle 和依赖边界均通过，但 CSS 强制覆盖预算真实失败：`1787 -> 1815`。未放宽基线；已改为直接把既有紫球/豆形规则替换成星形规则，并从末端新规则移除全部新增 `!important`，等待相同门禁复验。
- 相同 `--release-check-full` 已复验通过：90 项仓库脚本、OpenAPI 类型/快照、发布构建、27 个导出、bundle、依赖足迹、CSS 和 support boundary 全绿；CSS `!important` 从基线 `1787` 降至 `1773`，`style.css` 为 `418.00 kB` / gzip `62.16 kB`，没有放宽任何预算。

### 阶段 6 恢复与未提交差异审计

- 继续既有 Goal；当前分支为 `agent/v1.0.1-release-candidate`，相对 `origin/agent/v1.0.1-release-candidate` 领先 1 个提交。
- 工作树仅剩 7 个已跟踪文件差异，集中在 Redis 自动配置顺序、OpenAPI/前端类型漂移保护和 CI 安全扫描；没有未跟踪文件。
- 审计发现 `ai-assistant-ui/src/utils/api.spec.ts` 的两组回归测试被重复插入，当前差异尚不能提交；先运行定向门禁并去重，再进入干净 clone 验收。
- `planning-with-files-zh` 的 session catch-up 脚本无未同步报告；本轮继续以当前计划的阶段 6 为唯一进行中阶段。
- 定向红灯/绿灯：OpenAPI 类型漂移检查按预期失败；生成器测试 `5/5`、前端 API 测试 `62/62`、Redis 自动配置测试 `16/16` 均通过。已删除两组重复前端测试并修正快照缩进，下一步刷新生成类型后复验漂移门禁。
- 生成类型已刷新并带当前规范化 OpenAPI SHA-256；复验结果：类型漂移通过，生成/刷新脚本 `11/11`、去重后的前端 API `57/57`、Redis 自动配置 `16/16`、`git diff --check` 均通过。首轮 Prettier/Spotless 仅命中本轮两个文件，按锁定工具格式化后关闭。
- CI 安全任务已校准为 Node 22 下审计 UI、Playground、docs、E2E 四个 npm 锁文件，阈值统一为 `high`；新增静态契约锁定 Redis profile 完整制品、固定版本 Trivy、vuln/secret/misconfig scanners 和阻断退出码。
- CI 安全契约 `10/10`、YAML 解析、锁定 Prettier 均通过；在显式清除本机 TLS 绕过变量后，UI、Playground、docs、E2E 四个 `npm audit --audit-level=high` 均报告 `0 vulnerabilities`。
- 跨包 Prettier 误格式化已完全收口：`project-health-check.test.mjs` 当前差异只剩新增安全契约，没有既有行的风格改动；历史干净 Compose 栈来源也已定位到 `.local/clean-clone-*`，最终仍会用新提交重做。
- 首次提交前全量并行组中，文档构建明确通过，但根 Maven `clean verify` 退出 1；当前六模块 JAR 和 109 份 Surefire XML 均存在。为排除 UI `dist` 并发重建竞争，下一轮先结构化检查报告，再单独串行复跑 Maven。
- 109 份 Surefire XML 合计 `846` 项、失败/错误为 `0`；隔离复跑最终定位为 PID `58072` 的旧 `19019` 原生验收进程锁住 service JAR，而非测试失败。该 PID 已按完整命令行确认并终止，Docker 与 shared-infra 保持运行。
- 端口释放后根 Reactor `mvn -B clean verify` 六模块全部 `SUCCESS`，耗时 `03:06`；Starter、observability support、standalone service、Java Client 和 Demo 均从清空 `target` 后完成测试/打包。
- 串行 `project-health-check --release-check-full` 通过：版本 `1.0.1`、仓库脚本、静态 OpenAPI 类型与快照、UI publish build/27 个导出、依赖足迹、CSS `1787 -> 1787`、bundle 预算与 support dependency boundary 全绿；子进程已清除 TLS 绕过变量。
- UI ESLint、Prettier 通过，Vitest `100` 个文件 `794/794`；Playground Vitest `2` 个文件 `13/13`。本轮并行组中的 Playground build 与 VitePress build 也均以 0 退出。
- 真实 Chromium Playwright E2E `31/31` 一次通过（`3.4m`），没有 retry/失败截图/trace；套件重新打包并启动 Starter Demo，覆盖真实租户 Web Component/SSE 与取消、错误、诊断、搜索、模式、会话等交互。
- 最终 secret/misconfig 扫描准备纳入 Git 候选的 `793` 个文件；首次 PowerShell→tar 管道因编码失败，已停止并准备以 cmd 原生管道重建，不会把该失败记录成扫描结论。
- NUL 分隔的 793 文件快照已成功生成/解包；首次 Trivy 合并扫描因 Maven Central `429` FATAL，未生成安全结论。下一步拆分 secret/misconfig 与挂载预热 Maven cache 的 offline vuln 扫描。
- 固定 digest Trivy 在只读挂载预热 Maven 仓库、offline 模式下成功退出 `0`：793 个 Git 候选文件的 HIGH/CRITICAL 漏洞、Secrets 和配置失败项均为 `0`。可下载 checks 缺失时使用镜像内置 checks；`.dockerignore` 误识别提示已记录为工具限制。

### 阶段 5 最终门禁与提交前终审

- 手机 Auto-Fill 真实完成 `13/13` 匹配与填入：文本、数字、日期、下拉、单选、复选和多行文本均正确，两个 scanner 排除字段保持为空；15 秒窗口内撤销后全部恢复，浏览器 warning/error 为 `0`。
- Admin 平板断点修复后的 Playground 全量测试 `13/13`、生产构建和 VitePress 文档构建通过；最终首屏图片已换为本轮真实 SSE 对话截图，并校验为 `1425x891` 的真实 PNG。
- 显式清除本机 `NODE_TLS_REJECT_UNAUTHORIZED` 后，最终 `project-health-check --release-check-full` 通过：仓库脚本 `86/86`、OpenAPI 无漂移、发布构建、27 条包导出、依赖边界、CSS 与 bundle 预算均通过；总 gzip `1235.62 KB`，相对基线 `+1.7%`。
- 当前 789 个源码/配置文件重新生成独立快照；固定 digest 的 Trivy 0.72 报告 `HIGH/CRITICAL=0`、secret `0`、失败配置 `0`。当前服务镜像 `sha256:2450e718...` 与 Web 镜像 `sha256:b60afee6...` 分别复扫，`HIGH/CRITICAL=0`。
- OWASP Dependency-Check 12.2.2 使用 2026-07-22 数据库、`CVSS >= 9` 和精确限时 suppression 再次 `BUILD SUCCESS`；UI、Playground、docs、E2E 四个 npm 工作区均为 `0 vulnerabilities`。
- 最终性能 JSON 已同步到报告：health p95 `13.43ms`、同步 Chat p95 `17.83ms`、SSE TTFT p95 `35.22ms`，160 个样本业务错误为 `0`。
- 差异终审确认 `.local`、`.env`、`node_modules`、`target`、`dist` 和安全报告均被忽略；`git diff --check` 通过，只有本机行尾归一提示，没有 line-ending-only diff。
- 首轮 Trivy 因 Maven Central `429`、默认 Java DB 镜像 EOF 和缓存并发锁未生成结论；按工具建议只读挂载预热 Maven 缓存、固定 GHCR 源并串行复验后取得上述有效结果。浏览器截图工具返回 JPEG 字节但沿用 `.png` 名称，提交前已用 ImageMagick 转为真实 PNG 并检查签名。
- 阶段 5 完成；当前无已知 P0/P1 或核心流程可复现 P2，进入远端提交与干净 clone 验收。

### 阶段 5 OWASP 例外契约收口

- 安全补丁后 Chromium E2E 再次 `31/31` 通过，耗时约 1.7 分钟；真实 Starter Demo 使用 Tomcat `10.1.57`，覆盖租户 Web Component SSE、取消、移动布局、设置、诊断、搜索、模式和会话。
- 最终可见浏览器桌面基线 `1440x900`：`scrollWidth=clientWidth=1440`、越界元素 `0`、可见交互目标无小于 `32px`；导航、状态区、SSE 路径、正文和悬浮球无重叠。截图为 `.local/acceptance/playground-1440-final.png`。
- 桌面页面内 zero-key smoke 真实点击后 6 项全部显示通过；随后打开助手、输入 `final browser acceptance` 并发送，真实 SSE 返回明确 `[DEMO MODE - deterministic local response, not real AI]` 标识、原始输入和真实 Provider 配置提示，UI 显示耗时 `0.1s`。
- 桌面助手约 `481.6x521.6px`，边界 `(295,268)-(776.6,789.6)` 完整位于 `1440x900`；document 横向溢出 `0`，浏览器 warning/error 日志 `0`。对话截图为 `.local/acceptance/playground-1440-chat-final.png`。
- CDP 从页面刷新前游标开始捕获到 10 个完整响应，事件未截断；页面 smoke 对应的 `/health`、Actuator liveness、`/stats`、`/runtime/config`、Provider health 和 `/chat` 全为 HTTP `200`，失败响应 `0`。
- 最终可见浏览器平板基线 `768x1024`：`scrollWidth=clientWidth=768`、越界元素 `0`，首屏 12 个可见交互目标全部至少 `44px`；导航拆为主入口与工具两行，正文、smoke、SSE 路径和悬浮球无重叠。截图为 `.local/acceptance/playground-768-final.png`。
- 平板 Admin 7 个标签均真实切换成功且选中状态正确，每个高 `44px`，document `scrollWidth=clientWidth=768`。截图发现 tablist 自身 `scrollWidth=722/clientWidth=720`，产生 2px 的无必要横向滚动条；功能不阻断，但作为可复现响应式 P2 待最小修复后复验。
- 已把 Admin 非滚动网格断点扩到 `<=820px`：平板四列、手机两列，并新增仓库静态契约。定向脚本 `8/8`、Admin 组件 `4/4`、Playground 默认 Prettier 和 diff check 通过；Web 镜像重建后真实平板 tablist 为四列 `177px`、两行高 `92px`、`scrollWidth=clientWidth=720`，7 个 tab 均为 `44px` 高，滚动条消失。最终截图为 `.local/acceptance/admin-768-final-fixed.png`，该 P2 已关闭。
- 平板 Admin 空 Token 点击 `GET /admin/overview` 后在前端 `0ms` 明确显示失败和“请先在顶部填写 Admin Token”，最近状态为失败，没有伪造成服务成功；截图为 `.local/acceptance/admin-768-auth-guard-final.png`。
- 最终手机 Admin `375x812`：滚动条后 document `clientWidth=scrollWidth=360`、越界元素 `0`；两列 tablist `clientWidth=scrollWidth=328`、列宽 `162px`、7 个标签完整，首屏 23 个可见交互目标全部至少 `44px`。截图为 `.local/acceptance/admin-375-final.png`。
- 手机从 Admin 切回 Assistant 并打开助手成功；`dialog "AI 助手"`、Header 四项动作、三种模式、模型、页面上下文、三项快捷模板、输入区与发送区均在真实浏览器可访问树中，等待几何与发送复验。
- 手机助手几何为 `(0,0)-(375.2,812)`，完整覆盖 `375x812` 视口；document `clientWidth=scrollWidth=375`、面板子元素越界 `0`，19 个可见交互目标全部至少 `44px`。截图为 `.local/acceptance/playground-375-assistant-final.png`。
- 手机输入 `mobile final acceptance` 后真实 SSE 在 UI 显示 `0.1s`，返回明确 Demo 标识、原始输入和真实 Provider 配置提示，发送完成后输入与按钮状态恢复正常。
- 手机消息搜索输入 `mobile` 后显示 `1/2` 并正确高亮用户与助手文本；`.ai-chat-search-input` 为 `209x44px`，两个 `.ai-search-nav` 与设置按钮均为 `44x44px`，document 横向溢出 `0`。截图为 `.local/acceptance/playground-375-search-final.png`。
- 手机搜索框内按 `Ctrl+K` 后只出现 1 个 `命令面板 / Command Palette`，没有重复 Playground 面板；命令搜索输入 `242.4x46px`，15 个 option 均至少 `44px`，面板 `clientWidth=scrollWidth=375`。截图为 `.local/acceptance/playground-375-command-final.png`。
- 命令面板内再次按 `Ctrl+K` 后 Command Palette 数量从 `1` 变为 `0`，助手 dialog 保持 `1`；点击关闭并等待过渡后助手 dialog 也变为 `0`，页面恢复完整导航状态。
- 手机 Auto-Fill 页面在真实浏览器中完整提供 13 个业务字段、两个 scanner 排除字段和 3x3 批量表格；点击中文示例后剪贴板为 13 行，包含姓名与备注，页面明确显示复制成功反馈。
- 一次定向并行检查错误地显式套用 `ai-assistant-ui/.prettierrc` 到根脚本与 Playground 历史文件，导致整文件风格差异并丢失同组测试输出；命令只读未写文件。确认 Playground 的既有口径为锁定 Prettier 默认配置后单独复跑通过，不重复跨包配置。
- 桌面布局首次 evaluate 使用了当前受限浏览器未暴露的裸 `performance` 全局，调用在返回页面结论前失败；改为纯 DOM 几何检查。随后一次失败调用中的变量声明没有持久化，改用明确的 `globalThis` 绑定后成功；两次均未修改页面或源码，不再重复这两种调用方式。
- 清除 `NODE_TLS_REJECT_UNAUTHORIZED` 后，`project-health-check --release-check-full` 再次通过：版本、仓库脚本、OpenAPI、前端发布构建、27 条导出、依赖/CSS/bundle/support 边界全部通过；总 gzip `1235.62 KB`，相对 baseline `+1.7%`，未超预算。
- UI 包在新的系统临时目录安装成功，8 个 ESM/CJS/Web Component/CSS 公开入口全部解析；安装 35 个包，未出现 TLS 绕过警告。
- 使用被忽略的 `.env.local` 从当前工作树重建 `ai-assistant-demo` 两个无状态容器；后端镜像 `sha256:2450e7...`、Web 镜像 `sha256:137f4d...`，后端仅容器内 `8080`，Web 唯一宿主发布 `19014 -> 8080`，没有启动或修改基础设施容器。
- 新容器均 healthy，运行日志确认 Spring Boot `3.5.16`、Tomcat `10.1.57`、显式 `provider=demo`；仅有与本地公开 Demo 配置一致的 CORS/token/SpringDoc 提示，没有启动错误。
- 新运行态 zero-key `8/8`、standalone `5/5` 通过，覆盖 health、liveness/readiness、stats、runtime config、Provider 状态、同步 Chat 和 SSE。
- 160 个请求样本的 Demo contract benchmark 通过：health p95 `13.43ms`、同步 Chat p95 `17.83ms`、SSE TTFT p95 `35.22ms`，均低于 `400/1000/1000ms` 门槛；证据写入 `.local/acceptance/demo-contract-benchmark-final.json`。
- 把仓库健康测试从错误的“零 suppression”口径改为“已复核、精确、限时”口径：要求每个完整条目都有未过期的 `until`，只允许当前 Kotlin runtime 的精确 `packageUrl regex`，禁止宽泛 CPE，并固定两项已说明的 CVE。
- `SECURITY.md` 的本地 OWASP 命令已与 CI 对齐，从仓库根引用 `.github/owasp-suppressions.xml`；同时说明例外必须有理由、精确匹配、限时复核，不能作为 blanket exclusion。
- 定向 Node 测试 `7/7` 通过，两个文件的 `git diff --check` 通过。一次把默认 Prettier 配置用于根目录历史文件只得到整文件风格差异，不作为产品失败；未让该命令写文件。
- 恢复上下文时一组并行只读命令因 `find /v /c` 参数格式错误而丢弃其他输出，随后已拆分为独立只读命令；一次多文件补丁因 hunk 分隔格式错误未应用，拆为两个精确补丁后成功，均未损坏文件。

### 阶段 5 搜索触控回归收口

- 真实浏览器在 `375x812`、消息已出现状态下测得 `.ai-chat-search-input` 为 `342.6x26px`；这不是 Playground 旧包，浏览器匹配规则确认源码末尾 Round 32 的 `26px !important` 覆盖了移动端 `--ai-search-input-height: 44px`。
- 已把紧凑搜索输入和搜索导航的最终高度改为读取既有 `--ai-search-input-height` / `--ai-search-nav-size`，桌面 fallback 仍为 `26px`，移动端为 `44px`，`!important` 数量不增加。
- 已在 `scripts/project-health-check.test.mjs` 增加仓库健康契约，固定移动触控变量必须贯穿最终紧凑规则。Prettier、CSS 预算 `1787 -> 1787`、仓库契约 `12/12`、相关组件 `21/21`、UI 发布构建和 `27` 条导出路径均通过。
- 源码 Playground 真实浏览器复验通过：输入框 `209x44px`；输入查询后上一个、下一个和设置按钮均为 `44x44px`；面板内小目标 `0`、document 横向溢出 `0`、console warning/error `0`。截图为 `.local/acceptance/playground-375-search-touch-final.png`。
- 最终全量 UI 门禁通过：lint、`100` 个 Vitest 文件、`788/788`；Playground `13/13` 和 build、docs build、全新临时目录 npm 包安装 `8` 个入口均通过。
- `project-health-check --release-check-full` 通过：脚本契约 `83/83`、OpenAPI 无漂移、依赖边界与 CSS 预算通过；bundle 总 gzip `1235.62 KB`，相对基线 `+20.19 KB (+1.7%)`，未刷新 baseline。
- 清除 `NODE_TLS_REJECT_UNAUTHORIZED` 后，以 `19010` 启动真实 Starter Demo 并运行 Chromium E2E，`31/31` 通过；覆盖真实 Demo SSE、租户 Web Component、取消、移动适配、设置、诊断、搜索、模式与会话操作。
- 安全扫描首轮未进入扫描：Windows `cmd` 把 OWASP 的 suppression 属性误解析为 Maven phase；Docker Hub 拉取 Trivy `latest` 清单返回 EOF。两者均不是漏洞结果，后续分别改用 PowerShell 直接参数与 GHCR 镜像源，不重复原调用。
- OWASP 第二次已进入数据库更新，但工具等待 20 分钟超时；其 Java 子进程仍正常运行并持续写入本轮数据库，未生成报告前不记通过。Trivy 工具镜像已从 GHCR 固定到 digest `sha256:cffe3f...dd6f`，首次数据库下载又因默认 `mirror.gcr.io` EOF 失败，下一次改为 GHCR 数据库源。
- Trivy 从 GHCR 成功下载当前漏洞库，但 Windows bind mount 下的绝对 `--skip-dirs` 未排除构建缓存，读取约 1.4 GB 后超过等待窗口；已只停止本轮扫描容器，Demo/shared-infra 未动。下一次使用 `**/node_modules`、`**/target`、`**/dist` 跨平台 glob，不重复无效参数。
- Trivy 的 glob 在 Windows bind mount 下仍读取构建缓存；改为从 `git ls-files -co --exclude-standard` 生成 789 文件、约 16 MB 的当前工作树快照，并挂载本机只读 Maven 缓存后，固定 digest 的 Trivy 0.72 对 Maven/npm 与 secrets 扫描退出码为 0，`HIGH/CRITICAL=0`、密钥命中 0。
- OWASP Dependency-Check 12.2.2 使用 2026-07-22 新数据库发现真实红灯：Tomcat 10.1.55 与 Kotlin CPE 映射达到 CVSS 9+，另有可修复的 Jackson/PDFBox/Commons Lang/Log4j/Swagger UI 命中。已确认修复版本和依赖路径，开始最小安全补丁；Kotlin两项只针对 runtime stdlib 的误报将用 90 天精确 suppression 复核，不做宽泛 CVE 屏蔽。
- 首轮补丁依赖树发现 `observability-support` 自己的 Boot BOM 会把 Starter 传入的 `tomcat-embed-el` 压回 10.1.55；已给支持包增加同一 10.1.57 精确管理，避免支持包单独消费时出现 Tomcat 家族版本不一致。
- 第二轮 ODC 已清除 Tomcat/Jackson/PDFBox/Commons Lang/Swagger UI 命中，但暴露 Boot BOM 中另一 Log4j 构件 `log4j-to-slf4j` 仍为 2.24.3，以及同一 Kotlin runtime 的空兼容构件 `kotlin-stdlib-jdk7`。前者补到 2.25.5；后者把既有精确例外扩到同版本 `stdlib/jdk7/jdk8`，到期时间不变。四个 npm 工作区 `audit --audit-level=high` 均为 0 漏洞。
- 第三轮 ODC 已确认 Log4j 全部收敛为 2.25.5，仅继续暴露同一 Kotlin runtime 家族的 `kotlin-stdlib-common@1.9.25`；精确包正则补入 `common`，仍不匹配 Kotlin compiler/Gradle/plugin 等真正受 CVE-2026-53914 影响的构件。
- 最终 ODC 复验通过：Dependency-Check 12.2.2 分析 404 个依赖，active vulnerability 为 0；仅有经说明、精确包版本匹配且 2026-10-22 到期的 Kotlin runtime 两条 suppressed false positive。Tomcat/Jackson/PDFBox/Commons Lang/Log4j/Swagger UI 均已解析到修复版本。
- 安全补丁后根 Reactor `mvn -B clean verify` 六模块全部 `SUCCESS`，耗时 2 分 16 秒；Starter Demo 实际启动为 Apache Tomcat 10.1.57。JaCoCo 为 line `71.29%`、branch `56.05%`，高于 `65%/50%` 门禁；Spotless、Checkstyle 与测试均通过。
- 一次记录补丁误带了只存在于 `progress.md`、不在 `task_plan.md` 的上下文，`apply_patch` 整体未应用；已拆除错误 hunk后重新写入，代码和配置没有受影响。

### 阶段 4 恢复继续

- 桌面真实交互中页面内 zero-key smoke `6/6`、Demo SSE 消息、对话/翻译/摘要模式切换及深度思考开关均通过；Demo 回复明确标记为 deterministic local response，不冒充真实 AI。
- 手工探索发现 `Ctrl+K` 双重命令面板缺陷：助手获得焦点时同时打开助手与 Playground 两个模态。已保存截图并暂停后续通过结论，下一步修复事件作用域、补 Playground 回归测试后重建复验。
- `Ctrl+K` 缺陷已按根因修复：`useCommandPalette` 支持事件作用域守卫，Playground 忽略助手区域事件，打开的命令面板消费快捷键并停止冒泡；两组回归先红后绿，UI `13/13`、Playground `9/9`。
- 重建 Web 容器后的真实浏览器回归通过：助手输入框按 `Ctrl+K` 时命令面板计数为 `1`，面板搜索框内再次按快捷键后计数为 `0`，页面级面板未误开；截至该流程浏览器 console warning/error 均为 `0`。
- Admin Console 无 Token 调用真实显示“请先在顶部填写 Admin Token”，没有静默失败。Form Auto-Fill 真实完成复制、粘贴解析、`13/13` 预览、填入 `13`/失败 `0` 和 15 秒窗口内撤销；撤销后所有目标字段恢复为空，两个排除字段始终未填，console warning/error 仍为 `0`。
- 平板 `768x1024` 真实验收通过：Demo、Admin、Form Auto-Fill 均无横向越界，Demo/Admin 首屏可见交互目标全部至少 `44px`；助手 `482x522` 完整落在视口内，内部可见交互目标也无小于 `44px`。截图保存至 `.local/acceptance/playground-768x1024.png` 与 `playground-chat-768x1024.png`。
- 手机 `375x812` Demo 与助手全屏均无横向滚动；页面与助手可见核心控件全部至少 `44px`，内置模式/快捷动作无旧 emoji。真实 SSE 返回后消息气泡位于 `60.8-340px`，没有内容裁切；命令面板只有一个实例并位于 `(17,97)-(359,712)`。
- 手机命令面板最新 Web 镜像复验通过：搜索 input 从 `20px` 提升为 `46px`，面板单实例，document/面板横向溢出均为 `0`，面板内可见 input/button/option 无小于 `44px`。命令项最右内容边界 `332.8px` 小于 item 右边界 `344.8px`，截图中的右侧文字仅是 Codex 图片预览裁切，不是页面 DOM 裁切。
- 手机 Admin 首轮发现 7 个标签依赖 `722px` 横向滚动条；已改为 `<=700px` 两列网格并增加 `Admin sections` 可访问名称。定向测试 `4/4`、格式检查通过；重建后标签栏 `scrollWidth=clientWidth=328`，7 个标签均为 `162x44px`，逐项真实切换 Overview、Tokens、Prompts、RAG、A/B、Fallback、Plugins 均显示对应控件，console warning/error 为 `0`。
- 手机 Form Auto-Fill 全页 `scrollWidth=clientWidth=360`，无越界或嵌套横向滚动；普通表单、排除字段、3x3 批量表格和操作区完整。原生 radio/checkbox 为 `18px`，但对应可点击 label 均为 `44px` 高；截图已保存到 `.local/acceptance/playground-form-375x812-*.png`，console warning/error 为 `0`。
- Starter 首页手机首轮确认入口链接仅 `21.6px`、三个命令按钮仅 `32.8px`；已统一两个静态页为中性开发者工作台，链接/按钮最小 `44px`、手机按钮单列、卡片圆角 `6px`，并为输入和动态状态补 label/aria-live。HTML 格式检查通过；Starter Reactor 测试为 server `827/827`、Demo `3/3`。
- 真实 Starter 以项目一键脚本在本机 `19010` 重启后，首页与 Web Component 页在 `375x812`、`768x1024`、`1440x900` 均无横向溢出；手机/平板可见交互目标无小于 `44px`。手机同步 Chat 更新 stats，Web Component 同源 SSE 返回明确 Demo 标识；助手手机全屏，平板/桌面均为 `480x520` 且在视口内，console warning/error 为 `0`。
- Starter 与 Web Component 截图保存至 `.local/acceptance/starter-index-*`、`starter-wc-*` 和 `starter-wc-chat-*`；阶段 4 浏览器验收完成，进入阶段 5 全量门禁。
- 使用 `.env.local` 和 `docker-compose.demo.yml` 重建 `ai-assistant-demo`：仅应用与 Web 两个容器，本次新建后均 healthy；宿主只发布 `19014 -> web:8080`，后端保持容器内 `8080`，未启动或修改 Redis/MySQL。
- 新容器运行态 zero-key smoke `8/8` 通过，覆盖健康、liveness/readiness、stats、运行配置、Provider 健康、同步 chat 与真实 SSE；首页响应含 CSP、nosniff、SAMEORIGIN、Referrer/Permissions Policy。
- 真实浏览器 `1440x900` 首轮通过：document `scrollWidth=clientWidth=1440`、横向越界元素 `0`、内置控件旧 emoji `0`，main/article 宽 `1216px`；截图保存至被忽略的 `.local/acceptance/playground-1440x900.png`。
- UI 图标迁移后的最终全量门禁通过：Vitest `100` 个文件、`787/787`；ESLint、Prettier 与 publish build 全部通过，ESM/CJS/Web Component/type declarations 均生成，包导出 `27` 路径检查通过。
- 最新 bundle gate 通过：总 gzip `1235.30 KB`，较当前 baseline 增长 `19.88 KB (+1.6%)`；chunks 增长 `27.76 KB (+4.8%)`，Web Component group 下降 `8.54 KB (-1.5%)`。尚未刷新 baseline，待 Lighthouse 与首屏性能复验后判断。
- 新增集中 `AssistantIcon` 映射并替换模式、快捷工具、四语言空状态、内置命令面板和 Artifact 的可见 emoji；四语言模式标签只保留纯文案，移动端图标按钮继续提供 aria-label/title。
- UI 包新增官方 `@lucide/vue@1.25.0`，锁文件安装审计 0 漏洞；语义图标定向回归先红后绿，最终 6 个文件、43/43 通过。
- UI Prettier 首轮只命中 `useEmptyStateContent.ts`，锁定版本单文件格式化后全量格式检查与 ESLint 均通过；`git diff --check` 无空白错误，仅有既有换行提示。
- 扩大 Unicode 可见图标审计后，将 Header、声音、Code Wall、Artifact 工具栏、重试和会话抽屉纳入第二批迁移；reaction、图片消息前缀与工具调用文本仍保持原协议。
- 第二批内置控件已全部改用集中 Lucide 映射；新增 Artifact Canvas、会话抽屉测试并扩展 Header/Runner/MessageList/问候语断言。会话夹具补齐 200ms debounce 后单测通过。
- 再次同步 active Goal、三份持久记录、工作区差异和阶段 4 范围；没有覆盖或回退既有修改。
- 完成助手可见 emoji 全入口审计，决定统一使用官方 Lucide；reaction 与协议/消息数据保持不变。下一步先补组件测试，再实施图标映射并运行 UI 定向门禁。
- 重新核对完整验收原文、Goal 状态、端到端验收规则、文件化规划规则与当前工作树；Goal 保持 `active/executing`，未覆盖任何既有改动。
- 当前完成标准不变：先关闭自动填表撤销窗口、Playground 视觉与三视口触控缺陷，再重建容器并取得新的真实浏览器证据。
- 自动填表撤销窗口已从 5 秒延长到 15 秒；新增定时器回归证明 5.001 秒仍可撤销、15 秒后自动收起，`useFormAutoFill.spec.ts` 27/27 通过。
- Playground 视觉方案已按真实浏览器缺陷收敛为中性、密集的开发者工作台：1280px 内容上限、无渐变、减少 section 卡片、Lucide 图标、平板导航重排、移动交互目标至少 44px；业务协议和默认端口不变。
- 已落地 Playground/App/Admin 视觉层：官方 `@lucide/vue@1.25.0` 替换可见导航/Admin/复制/命令/外链/加载 emoji，新增 Form Auto-Fill 命令入口，主工作区与两级响应式布局完成；npm 安装审计 0 漏洞，待前端测试、构建和浏览器复验。
- Playground Vitest 2 文件 12/12 通过且 stderr 为空；`npm run build` 通过。构建仅保留 Mermaid/Wardley 两个既有懒加载 chunk 的 500kB 提示，阶段 5 将按项目 bundle/performance 预算复核。
- 助手 375/768 触控令牌与搜索、消息动作、详情、reaction 精确覆盖已落地；`ai-assistant-ui npm run build` 通过，ESM/UMD/Web Component/类型声明均生成，包导出 27 路径检查通过。
- UI 全量门禁通过：Vitest 95 个文件、780/780；ESLint 通过；Prettier `format:check` 通过。
- 当前源码 Compose 镜像重建成功；仅 `ai-assistant` 与 `web` 两个容器运行且 healthy，宿主仅发布 `19014 -> web:8080`，后端保持容器内 `8080`，无 Redis/MySQL 容器。
- 重建后首页 200 且 CSP/nosniff/SAMEORIGIN 等响应头存在；脚本 zero-key 8/8、页面内 smoke 6/6。桌面 1440×900 无溢出并真实打开助手，发现内部模式/快捷动作 emoji 尚需收敛。
- 内部视觉整改范围已限定：reaction 作为用户数据保留；Mode 四语言文案去除 emoji；ChatInputComposer 三个快捷工具使用官方 Lucide 图标。不会改模式值、事件或 i18n key。

### 会话恢复与阶段 3 继续

- 完整重读“全项目统一完成标准”和“1. AI Assistant SDK”原文（第 21-111 行），确认当前计划未遗漏验收类别。
- 读取 `acceptance-orchestrator` 与 `planning-with-files-zh` 规则并恢复 Goal；Goal 保持 `active/executing`。
- 定位 `TracingFilter` 的未规范化调用方追踪字段问题；已记录根因，下一步补回归测试并修复。
- 已严格校验追踪/上下文头并新增 8 个 `TracingFilter` 回归场景；与 Tenant/Request ID 相关测试合计 19/19 通过。
- 首次 Spotless 门禁仅发现新增测试的 3 处换行差异，已按输出精确修正，尚待复验。
- Spotless 复验通过（265 个 Java 文件，0 个需修改）；Checkstyle 完成且 error 级违规为 0。
- CORS、上传、内容过滤、语言代码与既有 LLM 翻译相关测试 41/41 通过；CORS 明确 credentials=false，浏览器可读取 request/trace ID。
- 上传日志已移除原始文件名；空文件、10 MiB 上限、PDF/OOXML 魔数新增回归覆盖。
- 非法语言输入的 DTO/服务/REST/兼容 SSE/标准 SSE/批处理错误契约测试 59/59 通过；一次 WebSocket catch 定位编译错误已修复并复验通过。
- 本轮 Java Spotless 复验通过（267 文件、0 需修改），Checkstyle error 级违规为 0。
- 安全回归组 151/151 通过；最终全量阶段需以 `clean` 清除增量 JaCoCo 数据后重建覆盖率报告。
- Provider 连通性脱敏使用真实本地 HTTP 上游验证，相关配置测试 12/12 通过；原始 Key、上游 secret、endpoint 主机和控制字符均未出现在结果中。
- WebSocket 处理器与握手测试 7/7 通过；非法 JSON/action/targetLang 和成功流均有真实帧级回归。Java Spotless/Checkstyle 复验通过。
- OpenAI-compatible、Demo Provider、健康检查与自动装配契约整组 43/43 通过，覆盖 Bearer 认证、同步/SSE、401、429 与 503；曾有一个 503 契约用例受 Windows 下 Reactor/Netty 冷启动影响超过测试专用 2 秒，隔离复跑确认真实收到 503 后将测试时限调整为 5 秒，生产 60 秒默认值和状态码断言均未降低。
- 三个声明 Spotless 的 Java 模块共 274 个 Java 文件格式门禁通过，server Checkstyle error 级违规为 0。
- 可观测性定向组 31/31 通过：健康指标 4、自动装配 15、追踪边界 8、Micrometer gauge 2、support artifact 2；独立服务已启用 liveness/readiness probes，tracing 与结构化日志保持显式可选。
- 阶段 3 完成；进入 Playground、Starter 页面、Vue 与 Web Component 的真实浏览器三视口验收。
- 通过被忽略的 `.env.local` 以 `demo`、空 Key、宿主 `19014` 重建 `docker-compose.demo.yml`；仅重建应用与 Web 两个容器，内部端口均保持 `8080`，未启动或修改 shared-infra。
- 当前源码镜像构建成功，应用与 Web 容器均为新建且 healthy；零密钥 Compose smoke 9/9 通过，覆盖首页、应用健康、Actuator liveness/readiness、stats、运行配置、Provider 健康、同步聊天和真实 SSE 链路。
- 工具异常：一组 `cmd.exe` 并行只读检索被 Windows 应用控制策略拦截，已记录并切换到直接只读 `rg`。

### 已完成

- 读取并逐行核对“全项目统一完成标准”和“1. AI Assistant SDK”。
- 读取适用执行技能、恢复三份持久化记录、检查 Goal 状态、分支、近期提交和工作树 diff 规模。
- 建立本轮七阶段验收计划；旧记录只作背景，所有验收项将重新产生新证据。

### 当前进行

- 运行 Maven、UI、Playground、文档、脚本与 E2E 基线，先修阻断缺陷。

### 文档审计进展

- 已完整读取 README、README_EN、DEPLOYMENT、SECURITY、PERFORMANCE、PERFORMANCE_REPORT 与风险登记册；CHANGELOG 的发布摘要和 Unreleased 已核对，自动生成历史明细只作背景。
- 已确认 README 的两条接入路径、零密钥边界、环境要求和主演示命令；这些声明将在代码、构建和运行阶段逐项复验。
- 已读取 `docs/CAPABILITY-MATRIX.md`、根 Maven POM 和四个前端/文档 package scripts；确认版本目标为 `1.0.1`，并把 stable/experimental/mock-only/documented-only 声明转为待验收清单。
- 已记录当前 130 个已跟踪文件差异及未跟踪实现/测试的审计范围；没有覆盖或回退任何既有改动。
- 已审计新增 Starter Demo、根 Dockerfile、四套 Compose、零密钥环境示例和 CI 主流程；确认 Demo 使用真实 HTTP/SSE，且本地验收无需重复启动 Redis/MySQL。
- 已识别待验证点：干净环境下 UI 产物到 Starter 的构建顺序、Client/Service/Demo 根 Reactor 测试覆盖、Starter 静态页三视口与可访问性。
- 已审计 Demo/live Provider 分流、Java Client 认证/租户/SSE/错误模型和 Admin runtime config 装配；现有代码有针对性测试，待本轮基线实际执行。
- 已记录默认 Provider 从 `openai` 到 `demo` 的兼容性审查项，后续核对迁移说明和真实 Provider 失败契约。
- 已审计 Vue API、SSE/WS fallback、Web Component 属性别名与租户传递；确认新增协议字段有针对性测试，待前端全量基线执行。
- 已确认 Playground 存在三类可操作视图和真实后端 smoke 状态；视觉、响应式和控制台质量仍待浏览器实测。
- 已审计 E2E 真实/替身边界、Starter 后端启动器、Standalone/Starter 一键脚本和 zero-key smoke；确认真实 Web Component + SSE 用例存在，Starter 干净启动仍需补本轮运行证据。
- 完成阶段 1 审计；本机工具版本符合 README，版本一致性与 diff check 通过，既有 `19014` Demo 栈的 8 项 zero-key smoke 通过（仅作为旧构建基线）。
- 当前工作树首轮基线通过：Java server/client/demo 共 `809` 项测试、Vue 高风险协议 `64` 项、fast release gate `82` 项全部零失败。
- 发现本机 Node 进程环境存在 `NODE_TLS_REJECT_UNAUTHORIZED=0` 警告；已列为环境清理后复验项，不据此得出安全通过结论。
- 完整前端基线首轮在 Prettier gate 失败，唯一命中文件为 `useStreamWithFallback.spec.ts`；尚未把同组 lint/UI test/Playground test 记为通过，先修格式后独立复跑。
- 已用锁定 Prettier 修复唯一格式阻断；复跑 UI lint/format、UI `779` 项、Playground `12` 项全部通过。
- 根 Maven `package` 六模块通过；Vue publish/WC/types 构建和 `27` 条包导出检查通过。
- Playground build、文档 build、全新临时目录 npm 包消费 smoke 均通过；8 个公开消费入口可解析。
- 记录 Playground 大型按需 Mermaid/Wardley chunk 警告，待 full bundle gate 与浏览器性能审计确认。
- 清除不安全 TLS 环境变量后，full release gate 通过；bundle 总 gzip 较 baseline 下降约 0.8%。
- 完整 Playwright `31/31` 通过，包含真实 Starter Demo + Web Component 租户 SSE；阶段 2 完成，进入协议/安全/可观测性专项。

### 已遇到问题

- `create_goal` 检测到同一任务已有 active Goal；已继续原 Goal。
- 长文件组合读取触发输出截断；改为按标题和文件分段读取，未据截断内容下结论。

> **状态：历史归档。** 本文件是历轮优化的进度流水，不再逐次同步。**最新进度以 `git log`
> 与 `CHANGELOG.md` 为准。** 与 `task_plan.md`、`findings.md` 一并视为历史记录；后续如继续
> 演进，优先用 CHANGELOG + 提交信息承载，避免本文件（已 1700+ 行）持续膨胀。

## 2026-04-29

### 已完成

- 确认本地项目路径为 `D:\project-hub\ai-assistant-sdk`。
- 确认项目当前包含 Java 后端、Vue 组件库、文档站、E2E 测试和部署配置。
- 读取了规划技能说明，按文件规划模式创建任务计划、发现记录和进度记录。
- 运行 `node scripts/check-version-consistency.mjs`，版本一致性检查通过。
- 发现 VitePress 侧边栏存在多个缺失页面，确定为第一批低风险优化项。

### 下一步

- 创建 `docs/assistant-optimization-plan.md`。
- 补齐缺失的 VitePress 文档页面。
- 运行最小文档验证。

### 后续更新

- 已创建 `docs/assistant-optimization-plan.md`。
- 已补齐文档站侧边栏缺失页面：
  - `docs/guide/configuration.md`
  - `docs/guide/chat.md`
  - `docs/guide/function-calling.md`
  - `docs/guide/mcp-server.md`
  - `docs/guide/plugins.md`
  - `docs/guide/kubernetes.md`
  - `docs/api/chat.md`
  - `docs/api/capabilities.md`
  - `docs/api/admin.md`
- 第一次运行 `cd docs && npm run build` 通过，但提示 `env` 代码块语言未加载。
- 已将本次新增文档中的 `env` 代码块改为 `text`。
- 第二次运行 `cd docs && npm run build` 通过，输出无高亮语言警告。
- 已新增 `scripts/project-health-check.mjs`，用于串联轻量健康检查。
- 首次验证脚本时，Windows 下直接启动 `npm.cmd` 出现 `EINVAL`，已记录并修复。
- 第二次尝试手工拼接 `cmd.exe /c` 命令时，引号传递异常，已改为 `shell: true`。
- 运行 `node scripts/project-health-check.mjs --docs` 通过，包含版本一致性检查和文档站构建。

### 启动验证

- 已启动文档站：`http://127.0.0.1:5174/`
  - 已在浏览器打开 `http://127.0.0.1:5174/guide/configuration.html`。
  - 页面标题和正文正常，未出现 404。
- 已启动前端 Playground：`http://127.0.0.1:5175/`
  - 页面可打开。
  - AI 助手悬浮球可见。
  - 点击后助手面板可展开。
- 检查到本机 `8080` 端口已被 Sub2API 服务占用，不是本项目后端。
- 已改用 `18080` 端口启动 `ai-assistant-service`：
  - 健康接口 `http://127.0.0.1:18080/ai-assistant/health` 返回 `success: true`。
  - 使用的是占位 API Key，模型连通性检查出现 401，属于预期结果。
- 当前 Playground 的 Vite 代理仍指向 `http://localhost:8080`，所以聊天和模型列表还没有接到 `18080` 的后端。后续如需完整联调，需要临时调整代理到 `18080`，或释放 `8080` 端口。

### README 入口聚焦

- 已在 `README.md` 顶部新增“先看这里”，集中放置快速开始、配置说明、独立服务部署、前端连接、API 文档、上线清单和排障手册入口。
- 已在 `docs/guide/index.md` 增加“从哪里开始”和“文档地图”，帮助用户先选择 Starter 集成、独立服务、前端接入或上线前检查路径。
- 已在 `docs/guide/quick-start.md` 说明快速开始默认面向 Starter 集成，独立服务用户应优先阅读独立服务和前端连接文档。
- 已更新 `docs/assistant-optimization-plan.md`，将 O-002 标记为部分完成，并记录 README 后续仍需逐段迁移精简。
- 已运行 `node scripts/project-health-check.mjs --docs`，版本一致性检查和 VitePress 文档站构建均通过。

### 配置文档分层

- 已重写 `docs/guide/configuration.md`。
- 新文档按最小可用配置、必填与模型连接、安全相关、性能与资源限制、可选能力、导出与文件处理、独立服务环境变量、前端配置和生产配置基线拆分。
- 配置项已对照 `AiAssistantProperties`、独立服务 `application.yml` 和 `.env.example`，避免文档脱离当前实现。
- 已更新 `docs/assistant-optimization-plan.md`，将 O-004 标记为已完成。
- 已运行 `node scripts/project-health-check.mjs --docs`，版本一致性检查和 VitePress 文档站构建均通过。

### 部署路径检查清单

- 已新增 `docs/guide/deployment-checklists.md`。
- 新页面分别提供 Starter 集成和独立服务部署的适用场景、上线前检查项、前端最小配置和排查重点。
- 已在 `docs/.vitepress/config.ts` 的 Deployment 分组加入新页面。
- 已在 `README.md`、`docs/guide/index.md`、`docs/guide/quick-start.md` 和 `docs/guide/standalone-service.md` 中补充部署路径检查清单入口。
- 已更新 `docs/assistant-optimization-plan.md`，将 O-005 标记为已完成。
- 已运行 `node scripts/project-health-check.mjs --docs`，版本一致性检查和 VitePress 文档站构建均通过。

### 前端集成配方

- 已新增 `docs/guide/frontend-recipes.md`。
- 新页面覆盖手动放置组件、自动挂载、同源后端、独立服务、主题语言、快捷 Prompt、Prompt 模板、组件事件、错误监控、代码块 IDE、会话限制、模型选择和 Web Component。
- 已在 `docs/.vitepress/config.ts`、`README.md`、`docs/guide/index.md` 和 `docs/guide/frontend-standalone.md` 中补充入口。
- 已更新 `docs/assistant-optimization-plan.md`，将 O-006 标记为已完成。
- 已运行 `node scripts/project-health-check.mjs --docs`，版本一致性检查和 VitePress 文档站构建均通过。

### 生产上线清单扩充

- 已扩充 `docs/guide/production-checklist.md`。
- 新增和细化鉴权、CORS、短期 Token、SSRF、链接抓取、Headless 抓取、Admin、连接器管理、MCP、RAG、分 action 限流、日志脱敏、运行时配置摘要和 Actuator 暴露边界检查项。
- 已更新 `docs/assistant-optimization-plan.md`，将 O-007 标记为已完成。
- 已运行 `node scripts/project-health-check.mjs --docs`，版本一致性检查和 VitePress 文档站构建均通过。

### 后端架构维护说明

- 已新增 `docs/guide/backend-architecture.md`。
- 新页面说明后端总体分层、包职责、新功能放置建议、Controller 规则、Service 规则、配置和自动装配规则、扩展点规则和维护检查清单。
- 已在 `docs/.vitepress/config.ts`、`README.md` 和 `docs/guide/index.md` 中补充入口。
- 已更新 `docs/assistant-optimization-plan.md`，将 O-008 标记为已完成。
- 已运行 `node scripts/project-health-check.mjs --docs`，版本一致性检查和 VitePress 文档站构建均通过。

### README API 长段落迁移

- 已新增 `docs/api/reference.md`，承接 REST API 参考、请求示例和端点摘要。
- 已在 `docs/.vitepress/config.ts` 和 `docs/api/index.md` 中接入 REST API 参考页。
- 已将 `README.md` 中原有的大段 API 接口细节替换为 API 文档入口和常用 API 摘要。
- 已更新 `docs/assistant-optimization-plan.md`，补充 O-002 的本轮进展和剩余风险。
- 已运行 `node scripts/project-health-check.mjs --docs`，版本一致性检查和 VitePress 文档站构建均通过。

### 收尾审查

- 已运行 `git diff --check`，未发现空白错误。
- 已最终再次运行 `node scripts/project-health-check.mjs --docs`，版本一致性检查和 VitePress 文档站构建均通过。
- `docs/.vitepress/cache/` 是文档构建生成缓存，不应提交。
- 本轮未创建 git commit 或 push；原因是提交前必须获得用户显式确认。

---

## 2026-05-13 第二轮：AI 助手进化功能

用户接续 5-12 上轮的「10 项进化功能」要求继续推进，最初列出 11 项候选（A1-A4/B5-B8/C9-C11）。
经审计发现 B5/B6/C11/A4 输入端/usePluginRegistry/useKnowledgeBase 已存在，真实缺口 6 项 + 1 项测试补全。

### 已落地

#### A1：多模型并行对话
- 新增 `useMultiModelChat.ts` composable：N 列独立 AbortController + rAF 节流刷新
- 新增 `MultiModelCompare.vue` 覆盖面板：网格布局，1-4 列自适应，每列含模型名/spinner/计时/停止按钮
- 集成入 `AiAssistant.vue`：默认选当前模型 + 第二个候选；通过 `/compare` 斜杠命令打开
- 补全 4×i18n（zh/en/ja/ko）共 8 个文案键
- 构建产物：`MultiModelCompare-iXYz2UAg.js` 10.41 KB（gzip 2.47 KB）

#### A4：TTS 文本转语音
- 新增 `useTextToSpeech.ts` composable：SpeechSynthesis API + 自动语言检测（CJK/ja/ko/en）
- 朗读前剥离 Markdown 与代码块，避免逐字念出语法字符
- `MessageContextMenu.vue` 新增「朗读 / 停止朗读」菜单项（自动检测浏览器支持）
- 同条消息重复点击切换播放/停止，切换到其它条自动取消上一条

#### B7：Prompt 模板管理 UI
- 新增 `usePromptTemplateLibrary.ts` composable：LocalStorage 持久化用户模板，与 options 预置模板合并展示
- 新增 `PromptTemplateDialog.vue`：左侧列表 + 右侧编辑器（名称/模板/变量定义/填写表单/预览/动作）
- 通过 `/template` 斜杠命令打开；点「使用」后渲染后的文本写入主输入框
- 渲染函数 `renderPromptTemplate({{var}})` 已 export 供宿主复用
- 构建产物：`PromptTemplateDialog-K3Cj1K13.js` 15.40 KB（gzip 3.02 KB）

#### B8：代码块 Mermaid + 行号
- `useAiMarkdownRenderer.ts` 新增 `extractMermaidBlocks`：把 ```mermaid 围栏替换成 `<div class="ai-mermaid-placeholder">` 占位符
- 新增 `useMermaidRenderer.ts`：动态 `import('mermaid')`（可选 peer）→ 调 mermaid.render 把占位符替换为 SVG；未安装时降级显示源码
- 在 `vite.config.ts` 把 `mermaid` 标记为 external，避免 build 时 resolve 失败
- 行号通过 CSS counter 实现（`.ai-code-wrap.ai-code-lineno`），逻辑行 ≥ 2 时启用，单行片段不挂行号
- 整套 CSS 新增 `08-late-additions.css` 末尾约 100 行（亮色 + 暗色双适配）

#### C10：性能优化基础设施
- 新增 `useMessageVirtualScroll.ts` 纯算法 composable（不直接操作 DOM，可在 jsdom 单测）
- 索引窗口 + 高度测量缓存 + overscan + 自动失活（消息数 ≤ 60 时降级全量渲染，与现有 `MAX_RENDERED_MESSAGES = 60` 一致）
- 本轮**不强制接入** MessageList：作为 opt-in 工具暴露给宿主，避免破坏现有 UI 行为；后续可由专项 PR 接入

#### A2：RAG 后端架构对齐
- 审计 `ai-assistant-server` 发现 RAG 端点是 `POST /admin/rag/ingest`（管理员端点，全局共享知识库）
- 前端 `useKnowledgeBase` 当前 LocalStorage + ragPromptFragment 模式是**用户级私有知识库**语义，与后端 admin RAG 不是同一概念
- 本轮**不对接**，避免把"用户私有"误连到"全局共享"。详细决策见 `findings.md`「A2 RAG 决策」段

#### A3：MCP 客户端 composable
- 新增 `useMcpClient.ts`：HTTP JSON-RPC 客户端，可连任何兼容 MCP server（默认指向自家 `/ai-assistant/mcp`）
- 提供 `initialize` / `listTools` / `callTool` / `reset`，错误抛 `McpRpcError`
- 支持自定义 `fetchImpl`（SSR / 测试可注入）、`timeoutMs`、`token`（双头注入 `Authorization: Bearer` + `X-AI-Token`）
- 本轮**不强制接入** AiAssistant：作为独立工具暴露，宿主可通过 `usePluginRegistry` 把 MCP tool 注册成按钮

#### C9：测试补全
- 新增 5 个 `.spec.ts`：A1/A4/B7/C10/A3 共 41 个新测试
- 总测试数 155 → 195，全部通过

### 验证

- `npm run build:lib`：✅ 通过（产物 `ai-assistant.mjs` 542 → 564 KB，gzip 124 → 130 KB；其它都是独立 chunk）
- `npm test`：✅ 195/195 全通过
- `ReadLints` 对所有新增文件：✅ 无 lint 错误
- 现有 5 个预先存在的 vue-tsc 类型错误（`plugins.value` / `slashCommands undefined` / `useVoiceInput`）**与本轮无关**，未处理

### 新增文件清单

```
ai-assistant-ui/src/composables/
├── useMultiModelChat.ts            (A1)
├── useMultiModelChat.spec.ts       (A1)
├── useTextToSpeech.ts              (A4)
├── useTextToSpeech.spec.ts         (A4)
├── usePromptTemplateLibrary.ts     (B7)
├── usePromptTemplateLibrary.spec.ts(B7)
├── useMermaidRenderer.ts           (B8)
├── useMessageVirtualScroll.ts      (C10)
├── useMessageVirtualScroll.spec.ts (C10)
├── useMcpClient.ts                 (A3)
└── useMcpClient.spec.ts            (A3)

ai-assistant-ui/src/components/
├── MultiModelCompare.vue           (A1)
└── PromptTemplateDialog.vue        (B7)
```

### 修改文件清单

```
ai-assistant-ui/
├── src/components/AiAssistant.vue          # 接入 A1/A4/B7/B8 + 2 个斜杠命令
├── src/components/MessageContextMenu.vue   # 新增 TTS 朗读按钮
├── src/composables/useAiMarkdownRenderer.ts# Mermaid 占位符抽取 + 行号支持
├── src/components/styles/08-late-additions.css # Mermaid + 行号 CSS
├── src/utils/i18n/{types,zh,en,ja,ko}.ts   # 17 个新 i18n 键
├── src/index.ts                            # export 新 composable + 类型
└── vite.config.ts                          # mermaid 标记为 external
```

### 跳过 / 不做的项

- **A2 后端 RAG 真对接**：架构语义不匹配，详见 findings.md。
- **A4 BBTSU 朗读 / 暂停**：composable 已实现 pause/resume，但 UI 只暴露播放/停止两态；后续如需可补「暂停」按钮。
- **B8 PlantUML**：仅做了 Mermaid；PlantUML 需要后端渲染或单独 client，未做。
- **B8 「运行代码片段」**：浏览器侧运行 JavaScript/CSS 片段是另一个独立工程（沙箱、CSP 等），未做。
- **C10 真接入 MessageList**：composable 已就绪，但实际接入会大改 MessageList 的渲染逻辑，留作专项 PR。
- **C10 Markdown Worker 化**：与 hljs 的动态语言加载冲突较大，性价比低，未做。
- **B5/B6/C11**：现状已完整或基本完整，未做新增（详见审计表格）。

### 第二轮收尾（2026-05-13 后段）

用户在第二轮主体提交后追加 4 步指令：「检查代码 / 修复问题 / 推送远程 / 继续扩展」，继续推进：

| 阶段 | 任务 | 状态 |
|------|------|------|
| 收尾.1 | 全量 TS / Lint / build / test 检查 | ✅ 完成 |
| 收尾.2 | 修真实可修问题 | ✅ TS 错误 4 → 0；Lint 错误 4 → 1（pre-existing） |
| 收尾.3 | git commit + push 远程 main | ✅ commit `44eea04` 推送成功 |
| 收尾.4.1 | useMcpAutoPlugin：MCP tools 自动注册为 plugin | ✅ +8 测试，commit `21ff602` |
| 收尾.4.2 | useMermaidRenderer.spec.ts（B8 测试补全） | ✅ +5 测试 |
| 收尾.4.3 | TTS pause/resume 按钮（A4 增强） | ✅ MessageContextMenu + 4×i18n |
| 收尾.4.4 | fetchPromptTemplates（B7 服务端模板拉取） | ✅ +5 测试 |
| 收尾.4.5 | C10 真接入 MessageList 虚拟滚动 | ⚠ 跳过 |

#### useMcpAutoPlugin（A3 进阶接入）

- 新增 `useMcpAutoPlugin.ts` composable：把 `useMcpClient.listTools()` 的结果一键注册成 `usePluginRegistry` 中的按钮
- 默认前缀 `mcp:`、默认 position `context`（右键菜单），可覆盖
- 默认 buildArgs 用当前输入框文本作为 `input` 字段；默认 onToolResult 把 text content 作为助手消息追加；默认 onError 走 console.error，全部可覆盖
- 重新 sync 时自动 unregister 上次注册的所有按钮，避免堆积；提供 `dispose()` 用于组件卸载
- 8 个单元测试覆盖：默认前缀 / 自定义 prefix+position / 重 sync 清理 / 默认结果 / 自定义 buildArgs+onToolResult / isError 路径 / listTools 失败 / dispose

#### useMermaidRenderer.spec.ts（B8 测试补全）

- 5 个单元测试：成功渲染 / `data-mermaid-rendered=true` 标记 / 已渲染条目默认跳过 / `force` 重渲染 / 无 placeholder 安全空操作 / null root 安全空操作 / render 抛错时 fallback 显示源码 + 错误信息
- 为支持测试通过，把 `useMermaidRenderer.ts` 中的 `import('mermaid')` 改为 `const MERMAID_PKG = 'mermaid'; import(MERMAID_PKG)`，避免 Vite/Vitest 在 transform 阶段尝试静态解析 mermaid

#### TTS pause/resume（A4 增强）

- `MessageContextMenu.vue` 在「朗读 / 停止」按钮旁新增「暂停 / 继续」按钮（仅 ttsActive 时显示）
- 新增 prop `ttsPaused: boolean` 和事件 `ttsPauseToggle`
- `AiAssistant.vue` 新增 `ttsPauseToggle()` 函数：根据 `tts.paused.value` 调用 `tts.pause()` 或 `tts.resume()`
- i18n 4 语言新增 `ttsPause` / `ttsResume` 共 8 个新键

#### fetchPromptTemplates（B7 服务端模板拉取）

- `utils/api.ts` 新增 `fetchPromptTemplates(baseUrl, token)` + `PromptTemplateEntry` / `PromptTemplatesListResult` 类型
- 标准化处理后端 `GET /templates` 的扁平数组返回（即使端点不存在或返回 400/503，安静地降级为空数组）
- `AiAssistant.vue` `onMounted` 拉取一次；用户每次通过 `/template` 斜杠命令打开模板 dialog 也刷新一次
- 服务端模板以 `server:` 为 id 前缀，与 `options.promptTemplates` 合并到 `presetTemplates` 中，在 dialog 中以「预置」徽章展示（只读）
- 5 个 spec.ts 单测：扁平数组解析 / X-AI-Token 头注入 / 非 2xx 错误 / 非数组响应 / 跳过 malformed 条目 / 网络错误

#### C10 真接入跳过的理由

- `useMessageVirtualScroll` 已作为独立 composable + 7 个单测落地
- 真接入需要：a) `.ai-body` 上挂 scroll listener；b) ResizeObserver 测量每条消息真实高度；c) 渲染顶/底 spacer；d) 处理 `MAX_RENDERED_MESSAGES = 60` 折叠（`hiddenOlderCount` banner）与虚拟窗口的优先级冲突
- 当前 `MAX_RENDERED_MESSAGES = 60` 机制已为长会话提供了基础缓解；真虚拟滚动应作为独立 PR，单独评估对现有 UX 契约的影响
- 本轮把 composable 暴露在公开 API 中，宿主可在自有组件中调用尝试

### 第二轮收尾最终验证

- `npm run build:lib`: ✅ 通过；主 bundle gzip 130.07 → 130.10 KB（几乎无新增）
- `npm test`: ✅ **213/213** 通过（从 195 增加 18 个新测试）
- `npx vue-tsc --noEmit`: ✅ 0 errors
- `npm run lint`: ✅ 0 errors（剩 1 个 pre-existing ConnectionDiagnostics warning，未动）

## 2026-05-13 第三轮：UX 现代化（v2 科技蓝 + 第三波交互精修）

用户反馈紫粉（v1）"娘们唧唧"，要求改色 + 继续推 UX 27 项清单的第三波。

### 主题色 v2：sky tech blue

- 主色梯度从 indigo/purple/pink (`#818cf8/#c084fc/#f472b6`) → sky/cyan/blue (`#0ea5e9/#06b6d4/#3b82f6`)
- `09-modern-overhaul.css` 全文 hex + rgb 替换（72 行差异）+ 暗色模式同步用 sky-400 系
- `ai-assistant-vue-playground/src/main.ts`: `primaryColor` 同步换色
- commit `26649af` 已 push

### UX 第三波（commit 待定）

| # | 项 | 实现 |
|---|----|------|
| #2 | 模式按钮胶囊化 | `09` 高 specificity 重写 `.ai-mode-bar/.ai-quick-actions button` → 圆角 999px + 玻璃 + active 渐变填充 |
| #6 | 顶栏图标统一玻璃风格 | `09` 统一为 28px 玻璃方块；隐藏 personalize/diagnostics 文字标签；hover 上浮 + 渐变 |
| #12 | 滚动到底部按钮样式 | 业务逻辑已存在（`showScrollToBottomBtn` + `scrollToBottomClick`）；本轮补玻璃质感圆形 floating 样式 |
| #14 | 链接预览卡片化 | `.ai-md a[href]` chip 样式：内联玻璃徽章 + 🔗 前缀图标 + hover 上浮，无需 JS |
| #18 | 图片附件点击放大 | `panelRef` 事件委托：监听 `img.click` → 创建 `.ai-image-lightbox-overlay` 全屏覆盖（DOM 直挂 body 摆脱 z-index）；Esc/点击/×关闭；CSS hover 微缩放 |
| #20 | 响应式 < 600px 全屏 | media query：panel 强制 100vw/100vh + 圆角归零 + 隐藏 resize handle + 标题字号下调 |
| #27 | 暗色一键切换 | `AssistantHeader.vue` 加 theme-toggle 按钮（太阳/月亮 icon 自动切换）；`AiAssistant.vue` 加 `userThemeOverride` ref + `toggleManualTheme()`，覆盖 `options.theme`，持久化 `localStorage["ai-assistant-user-theme-override"]` |

### 主动跳过

- **#19 统一 Settings 抽屉**：refactor 涉及 PersonalizeDialog + ConnectionDiagnostics 合并，工作量较大；当前两个独立入口在新 `#6 顶栏统一` 后已无视觉混乱，推迟到独立 PR

### i18n 新增（×4 语言共 12 键）

- `themeToggleToDark` / `themeToggleToLight` / `imageLightboxClose`

### 第三轮验证

- `npm run build`: ✅ 通过；`style.css` 134.44 → 141.96 KB（+5.6%），主 bundle 576.00 → 581.26 KB（+0.9%）
- `npm test`: ✅ **213/213** 通过（无新增测试，本轮主要 CSS + UI）
- `npm run build:types` (vue-tsc): ✅ 0 errors
- `npm run lint`: ✅ 0 new errors（pre-existing 1 error + 2 warnings 未动）

## 2026-05-13 第四轮：UX 第四波 + Server feature + Tooling

用户从 `继续推进` → `都修` → `开始 自行演进小助手的优化` → 三轮持续放权
让助理自主推进。本会话共完成 17 个 commit，按主题分四簇：

### Cluster 1: UX 第四波 5 项顺眼调整 (commit `efea80b`)

| # | 改动 |
|---|---|
| #A1 | 思考过程默认折叠为 inline 小药丸（22px 高），点击展开成全宽面板 |
| #A2 | 用户胶囊缩到 78% 宽 + 推右；铅笔编辑仅 hover 显示 |
| #A3 | 模式按钮从输入框上方移到 model-row 内，紧凑分段控件 |
| #A4 | 助手头像加 "AI" 字样（loading 时变成 ...） |
| #A5 | starter 点击填入输入框时去掉 emoji 前缀（emoji 仅作图标） |

### Cluster 2: Server-side 新功能与代码整理（commits `9f3567f` `2ce2d4d` `671c523`）

| Commit | 内容 |
|---|---|
| `9f3567f` | AdminAuthFilter 守卫 `/admin/**` 路径，X-Admin-Token + X-AI-Token 回退，常量时间 MessageDigest.isEqual 防时序攻击 |
| `2ce2d4d` | ChatRequest 新增 pageContext (≤20KB) + sessionId 字段；LlmService chat/chatStream 7 参重载透传 pageContext；Controller 错误前缀化（[QUOTA_EXCEEDED] / [RATE_LIMITED] / [TIMEOUT] / [VALIDATION_ERROR] / [LLM_ERROR]） |
| `671c523` | 31 个 server java 文件应用 google-java-format，纯格式化无功能影响 |

### Cluster 3: 体验闭环 D 系列（commits `f5e5b04` `a68f102` `61f0c5a` `b36b260` `e8f9bcc` + lint cleanup `7fa9a87`）

| ID | Commit | 价值 |
|---|---|---|
| D4 | `f5e5b04` | 页面上下文 UI 徽章（footer 显示已附 N 块 + 一键开关），闭环 server-side pageContext feature |
| D5 | `a68f102` | 流式 progress chip（chars + elapsed），1Hz tick + tabular-nums 防抖 |
| D2 | `61f0c5a` | Settings 齿轮按钮聚合 personalize + diagnostics 入口 + popover 菜单 |
| D1 | `b36b260` | ResizeObserver 真实测量消息高度，给 useMessageVirtualScroll 提供精准 spacer |
| D3 | `e8f9bcc` | adminApi.ts SDK 包装 15 个 admin endpoints + 14 个新单测；不写 admin UI 而是给宿主提供 type-safe client |

### Cluster 4: 工具感增强 + 工程化护栏 E/F/G 系列

| ID | Commit | 价值 |
|---|---|---|
| E1 | `35801ab` | KeyboardShortcutsDialog.vue + Ctrl+/ 触发，3 组 17 行快捷键，平台自适应 ⌘/Ctrl，真实键帽样式 |
| E2 | `c726a07` | TTFT (Time To First Token) 加到 D5 progress chip：`首字 1.2s · 234 字 · 3.5s` |
| E3 | `bbece20` | scripts/generate-changelog.mjs 解析 178 conventional commits 自动分类，GitHub commit 链接，按日期组织 |
| F2 | `102cbd8` | scripts/bundle-size-check.mjs + baseline JSON：24 文件 size 监控 + gzip 计算 + colored diff + --max-delta-percent 阈值告警 |
| F5 | `b909cfd` | scripts/release.mjs 一键发版：version bump + 5 个文件同步 + CHANGELOG + git tag |
| F4 | `7ec9691` | 代码块语言 chip + 长代码（≥20 行）折叠按钮 + 渐变遮罩 |
| F3 | `539ccf5` | active search match 跳转 ring pulse 动画（:has() + prefers-reduced-motion） |
| G6 | (下一 commit) | CI ci.yml frontend job 加 bundle-size-check 步骤，超 +10% gzip 阻塞 PR |

### 本会话验证

| 指标 | 起点 | 终点 |
|---|---|---|
| 单元测试 | 213/213 | **227/227** (+14 admin specs) |
| vue-tsc | 0 错 | 0 错 |
| ESLint | 1 err + 2 warn (pre-existing) | **0 / 0** |
| bundle gzip | 未监控 | **316.46 KB / 24 files** (baseline 已建) |
| CHANGELOG | 无 | **700+ 行 / 14 days** 自动生成 |

### 核心交付清单

新增工具脚本（4 个）：
- `scripts/generate-changelog.mjs`
- `scripts/bundle-size-check.mjs`
- `scripts/.bundle-size-baseline.json`
- `scripts/release.mjs`

新增前端模块（2 个）：
- `ai-assistant-ui/src/utils/adminApi.ts` + `.spec.ts`
- `ai-assistant-ui/src/components/KeyboardShortcutsDialog.vue`

新增 server feature（1 个）：
- `ai-assistant-server/.../config/AdminAuthFilter.java`

更新文件：
- `CHANGELOG.md` 由 generate-changelog.mjs 全量生成
- `09-modern-overhaul.css` 累计 +~500 行（UX 第四波 + D4/D5/D2/E1/F4/F3 各类徽章/分段控件/折叠/动画样式）
- 4 语言 i18n 共新增 ~30 个键

### 关键判断记录

1. **D1 增强而非重做**：发现 C10 其实已在 `8f5b3ef` 接入，剩余工作是 ResizeObserver 测量精度
2. **D2 走 MVP 而非完整 drawer 重构**：齿轮 + popover 30min 达成视觉简化，避免 4-6h dialog 提取
3. **D3 改为 SDK 而非独立 UI**：admin endpoints 比 UI 普适，宿主可在任何运维系统复用
4. **D5 用 chars/s 而非 tokens/s**：前端不知道 tokenizer，chars 更直观
5. **F3 发现已完整 + 仅补 visual polish**：搜索系统完整，新增的 ring pulse 仅作视觉强化
6. **server 35 文件分 3 个 commit (A 真功能 / B 新文件 / C 格式化)**：替别人 commit 但保留清晰边界，便于将来 bisect

### 后续可继续方向（部分已在第五轮落地）

- ~~G1 历史会话抽屉~~ → 已落地 commit `104b4ba`
- ~~G3 a11y 全面审计 + 修补~~ → 已落地 commit `683eca5` (H2 MVP)
- ~~G5 playground 加 admin dashboard 示例~~ → 已落地 commit `6d4cdeb`
- ~~F5 真实发版打 tag~~ → 已落地 commit `9d41d6f` (H3 v1.0.1)
- G2 PWA service worker + manifest（离线缓存）→ 留待 H1

## 2026-05-13 第五轮：会话治理 + 搜索强化 + a11y 兜底 + 真实发版

承接第四轮"自行演进"，用户继续放权 → 推进 G/H 两簇 8 个 commit。本轮
聚焦于把前几轮基础设施（D3 admin SDK / F2 bundle / E3 changelog / F5
release）真正闭环、落地，并补 a11y 兜底。

### Cluster G: 工程化护栏与文档（commits `9b5445f` `6d4cdeb` `104b4ba`）

| ID | Commit | 价值 |
|---|---|---|
| G6 | `9b5445f` | CI ci.yml frontend job 加 bundle-size-check 步骤，超 +10% gzip 阻塞 PR |
| G4 | `9b5445f` (合一) | progress.md 追加第四轮 17 commit 完整总结 |
| G5 | `6d4cdeb` | playground 加 AdminDemoPanel.vue：5 endpoints 一键试调、token input、JSON pretty + 耗时统计；同时更新 bundle-size baseline |
| G1 | `104b4ba` | SessionsDrawer.vue：齿轮菜单新增"All sessions"入口，按时间桶分组（今/昨/本周/更早），filter 搜索，hover-only 删除 |

### Cluster H: 体验深化 + 真实发版（commits `9d41d6f` `9fe087d` `b800a53` `683eca5`）

| ID | Commit | 价值 |
|---|---|---|
| H3 | `9d41d6f` | **首次真实跑通 release.mjs**：1.0.0 → v1.0.1，3 pom + package.json + lock + CHANGELOG 全自动同步，tag 已 push origin。publish.yml 仅在 GitHub Release 网页发布触发，所以 push tag 不会自动发 npm/docker，安全 |
| H5 | `9fe087d` | SessionEntry 加 pinned，useMultiSession 新增 renameSession / togglePinSession；SessionsDrawer item 重构为 main + actions 组（pin ★ / rename ✎ / delete ×），inline rename input + Enter 提交 + Esc 取消；Pinned 分组永远置顶 |
| H6 | `b800a53` | useSessionSearch 新增 buildSearchRegex 工具 + 3 toggle ref (caseSensitive / wholeWord / regex)；highlightSearchInHtml 加可选 options 参数（向后兼容）；搜索框旁加 Aa / W / .* 三个 toggle 按钮 |
| H2 | `683eca5` | 全局 `:focus-visible` 科技蓝 ring + `:focus:not(:focus-visible)` 抑制鼠标焦点；全局 `@media (prefers-reduced-motion)` 强压动画/过渡到 0.01ms；SessionsDrawer aria-label 补漏 |

### 第五轮验证

| 指标 | 第四轮起点 | 第五轮终点 |
|---|---|---|
| 版本 | 1.0.0-SNAPSHOT | **v1.0.1** (tag 已推 origin) |
| 单元测试 | 227/227 | 227/227（H6 改 useSessionSearch 内部逻辑但向后兼容 spec 全过） |
| ESLint | 0/0 | 0/0 |
| WCAG 2.4.7 Focus Visible | 部分 | ✅ 全覆盖 |
| WCAG 2.3.3 Reduced Motion | ❌ | ✅ |
| 会话管理能力 | tabs only | tabs + 抽屉 + 时间分组 + 收藏 + 重命名 + 内容搜索 |
| 搜索能力 | substring | + caseSensitive / wholeWord / regex |
| Settings 入口 | personalize + diagnostics + sessions（独立按钮 3 个）| 单齿轮 + popover 3 项菜单 |

### 关键判断（第五轮）

1. **G6 CI 集成最小化**：复用 ci.yml frontend job，append 一步而不是新建独立 workflow（避免重复 install / build）
2. **G5 AdminDemoPanel 独立组件**：playground 主入口保持简洁；demo 折叠默认收起，不污染 AI 助手 demo 主线
3. **H3 安全跑真发版**：审计了 publish.yml 的 trigger（`release: published`），确认 push tag 不会触发 npm publish / docker build；release.mjs 设计上不自动 push，由用户显式 `git push --follow-tags`
4. **H5 inline edit + 公共 hover actions**：弃用 prompt() 原生 dialog；rename / pin / delete 三按钮 hover-only 显示，避免常驻干扰
5. **H6 公共工具复用**：buildSearchRegex 同时被 searchMatchedIndices 和 highlightSearchInHtml 调用，保证两端 regex 完全一致，杜绝"匹配到但没高亮"或反之的逻辑漂移
6. **H2 :focus-visible 不是 :focus**：键盘聚焦才显示 ring，鼠标点击不污染视觉，符合现代 a11y 最佳实践；prefers-reduced-motion 整段压扁是一行配置但覆盖所有 30+ 处动画

### 累计 24 commit（D + E + F + G + H 簇）

完整时间线见 git log；CHANGELOG.md 已由 E3 generate-changelog.mjs 自动维护。

---

## 2026-05-20 第六轮：深度分析后的按序整改

### 本轮启动

用户要求对 `D:\project-hub\ai-assistant-sdk` 深度分析后“按顺序全部”开始整改。

已确认顺序：
1. 继续拆分 `AiAssistant.vue`，先抽批量导出编排。
2. 统一 `/stream` 与 `/sse` 的协议定位。
3. 增加生产安全基线检查或启动告警。
4. 梳理 `@ai-assistant/vue` 公共 API 分层。

### 当前阶段 13.1

状态：已完成。

目标：
- 检查后发现批量导出主体已经由 `useExportActions.ts` 承接。
- 当前阶段调整为：在不改变用户行为的前提下，把 `AiAssistant.vue` 中剩余的批量选择/删除状态与方法迁移到 `useMessageSelection.ts`。
- 补充聚焦单测，验证选择模式切换、索引选择、降序删除和无效索引处理。

约束：
- 本轮不自动执行 npm build/test、Maven 构建或 git commit。
- 如需执行静态检查命令，会先征得用户确认。

### 阶段 13.1 结果

新增：
- `ai-assistant-ui/src/composables/useMessageSelection.ts`
- `ai-assistant-ui/src/composables/useMessageSelection.spec.ts`

修改：
- `ai-assistant-ui/src/components/AiAssistant.vue`
- `task_plan.md`
- `findings.md`
- `progress.md`

验证：
- `ReadLints` 对新增 composable、spec、`AiAssistant.vue` 和规划文件无诊断。
- 经用户允许运行 `npm test -- useMessageSelection.spec.ts`。
- 结果：1 个测试文件通过，4 个测试通过。

### 当前阶段 13.2

状态：已完成。

目标：
- 梳理 `/stream` 与 `/sse` 的真实使用关系。
- 明确兼容主通道和标准 SSE 通道边界。
- 优先通过文档或小范围代码复用减少后续分叉风险。

### 阶段 13.2 结果

修改：
- `ai-assistant-server/src/main/java/com/aiassistant/controller/AiAssistantController.java`
- `ai-assistant-server/src/main/java/com/aiassistant/controller/SseStreamController.java`
- `docs/api/chat.md`
- `docs/api/reference.md`
- `docs/guide/architecture.md`
- `docs/guide/sequence-diagrams.md`
- `README.md`
- `ai-assistant-service/README.md`

结论：
- `/stream` 定位为兼容流式端点，是官方 UI、Java Client 和 E2E 当前默认入口。
- `/sse` 定位为标准化 SSE 端点，提供 `event: message` / `event: done` / `event: error`。
- 本阶段不改运行逻辑，降低回归风险。

验证：
- `ReadLints` 对相关 Java/Markdown 文件无诊断。

### 当前阶段 13.3

状态：已完成。

目标：
- 增加生产安全基线检查脚本或等价护栏。
- 优先覆盖空 token、宽 CORS、query token、SSRF 关闭、高风险能力开启等危险配置。

### 阶段 13.3 结果

新增：
- `scripts/production-config-lint.mjs`
- `scripts/production-config-lint.test.mjs`

修改：
- `scripts/project-health-check.mjs`
- `docs/guide/production-checklist.md`
- `task_plan.md`
- `progress.md`

验证：
- `ReadLints` 对相关文件无诊断。
- `node --test scripts/production-config-lint.test.mjs`：5 个测试全部通过。
- `node scripts/production-config-lint.mjs --strict --file docker-compose.prod.yml`：无问题。

### 当前阶段 13.4

状态：已完成。

目标：
- 梳理 `@ai-assistant/vue` 公共导出面。
- 先通过文档和注释分层稳定 API / 可选高级能力 / 实验性工具，不删除现有导出。

### 阶段 13.4 结果

修改：
- `docs/guide/frontend-recipes.md`
- `ai-assistant-ui/src/index.ts`
- `task_plan.md`
- `progress.md`

结论：
- 将公共导出分为主接入层、后端 API helper、管理与扩展层、UI 工具层、低层算法/实验层。
- 在 `index.ts` 导出区增加维护提示，约束后续内部 refactor 不默认 re-export。
- 未删除任何现有导出，保持下游兼容。

验证：
- `ReadLints` 对相关文件无诊断。

### 当前阶段 13.5

状态：已完成。

目标：
- 固化 Helm / Kubernetes 生产基线。
- 将访问令牌、Admin 令牌和运行时配置加密密钥纳入 Helm Secret 注入。
- 补齐 Kubernetes 文档里的 Secret、CORS、rate limit、Redis/session/memory 和 Actuator 说明。

### 阶段 13.5 当前结果

修改：
- `helm/ai-assistant/values.yaml`
- `helm/ai-assistant/templates/secret.yaml`
- `helm/ai-assistant/templates/deployment.yaml`
- `docs/guide/kubernetes.md`
- `docs/guide/production-checklist.md`
- `docs/guide/deployment-checklists.md`
- `ai-assistant-service/README.md`
- `scripts/production-config-lint.mjs`
- `scripts/production-config-lint.test.mjs`
- `task_plan.md`
- `progress.md`

验证：
- `ReadLints` 对相关 Helm / Markdown / Node 文件无诊断。
- `helm template ai-assistant ./helm/ai-assistant ...` 未执行成功：当前机器未安装 `helm`。
- `node scripts/project-health-check.mjs --prod-config --strict` 未通过：本地 `.env` 使用空访问 token 和宽 CORS，触发 high-severity。
- `node --test scripts/production-config-lint.test.mjs`：6/6 通过。
- `node scripts/production-config-lint.mjs --strict --file docker-compose.prod.yml`：通过。
- `node scripts/production-config-lint.mjs --strict --file helm/ai-assistant/values.yaml`：0 high-severity，仅模板占位 WARN。
- `mvn package`：通过。
- `npm run build`（`ai-assistant-ui`）：通过。

### 当前阶段 13.6

状态：已完成。

目标：
- 继续拆分 `AiAssistant.vue`。
- 将 Compare regions 编排迁移到独立 composable。
- 保持 `CompareRegionsDialog.vue` 展示和多模型 `/compare` 面板行为不变。

修改：
- 新增 `ai-assistant-ui/src/composables/useCompareRegions.ts`
- 新增 `ai-assistant-ui/src/composables/useCompareRegions.spec.ts`
- 修改 `ai-assistant-ui/src/components/AiAssistant.vue`
- 修改 `ai-assistant-ui/REFACTORING_PLAN.md`
- 修改 `task_plan.md`
- 修改 `progress.md`

验证：
- RED：`npm test -- useCompareRegions.spec.ts` 首次失败，原因是缺少 `useCompareRegions` 模块。
- GREEN：`npm test -- useCompareRegions.spec.ts` 通过，5/5。
- `ReadLints` 对 `useCompareRegions.ts`、spec 和 `AiAssistant.vue` 无诊断。
- `npm run build:types`：通过。

### 当前阶段 13.7

状态：已完成。

目标：
- 继续拆分 `AiAssistant.vue`。
- 将 KB drop / KB picker 编排迁移到独立 composable。
- 保持 `useFabDropIngest` 的拖拽事件边界不变。

修改：
- 新增 `ai-assistant-ui/src/composables/useKnowledgeDrop.ts`
- 新增 `ai-assistant-ui/src/composables/useKnowledgeDrop.spec.ts`
- 修改 `ai-assistant-ui/src/components/AiAssistant.vue`
- 修改 `ai-assistant-ui/REFACTORING_PLAN.md`
- 修改 `task_plan.md`
- 修改 `progress.md`

验证：
- RED：`npm test -- useKnowledgeDrop.spec.ts` 首次失败，原因是缺少 `useKnowledgeDrop` 模块。
- GREEN：`npm test -- useKnowledgeDrop.spec.ts` 通过，6/6。
- `ReadLints` 对 `useKnowledgeDrop.ts`、spec 和 `AiAssistant.vue` 无诊断。
- `npm run build:types`：通过。

### 当前阶段 13.8

状态：已完成。

目标：
- 继续拆分连接诊断状态。
- 将纯状态/文案映射迁移到独立 composable。
- 保持网络请求和配置保存流程不变。

修改：
- 新增 `ai-assistant-ui/src/composables/useConnectionDiagnosticsState.ts`
- 新增 `ai-assistant-ui/src/composables/useConnectionDiagnosticsState.spec.ts`
- 修改 `ai-assistant-ui/src/composables/useAssistantDiagnostics.ts`
- 修改 `ai-assistant-ui/REFACTORING_PLAN.md`
- 修改 `task_plan.md`
- 修改 `progress.md`

验证：
- RED：`npm test -- useConnectionDiagnosticsState.spec.ts` 首次失败，原因是缺少 `useConnectionDiagnosticsState` 模块。
- GREEN：`npm test -- useConnectionDiagnosticsState.spec.ts` 通过，5/5。
- `ReadLints` 对 `useConnectionDiagnosticsState.ts`、spec 和 `useAssistantDiagnostics.ts` 无诊断。
- `npm run build:types`：通过。

### 当前阶段 13.9

状态：已完成。

目标：
- 强化协议契约测试。
- 先补齐 `/sse` 标准化事件类型的后端契约。

修改：
- `ai-assistant-server/src/test/java/com/aiassistant/controller/SseStreamControllerTest.java`
- `task_plan.md`
- `progress.md`

验证：
- 首次运行 `mvn -pl ai-assistant-server -Dtest=SseStreamControllerTest test` 失败，原因是 Mockito 无法区分 `chatStream` 的 `String` 与 `List<String>` 重载。
- 已用 `any(List.class)` 明确匹配 `/sse` 实际调用的 imageDataList 重载。
- 重跑 `mvn -pl ai-assistant-server -Dtest=SseStreamControllerTest test`：4 个测试通过，0 失败。
- `ReadLints` 对 `SseStreamControllerTest.java` 无诊断。

### 当前阶段 13.10

状态：已完成。

目标：
- 评估依赖分层。
- 用文档明确默认依赖、optional 依赖和宿主 opt-in 能力。

修改：
- 新增 `docs/guide/dependency-footprint.md`
- 修改 `docs/.vitepress/config.ts`
- 修改 `docs/guide/index.md`
- 修改 `task_plan.md`
- 修改 `progress.md`

验证：
- `ReadLints` 对新增文档、VitePress 配置和计划文件无诊断。
- `node scripts/project-health-check.mjs --docs`：版本一致性检查通过，VitePress 文档站构建通过。

### 当前阶段 13.11

状态：已完成。

目标：
- 继续拆分 `useAssistantDiagnostics.ts`。
- 将连接配置输入和 localStorage 持久化状态迁移到独立 composable。

修改：
- 新增 `ai-assistant-ui/src/composables/useConnectionConfigState.ts`
- 新增 `ai-assistant-ui/src/composables/useConnectionConfigState.spec.ts`
- 修改 `ai-assistant-ui/src/composables/useAssistantDiagnostics.ts`
- 修改 `task_plan.md`
- 修改 `progress.md`

验证：
- RED：`npm test -- useConnectionConfigState.spec.ts` 首次失败，原因是缺少 `useConnectionConfigState` 模块。
- GREEN：`npm test -- useConnectionConfigState.spec.ts` 通过，6/6。
- `ReadLints` 对 `useConnectionConfigState.ts`、spec 和 `useAssistantDiagnostics.ts` 无诊断。
- `npm run build:types`：通过。

### 当前阶段 13.12

状态：已完成。

目标：
- 继续拆分 `useAssistantDiagnostics.ts`。
- 将 runtime provider 表单状态迁移到独立 composable。

修改：
- 新增 `ai-assistant-ui/src/composables/useRuntimeProviderConfigState.ts`
- 新增 `ai-assistant-ui/src/composables/useRuntimeProviderConfigState.spec.ts`
- 修改 `ai-assistant-ui/src/composables/useAssistantDiagnostics.ts`
- 修改 `task_plan.md`
- 修改 `progress.md`

验证：
- RED：`npm test -- useRuntimeProviderConfigState.spec.ts` 首次失败，原因是缺少 `useRuntimeProviderConfigState` 模块。
- GREEN：`npm test -- useRuntimeProviderConfigState.spec.ts` 通过，5/5。
- `ReadLints` 对 `useRuntimeProviderConfigState.ts`、spec 和 `useAssistantDiagnostics.ts` 无诊断。
- `npm run build:types`：通过。

### 当前阶段 13.13

状态：已完成。

目标：
- 强化 Java Client `/stream` 协议契约测试。

修改：
- `ai-assistant-client/src/test/java/com/aiassistant/client/AiAssistantClientTest.java`
- `task_plan.md`
- `progress.md`

验证：
- `mvn -pl ai-assistant-client -Dtest=AiAssistantClientTest test`：12 个测试通过，0 失败。

### 当前阶段 13.14

状态：已完成。

目标：
- 强化服务端兼容 `/stream` 协议契约测试。

修改：
- `ai-assistant-server/src/test/java/com/aiassistant/controller/AiAssistantControllerTest.java`
- `task_plan.md`
- `progress.md`

验证：
- `mvn -pl ai-assistant-server -Dtest=AiAssistantControllerTest test`：17 个测试通过，0 失败。

### 当前阶段 13.15

状态：已完成。

目标：
- 强化 runtime config 后端契约测试。

修改：
- 新增 `ai-assistant-server/src/test/java/com/aiassistant/controller/RuntimeModelConfigControllerTest.java`
- `task_plan.md`
- `progress.md`

验证：
- 第一次命令 `mvn -pl ai-assistant-server -Dtest=RuntimeConfigControllerTest,RuntimeModelConfigControllerTest test` 被 PowerShell 逗号解析拦截，未进入 Maven。
- 重跑 `mvn -pl ai-assistant-server "-Dtest=RuntimeConfigControllerTest,RuntimeModelConfigControllerTest" test`：5 个测试通过，0 失败。

### 当前阶段 13.16

状态：已完成。

目标：
- 按深度分析建议的第 1 项，处理工作区大量行尾噪音。
- 不做全仓 CRLF/LF 重写，只提供只读检测工具和使用说明。

修改：
- 新增 `scripts/line-ending-noise-check.mjs`
- 新增 `scripts/line-ending-noise-check.test.mjs`
- 修改 `scripts/project-health-check.mjs`
- 修改 `docs/guide/git-hooks.md`
- 修改 `task_plan.md`
- 修改 `findings.md`
- 修改 `progress.md`

验证：
- `node --test scripts/line-ending-noise-check.test.mjs`：5/5 通过。
- `node scripts/line-ending-noise-check.mjs`：识别 2 个真实内容 diff 和 88 个 line-ending-only diff。
- `node scripts/project-health-check.mjs --line-endings`：通过。
- `ReadLints` 对相关脚本和文档无诊断。

### 当前阶段 13.17

状态：已完成。

目标：
- 按深度分析建议的第 2 项，把 OpenAPI 前端类型同步检查纳入 CI。
- 先做轻量 guard，不启动后端服务、不运行 live codegen。

修改：
- 新增 `scripts/openapi-type-sync-guard.mjs`
- 新增 `scripts/openapi-type-sync-guard.test.mjs`
- 修改 `.github/workflows/ci.yml`
- 修改 `docs/guide/openapi-typescript-codegen.md`
- 修改 `task_plan.md`
- 修改 `findings.md`
- 修改 `progress.md`

验证：
- `node --test scripts/openapi-type-sync-guard.test.mjs`：4/4 通过。
- `node scripts/openapi-type-sync-guard.mjs --file ai-assistant-server/src/main/java/com/aiassistant/model/ChatRequest.java`：按预期失败，提示需要同步 `api-generated.d.ts`。
- `node scripts/openapi-type-sync-guard.mjs --file ai-assistant-server/src/main/java/com/aiassistant/model/ChatRequest.java --file ai-assistant-ui/src/types/api-generated.d.ts`：通过。
- `node --test scripts/*.test.mjs`：18/18 通过。
- `ReadLints` 对相关脚本、CI 和文档无诊断。

### 当前阶段 13.18

状态：已完成。

目标：
- 继续拆分诊断相关前端逻辑。
- 把诊断复制文本和剪贴板状态迁移到独立 composable。

修改：
- 新增 `ai-assistant-ui/src/composables/useDiagnosticsClipboard.ts`
- 新增 `ai-assistant-ui/src/composables/useDiagnosticsClipboard.spec.ts`
- 修改 `ai-assistant-ui/src/composables/useAssistantDiagnostics.ts`
- 修改 `ai-assistant-ui/src/components/AiAssistant.vue`
- 修改 `ai-assistant-ui/REFACTORING_PLAN.md`
- 修改 `task_plan.md`
- 修改 `findings.md`
- 修改 `progress.md`

验证：
- RED：`npm test -- useDiagnosticsClipboard.spec.ts` 首次失败，原因是缺少 `useDiagnosticsClipboard` 模块。
- GREEN：`npm test -- useDiagnosticsClipboard.spec.ts`：3 个测试通过。
- `npm test -- useDiagnosticsClipboard.spec.ts ConnectionDiagnostics.spec.ts`：2 个测试文件、5 个测试通过。
- `ReadLints` 对相关新文件和修改文件无诊断。

### 当前阶段 13.19

状态：已完成。

目标：
- 规划 Starter feature artifact 拆分路线。
- 本阶段只写文档，不移动依赖或模块。

修改：
- `docs/guide/dependency-footprint.md`
- `task_plan.md`
- `findings.md`
- `progress.md`

验证：
- `ReadLints` 对 `docs/guide/dependency-footprint.md` 和规划记录无诊断。

### 当前阶段 13.20

状态：已完成。

目标：
- 收窄 `@ai-assistant/vue` 主入口公共 API 面。
- 不删除现有导出，只补推荐导入路径和后续导出规则。

修改：
- `docs/guide/frontend-recipes.md`
- `ai-assistant-ui/src/index.ts`
- `task_plan.md`
- `findings.md`
- `progress.md`

验证：
- `npm test -- packageExports.spec.ts`：1/1 通过。
- `ReadLints` 对相关文档和 `index.ts` 无诊断。

### 当前阶段 13.21

状态：已完成。

目标：
- 推进 OpenAPI 契约闭环的低风险子步骤。
- 让生成类型脚本支持本地静态 OpenAPI JSON 输入。

修改：
- `scripts/generate-frontend-types.mjs`
- `scripts/generate-frontend-types.test.mjs`
- `docs/guide/openapi-typescript-codegen.md`
- `task_plan.md`
- `findings.md`
- `progress.md`

验证：
- RED：`node --test scripts/generate-frontend-types.test.mjs` 首次失败，原因是缺少 `loadSpecText` export。
- GREEN：`node --test scripts/generate-frontend-types.test.mjs`：3 个测试通过。
- `ReadLints` 对相关脚本和文档无诊断。

### 当前阶段 13.22

状态：已完成。

目标：
- 生成静态 OpenAPI 快照。
- 扩大前端 `api-generated.d.ts` 覆盖面。

修改：
- 新增 `docs/api/openapi.json`
- 新增 `ai-assistant-ui/.prettierignore`
- 修改 `ai-assistant-ui/src/types/api-generated.d.ts`
- 修改 `ai-assistant-ui/src/utils/api.ts`
- 修改 `.github/workflows/ci.yml`
- 修改 `docs/guide/openapi-typescript-codegen.md`

验证：
- `node scripts/generate-frontend-types.mjs --spec-file docs/api/openapi.json --check`：通过。
- `npm test -- api.spec.ts`：2 个测试文件、53 个测试通过。

### 当前阶段 13.23

状态：已完成。

目标：
- 拆分 `useAssistantDiagnostics.ts` 网络请求编排。

修改：
- 新增 `ai-assistant-ui/src/composables/useDiagnosticsModelRequests.ts`
- 新增 `ai-assistant-ui/src/composables/useDiagnosticsModelRequests.spec.ts`
- 修改 `ai-assistant-ui/src/composables/useAssistantDiagnostics.ts`
- 修改 `ai-assistant-ui/REFACTORING_PLAN.md`

验证：
- RED：`npm test -- useDiagnosticsModelRequests.spec.ts` 首次失败，原因是缺少模块。
- GREEN：`npm test -- useDiagnosticsModelRequests.spec.ts useDiagnosticsClipboard.spec.ts ConnectionDiagnostics.spec.ts api.spec.ts`：5 个测试文件、60 个测试通过。

### 当前阶段 13.24

状态：已完成。

目标：
- 建立 Starter 依赖足迹护栏。

修改：
- 新增 `scripts/dependency-footprint-check.mjs`
- 新增 `scripts/dependency-footprint-check.test.mjs`
- 修改 `scripts/project-health-check.mjs`
- 修改 `.github/workflows/ci.yml`

验证：
- `node --test scripts/dependency-footprint-check.test.mjs`：3/3 通过。
- `node scripts/dependency-footprint-check.mjs`：无问题。

### 当前阶段 13.25

状态：已完成。

目标：
- 补前端包体归因报告。

修改：
- 新增 `scripts/bundle-composition-report.mjs`
- 新增 `scripts/bundle-composition-report.test.mjs`
- 修改 `scripts/project-health-check.mjs`
- 修改 `docs/guide/dependency-footprint.md`

验证：
- `node --test scripts/bundle-composition-report.test.mjs`：2/2 通过。
- `node scripts/project-health-check.mjs --dependency-footprint --bundle-composition`：通过。
- `node scripts/project-health-check.mjs --release-check`：通过。
- `node --test scripts/*.test.mjs`：25/25 通过。
- `npm run build`（`ai-assistant-ui`）：通过，Package export check OK（27 paths）。
- `ReadLints` 对相关脚本、CI、文档和前端文件无诊断。

### 当前阶段 13.26

状态：已完成。

目标：
- 提供兼容性的前端瘦身入口。
- 不删除主入口历史导出。

修改：
- 新增 `ai-assistant-ui/src/entries/core.ts`
- 修改 `ai-assistant-ui/package.json`
- 修改 `ai-assistant-ui/vite.config.ts`
- 修改 `ai-assistant-ui/src/packageExports.spec.ts`
- 修改 `docs/guide/frontend-recipes.md`

验证：
- `npm test -- packageExports.spec.ts`：通过。
- `npm run build`：产出 `core.mjs` / `core.umd.cjs`，Package export check OK（27 paths）。

### 当前阶段 13.27

状态：已完成。

目标：
- 让 `@ai-assistant/vue/core` 真正绕开主入口高级导出面。

修改：
- 新增 `ai-assistant-ui/src/core-plugin.ts`
- 修改 `ai-assistant-ui/src/entries/core.ts`
- 修改 `task_plan.md`
- 修改 `findings.md`
- 修改 `progress.md`

验证：
- `npm test -- packageExports.spec.ts`：通过。
- `npm run build`：通过；`core.mjs` / `core.umd.cjs` 正常产出，Package export check OK（27 paths）。

### 当前阶段 13.28

状态：已完成。

目标：
- 迁移 Admin API 常用 DTO 到 generated schema。

修改：
- `docs/api/openapi.json`
- `ai-assistant-ui/src/types/api-generated.d.ts`
- `ai-assistant-ui/src/utils/adminApi.ts`
- `task_plan.md`
- `findings.md`
- `progress.md`

验证：
- `node scripts/generate-frontend-types.mjs --spec-file docs/api/openapi.json --check`：通过。
- `npm test -- adminApi.spec.ts api.spec.ts`：2 个测试文件、53 个测试通过。
- `ReadLints` 对相关 OpenAPI、generated types 和 Admin SDK 文件无诊断。

### 当前阶段 13.29

状态：已完成。

目标：
- 补 core-only starter 自动装配验证路径。

修改：
- `ai-assistant-server/src/test/java/com/aiassistant/autoconfigure/AiAssistantAutoConfigurationTest.java`
- `task_plan.md`
- `progress.md`

验证：
- `mvn -pl ai-assistant-server "-Dtest=AiAssistantAutoConfigurationTest" test`：10 个测试通过，0 失败。

### 当前阶段 13.30

状态：已完成。

目标：
- 为 v2 主入口高级导出迁移增加 deprecation 提示。

修改：
- `ai-assistant-ui/src/index.ts`
- `task_plan.md`
- `progress.md`

验证：
- `npm test -- packageExports.spec.ts`：通过。
- `ReadLints` 对 `src/index.ts` 无诊断。

### 当前阶段 13.31

状态：已完成。

目标：
- 新增 v2 migration guide。

修改：
- 新增 `docs/guide/v2-migration.md`
- 修改 `docs/.vitepress/config.ts`
- 修改 `task_plan.md`
- 修改 `progress.md`

验证：
- `npm run build`（`docs`）：通过。

### 当前阶段 13.39

状态：已完成。

目标：
- 完成 observability module skeleton、quick prompt 小切口、release-check dry-run 和 bundle baseline 刷新。

修改：
- 修改 root `pom.xml`
- 新增 `ai-assistant-observability-support/pom.xml`
- 新增 `ai-assistant-ui/src/composables/useQuickPromptOptions.ts`
- 新增 `ai-assistant-ui/src/composables/useQuickPromptOptions.spec.ts`
- 修改 `ai-assistant-ui/src/components/AiAssistant.vue`
- 修改 `scripts/project-health-check.mjs`
- 修改 `scripts/.bundle-size-baseline.json`
- 修改 `task_plan.md`
- 修改 `findings.md`
- 修改 `progress.md`

验证：
- `node scripts/bundle-size-check.mjs --update-baseline`：完成，写入 111 个文件 baseline。
- `ReadLints` 对新增文档和 VitePress 配置无诊断。

### 当前阶段 13.32

状态：已完成。

目标：
- 补齐 `adminApi.ts` 公开 Admin endpoints 的 OpenAPI path-level snapshot。
- 让 Admin SDK 的 request/response 类型从 generated paths 派生。

修改：
- 新增 `scripts/openapi-admin-paths.test.mjs`
- 修改 `docs/api/openapi.json`
- 修改 `ai-assistant-ui/src/types/api-generated.d.ts`
- 修改 `ai-assistant-ui/src/utils/adminApi.ts`
- 修改 `task_plan.md`
- 修改 `findings.md`
- 修改 `progress.md`

验证：
- `node --test scripts/openapi-admin-paths.test.mjs`：2 个测试通过。
- `node --test scripts/*.test.mjs`：27 个测试通过。
- `node scripts/generate-frontend-types.mjs --spec-file docs/api/openapi.json --check`：通过。
- `npm test -- adminApi.spec.ts api.spec.ts`：2 个测试文件、53 个测试通过。
- `npx vue-tsc --noEmit`：通过。

### 当前阶段 13.33

状态：已完成。

目标：
- 继续补齐非 Admin REST endpoints 的 OpenAPI path-level snapshot。
- 让静态快照覆盖主要公开能力面，减少后续新增 generated types 的阻力。

修改：
- 新增 `scripts/openapi-public-paths.test.mjs`
- 修改 `docs/api/openapi.json`
- 修改 `ai-assistant-ui/src/types/api-generated.d.ts`
- 修改 `task_plan.md`
- 修改 `findings.md`
- 修改 `progress.md`

验证：
- `node --test scripts/openapi-public-paths.test.mjs scripts/openapi-admin-paths.test.mjs`：4 个测试通过。
- `node --test scripts/*.test.mjs`：29 个测试通过。
- `node scripts/generate-frontend-types.mjs --spec-file docs/api/openapi.json --check`：通过。
- `npx vue-tsc --noEmit`：通过。

### 当前阶段 13.34

状态：已完成。

目标：
- 让 `ai-assistant-ui/src/utils/api.ts` 的关键 helper 类型从 generated paths 派生。
- 给 path-level 类型迁移增加脚本级类型契约测试。

修改：
- 新增 `scripts/frontend-api-path-types.test.mjs`
- 修改 `docs/api/openapi.json`
- 修改 `ai-assistant-ui/src/types/api-generated.d.ts`
- 修改 `ai-assistant-ui/src/utils/api.ts`
- 修改 `task_plan.md`
- 修改 `findings.md`
- 修改 `progress.md`

验证：
- `node --test scripts/frontend-api-path-types.test.mjs`：通过。
- `node --test scripts/*.test.mjs`：30 个测试通过。
- `npm test -- api.spec.ts`：2 个测试文件、53 个测试通过。
- `node scripts/generate-frontend-types.mjs --spec-file docs/api/openapi.json --check`：通过。
- `npx vue-tsc --noEmit`：通过。

### 当前阶段 13.35

状态：已完成。

目标：
- 扩展 OpenAPI type sync guard 的后端契约覆盖范围。
- 要求契约变更时同步提交静态 OpenAPI snapshot 与 generated frontend types。

修改：
- 修改 `scripts/openapi-type-sync-guard.mjs`
- 修改 `scripts/openapi-type-sync-guard.test.mjs`
- 修改 `task_plan.md`
- 修改 `findings.md`
- 修改 `progress.md`

验证：
- `node --test scripts/openapi-type-sync-guard.test.mjs`：5 个测试通过。

### 当前阶段 13.36

状态：已完成。

目标：
- 更新 OpenAPI codegen 文档到当前实现状态。

修改：
- 修改 `docs/guide/openapi-typescript-codegen.md`
- 修改 `task_plan.md`
- 修改 `findings.md`
- 修改 `progress.md`

验证：
- `npm run build`（`docs`）：通过。

### 当前阶段 13.37

状态：已完成。

目标：
- 推进 release-time OpenAPI refresh、schema 收紧、Observability/OpenAPI support 验证和主组件瘦身切口。

修改：
- 新增 `scripts/refresh-openapi-snapshot.mjs`
- 新增 `scripts/refresh-openapi-snapshot.test.mjs`
- 修改 `docs/api/openapi.json`
- 修改 `ai-assistant-ui/src/types/api-generated.d.ts`
- 修改 `ai-assistant-server/src/test/java/com/aiassistant/autoconfigure/AiAssistantAutoConfigurationTest.java`
- 新增 `ai-assistant-ui/src/composables/useServerPromptTemplates.ts`
- 新增 `ai-assistant-ui/src/composables/useServerPromptTemplates.spec.ts`
- 修改 `ai-assistant-ui/src/components/AiAssistant.vue`
- 修改 `docs/guide/openapi-typescript-codegen.md`
- 修改 `task_plan.md`
- 修改 `findings.md`
- 修改 `progress.md`

验证：
- `node --test scripts/refresh-openapi-snapshot.test.mjs`：3 个测试通过。
- `mvn -pl ai-assistant-server "-Dtest=AiAssistantAutoConfigurationTest" test`：11 个测试通过。
- `npm test -- useServerPromptTemplates.spec.ts`：2 个测试通过。
- `node --test scripts/*.test.mjs`：34 个测试通过。
- `npm test -- useServerPromptTemplates.spec.ts api.spec.ts`：3 个测试文件、55 个测试通过。
- `node scripts/project-health-check.mjs --release-check`：通过。
- `npm run build`（`ai-assistant-ui`）：通过，Package export check OK（27 paths）。
- `mvn package`：通过。
- `npm run build`（`docs`）：通过。

### 当前阶段 13.38

状态：已完成。

目标：
- 继续推进 refresh dry-run、schema 收紧、prompt template 交互拆分、observability artifact 预演。

修改：
- 修改 `scripts/refresh-openapi-snapshot.mjs`
- 修改 `scripts/refresh-openapi-snapshot.test.mjs`
- 修改 `docs/api/openapi.json`
- 修改 `ai-assistant-ui/src/types/api-generated.d.ts`
- 新增 `ai-assistant-ui/src/composables/usePromptTemplateInteraction.ts`
- 新增 `ai-assistant-ui/src/composables/usePromptTemplateInteraction.spec.ts`
- 修改 `ai-assistant-ui/src/components/AiAssistant.vue`
- 新增 `docs/guide/observability-support-split.md`
- 修改 `docs/.vitepress/config.ts`
- 修改 `task_plan.md`
- 修改 `findings.md`
- 修改 `progress.md`

验证：
- `node --test scripts/refresh-openapi-snapshot.test.mjs`：5 个测试通过。
- `npm test -- usePromptTemplateInteraction.spec.ts useServerPromptTemplates.spec.ts`：通过。
- `node --test scripts/*.test.mjs`：36 个测试通过。
- `npm test -- usePromptTemplateInteraction.spec.ts useServerPromptTemplates.spec.ts api.spec.ts`：4 个测试文件、56 个测试通过。
- `node scripts/project-health-check.mjs --release-check`：通过。
- `npm run build`（`ai-assistant-ui`）：通过，Package export check OK（27 paths）。
- `mvn package`：通过。
- `npm run build`（`docs`）：通过。

### 当前阶段 13.40

状态：已完成。

目标：
- 将 observability support skeleton 推进到真实 artifact metadata。
- 继续拆出 prompt/quick prompt 与 command palette 的编排逻辑。
- 增强 OpenAPI refresh dry-run 的漂移诊断。
- 增强 bundle baseline 变化摘要输出。

修改：
- 修改 `ai-assistant-observability-support/pom.xml`
- 新增 `ai-assistant-observability-support/src/main/resources/META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports`
- 新增 `scripts/observability-support-module.test.mjs`
- 新增 `ai-assistant-ui/src/composables/useAssistantPromptCommands.ts`
- 新增 `ai-assistant-ui/src/composables/useAssistantPromptCommands.spec.ts`
- 修改 `ai-assistant-ui/src/composables/useBuiltInCommands.ts`
- 修改 `ai-assistant-ui/src/components/AiAssistant.vue`
- 修改 `scripts/refresh-openapi-snapshot.mjs`
- 修改 `scripts/refresh-openapi-snapshot.test.mjs`
- 修改 `scripts/bundle-size-check.mjs`
- 修改 `scripts/bundle-size-check.test.mjs`
- 修改 `task_plan.md`
- 修改 `findings.md`
- 修改 `progress.md`

验证：
- RED：`node --test scripts/observability-support-module.test.mjs scripts/refresh-openapi-snapshot.test.mjs scripts/bundle-size-check.test.mjs` 首次失败，缺少 support metadata、`summarizeSpecDrift` 和 `summarizeBaselineChanges`。
- RED：`npm test -- useAssistantPromptCommands.spec.ts useBuiltInCommands.spec.ts` 首次失败，缺少 `useAssistantPromptCommands`。
- GREEN：`node --test scripts/observability-support-module.test.mjs`：2/2 通过。
- GREEN：`npm test -- useAssistantPromptCommands.spec.ts useBuiltInCommands.spec.ts`：3/3 通过。
- GREEN：`node --test scripts/refresh-openapi-snapshot.test.mjs`：6/6 通过。
- GREEN：`node --test scripts/bundle-size-check.test.mjs`：2/2 通过。
- `node --test scripts/*.test.mjs`：40/40 通过。
- `npm test -- useAssistantPromptCommands.spec.ts useQuickPromptOptions.spec.ts usePromptTemplateInteraction.spec.ts`：3 个测试文件、5 个测试通过。
- `npx vue-tsc --noEmit`：通过。
- `ReadLints` 对本轮改动文件无诊断。
- `mvn -pl ai-assistant-observability-support test` 未完成：Maven 卡在依赖下载，已停止；没有执行 Maven package。

### 当前阶段 13.41

状态：已完成。

目标：
- Observability support artifact 继续迁移 OpenAPI auto-configuration metadata。
- 清理 line-ending-only 噪音。
- 继续收拢 feature slash command 与 command palette action。
- 让 release-check 输出 bundle-size 变化摘要。

修改：
- 修改 `ai-assistant-server/src/main/resources/META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports`
- 修改 `ai-assistant-service/pom.xml`
- 修改 `scripts/observability-support-module.test.mjs`
- 修改 `docs/guide/observability-support-split.md`
- 新增 `ai-assistant-ui/src/composables/useAssistantFeatureCommands.ts`
- 新增 `ai-assistant-ui/src/composables/useAssistantFeatureCommands.spec.ts`
- 修改 `ai-assistant-ui/src/components/AiAssistant.vue`
- 修改 `scripts/project-health-check.mjs`
- 修改 `docs/guide/dependency-footprint.md`
- 修改 `task_plan.md`
- 修改 `findings.md`
- 修改 `progress.md`

验证：
- RED：`node --test scripts/observability-support-module.test.mjs` 首次 2/4 失败，证明 starter metadata 仍直接导入 OpenAPI 且 standalone service 未显式依赖 support artifact。
- GREEN：`node --test scripts/observability-support-module.test.mjs`：4/4 通过。
- RED：`npm test -- useAssistantFeatureCommands.spec.ts` 首次失败，缺少模块。
- GREEN：`npm test -- useAssistantFeatureCommands.spec.ts useAssistantPromptCommands.spec.ts useQuickPromptOptions.spec.ts usePromptTemplateInteraction.spec.ts`：4 个测试文件、7 个测试通过。
- `npx vue-tsc --noEmit` 首次失败，发现 form-fill action 返回 `Promise<boolean>` 不匹配；修正为 `void formAutoFill.triggerFromText(text)` 后通过。
- `git add -u` 后，上一轮 42 个 line-ending-only 状态清理为工作区干净，没有产生单独行尾提交。

### 当前阶段 13.42

状态：已完成。

目标：
- 让 observability support artifact 自带 OpenAPI support 依赖。
- 增加 support module 的 Java slice test。
- 将 `/template` slash command 纳入 prompt command composable。
- 刷新 bundle baseline。

修改：
- 修改 `ai-assistant-observability-support/pom.xml`
- 新增 `ai-assistant-observability-support/src/test/java/com/aiassistant/observabilitysupport/OpenApiSupportAutoConfigurationTest.java`
- 修改 `scripts/observability-support-module.test.mjs`
- 修改 `docs/guide/observability-support-split.md`
- 修改 `ai-assistant-ui/src/composables/useAssistantPromptCommands.ts`
- 修改 `ai-assistant-ui/src/composables/useAssistantPromptCommands.spec.ts`
- 修改 `ai-assistant-ui/src/components/AiAssistant.vue`
- 修改 `scripts/.bundle-size-baseline.json`
- 修改 `task_plan.md`
- 修改 `findings.md`
- 修改 `progress.md`

验证：
- RED：`node --test scripts/observability-support-module.test.mjs` 首次失败，缺少 springdoc dependency。
- RED：`npm test -- useAssistantPromptCommands.spec.ts` 首次失败，缺少 `slashCommands`。
- RED：`mvn -pl ai-assistant-observability-support test` 首次失败，缺少 OpenAPI/JUnit/Spring Boot test classpath。
- GREEN：`node --test scripts/observability-support-module.test.mjs`：5/5 通过。
- GREEN：`npm test -- useAssistantPromptCommands.spec.ts useAssistantFeatureCommands.spec.ts`：2 个测试文件、6 个测试通过。
- GREEN：`mvn -pl ai-assistant-observability-support test`：1 个测试通过。
- `npm run build`（`ai-assistant-ui`）：通过，Package export check OK（27 paths）。
- `node scripts/bundle-size-check.mjs --update-baseline`：完成，写入 111 个文件 baseline。

### 当前阶段 13.43

状态：已完成。

目标：
- 给 observability support 增加 tracing/logstash optional dependency guard。
- 继续验证 standalone service 通过 support artifact 获得 OpenAPI support。
- 抽出命令组合 registry。
- 补 release-check 运行顺序文档。

修改：
- 修改 `ai-assistant-observability-support/pom.xml`
- 修改 `scripts/observability-support-module.test.mjs`
- 新增 `ai-assistant-ui/src/composables/useAssistantCommandRegistry.ts`
- 新增 `ai-assistant-ui/src/composables/useAssistantCommandRegistry.spec.ts`
- 修改 `ai-assistant-ui/src/components/AiAssistant.vue`
- 修改 `docs/guide/observability-support-split.md`
- 修改 `docs/guide/dependency-footprint.md`
- 修改 `task_plan.md`
- 修改 `findings.md`
- 修改 `progress.md`

验证：
- RED：`node --test scripts/observability-support-module.test.mjs` 首次失败，缺少 tracing/logstash optional dependencies。
- RED：`npm test -- useAssistantCommandRegistry.spec.ts` 首次失败，缺少模块。
- GREEN：`node --test scripts/observability-support-module.test.mjs`：7/7 通过。
- GREEN：`npm test -- useAssistantCommandRegistry.spec.ts useAssistantPromptCommands.spec.ts useAssistantFeatureCommands.spec.ts`：3 个测试文件、7 个测试通过。
- GREEN：`mvn -pl ai-assistant-observability-support test`：1 个测试通过。

### 当前阶段 13.44

状态：已完成。

目标：
- 将 tracing / OTLP / logstash bridge 从 starter POM 下沉到 observability support artifact。
- 让 release-check 自带 UI build 顺序，并在 CI frontend job 复用同一 release lane。
- 将 command registry 从 prompt/feature 专用参数收敛为 command families。
- 刷新 bundle baseline，消除当前 hash chunk 噪音。

修改：
- 修改 `ai-assistant-server/pom.xml`
- 修改 `scripts/observability-support-module.test.mjs`
- 新增 `scripts/project-health-check.test.mjs`
- 修改 `scripts/project-health-check.mjs`
- 修改 `.github/workflows/ci.yml`
- 修改 `ai-assistant-ui/src/composables/useAssistantCommandRegistry.ts`
- 修改 `ai-assistant-ui/src/composables/useAssistantCommandRegistry.spec.ts`
- 修改 `ai-assistant-ui/src/components/AiAssistant.vue`
- 修改 `scripts/.bundle-size-baseline.json`
- 修改 `docs/guide/dependency-footprint.md`
- 修改 `docs/guide/observability-support-split.md`
- 修改 `task_plan.md`
- 修改 `findings.md`
- 修改 `progress.md`

验证：
- RED：`node --test scripts/observability-support-module.test.mjs scripts/project-health-check.test.mjs` 首次失败，证明 starter 仍声明 tracing/logstash bridge，且 release-check 还没有自带 UI build step。
- RED：`npm test -- useAssistantCommandRegistry.spec.ts` 首次失败，证明 registry 仍依赖 prompt/feature 专用参数。
- GREEN：`node --test scripts/observability-support-module.test.mjs scripts/project-health-check.test.mjs`：9 个测试通过。
- GREEN：`npm test -- useAssistantCommandRegistry.spec.ts`：1 个测试通过。
- `npm run build`（`ai-assistant-ui`）：通过，Package export check OK（27 paths）。
- `node ../scripts/bundle-size-check.mjs --update-baseline`：完成，写入 111 个文件 baseline；change summary 为 added none / removed none / over budget growth none / shrunk none。
- `node scripts/project-health-check.mjs --release-check`：通过，包含 UI build、47 个脚本测试、静态 OpenAPI 检查、bundle-size 和依赖足迹检查。
- `npm test -- useAssistantCommandRegistry.spec.ts useAssistantPromptCommands.spec.ts useAssistantFeatureCommands.spec.ts`：3 个测试文件、7 个测试通过。
- `mvn package`：通过。
- `npm run build`（`docs`）：通过。
- `ReadLints` 对本轮修改文件无诊断。

### 当前阶段 13.45

状态：已完成。

目标：
- 新增 Observability support quick start。
- 记录 OpenAPI implementation 迁移预研。
- 新增 support dependency boundary report，支持 Markdown 输出并接入 release-check。
- 抽出 `useAssistantCommandFamilies` / `useAssistantWorkflowCommands`，继续减少 `AiAssistant.vue` 命令拼接细节。
- 拆分 release-check fast/full lane。
- 精简 CI frontend job 中已被 release-check 覆盖的重复 exports 检查。

修改：
- 新增 `docs/guide/observability-support-quick-start.md`
- 修改 `docs/.vitepress/config.ts`
- 修改 `docs/guide/dependency-footprint.md`
- 修改 `docs/guide/observability-support-split.md`
- 新增 `scripts/support-dependency-report.mjs`
- 新增 `scripts/support-dependency-report.test.mjs`
- 新增 `scripts/observability-support-docs.test.mjs`
- 新增 `scripts/ci-release-lane.test.mjs`
- 修改 `scripts/project-health-check.mjs`
- 修改 `scripts/project-health-check.test.mjs`
- 新增 `ai-assistant-ui/src/composables/useAssistantCommandFamilies.ts`
- 新增 `ai-assistant-ui/src/composables/useAssistantCommandFamilies.spec.ts`
- 新增 `ai-assistant-ui/src/composables/useAssistantWorkflowCommands.ts`
- 新增 `ai-assistant-ui/src/composables/useAssistantWorkflowCommands.spec.ts`
- 修改 `ai-assistant-ui/src/components/AiAssistant.vue`
- 修改 `.github/workflows/ci.yml`
- 修改 `task_plan.md`
- 修改 `findings.md`
- 修改 `progress.md`

验证：
- RED：脚本测试首次失败，原因是缺 `support-dependency-report.mjs`、Markdown 输出、quick start 文档/侧边栏入口、OpenAPI migration pre-study、release-check support report lane、release-check fast/full，以及 CI 仍存在重复 exports check。
- RED：`npm test -- useAssistantWorkflowCommands.spec.ts useAssistantCommandFamilies.spec.ts` 首次失败，原因是缺 workflow commands 模块且 command families 还未接收 workflow family。
- GREEN：`node --test scripts/support-dependency-report.test.mjs scripts/project-health-check.test.mjs scripts/observability-support-docs.test.mjs scripts/ci-release-lane.test.mjs`：6 个测试通过。
- GREEN：`npm test -- useAssistantWorkflowCommands.spec.ts useAssistantCommandFamilies.spec.ts`：2 个测试通过。
- `node scripts/project-health-check.mjs --release-check`：通过，包含 support dependency boundary report；bundle change summary 为 added none / removed none / over budget growth none / shrunk none。
- `npm test -- useAssistantCommandFamilies.spec.ts useAssistantCommandRegistry.spec.ts useAssistantPromptCommands.spec.ts useAssistantFeatureCommands.spec.ts`：4 个测试文件、8 个测试通过。
- `mvn package`：通过。
- `npm run build`（`docs`）：通过。
- `ReadLints` 对本轮修改文件无诊断。
- `node scripts/project-health-check.mjs --release-check-full`：通过；刷新 baseline 后 bundle change summary 为 added none / removed none / over budget growth none / shrunk none。
- `node scripts/project-health-check.mjs --release-check-fast`：通过，55 个脚本测试全部通过。
- `npm test -- useAssistantWorkflowCommands.spec.ts useAssistantCommandFamilies.spec.ts useAssistantCommandRegistry.spec.ts useAssistantPromptCommands.spec.ts useAssistantFeatureCommands.spec.ts`：5 个测试文件、9 个测试通过。

### 当前阶段 13.46

状态：已完成。

目标：
- PR sticky comment 纳入 support dependency boundary report。
- CI release lane 分层：repository 跑 fast，frontend 跑 full。
- OpenAPI implementation 从 starter 迁到 observability support artifact。
- Command family API 统一命名和返回结构。
- 刷新 bundle baseline。

修改：
- 修改 `.github/workflows/ci.yml`
- 修改 `scripts/ci-release-lane.test.mjs`
- 修改 `scripts/observability-support-module.test.mjs`
- 修改 `scripts/observability-support-docs.test.mjs`
- 修改 `docs/guide/observability-support-split.md`
- 新增 `ai-assistant-observability-support/src/main/java/com/aiassistant/autoconfigure/AiAssistantOpenApiAutoConfiguration.java`
- 删除 `ai-assistant-server/src/main/java/com/aiassistant/autoconfigure/AiAssistantOpenApiAutoConfiguration.java`
- 修改 `ai-assistant-observability-support/src/test/java/com/aiassistant/observabilitysupport/OpenApiSupportAutoConfigurationTest.java`
- 修改 `ai-assistant-server/src/test/java/com/aiassistant/autoconfigure/AiAssistantAutoConfigurationTest.java`
- 修改 `ai-assistant-ui/src/composables/useAssistantCommandFamilies.ts`
- 修改 `ai-assistant-ui/src/composables/useAssistantCommandFamilies.spec.ts`
- 修改 `ai-assistant-ui/src/composables/useAssistantCommandRegistry.ts`
- 修改 `ai-assistant-ui/src/composables/useAssistantCommandRegistry.spec.ts`
- 修改 `scripts/.bundle-size-baseline.json`
- 修改 `task_plan.md`
- 修改 `findings.md`
- 修改 `progress.md`

验证：
- RED：`node --test scripts/ci-release-lane.test.mjs scripts/observability-support-module.test.mjs` 首次失败，证明 CI 尚未接入 fast/full + support report comment，且 OpenAPI implementation 仍在 starter。
- RED：`npm test -- useAssistantCommandFamilies.spec.ts useAssistantCommandRegistry.spec.ts` 首次失败，证明 command family 尚未暴露统一的 `name` / `commandPaletteCommands` API。
- GREEN：`node --test scripts/ci-release-lane.test.mjs scripts/observability-support-module.test.mjs scripts/support-dependency-report.test.mjs scripts/project-health-check.test.mjs`：18 个测试通过。
- GREEN：`npm test -- useAssistantCommandFamilies.spec.ts useAssistantCommandRegistry.spec.ts useAssistantWorkflowCommands.spec.ts`：3 个测试文件、3 个测试通过。
- `mvn -pl ai-assistant-observability-support test`：1 个测试通过。
- `mvn -pl ai-assistant-server test`：621 个测试通过。
- `node scripts/project-health-check.mjs --release-check-fast`：通过，59 个脚本测试全部通过。
- `npm run build`（`ai-assistant-ui`）：通过，Package export check OK（27 paths）。
- `node scripts/project-health-check.mjs --release-check-full`：通过。
- `node scripts/bundle-size-check.mjs --update-baseline`：完成，写入 111 个文件 baseline；change summary 为 added none / removed none / over budget growth none / shrunk none。
- `ReadLints` 对本轮修改文件无诊断；`git diff --check` 无空白错误，仅有既有 CRLF/LF 提示。

### 当前阶段 13.47

状态：已完成。

目标：
- 将 CI PR metrics comment 拼接逻辑从 workflow inline shell 抽成脚本。
- 补齐 support artifact 中 host-provided `OpenAPI` bean 覆盖测试。
- 将 panel/session/theme/personalize/keyboard help 纳入 app command family。
- 用脚本测试固化 CI 去重审计。
- 完成打包、提交和推送。

修改：
- 新增 `scripts/ci-metrics-comment.mjs`
- 新增 `scripts/ci-metrics-comment.test.mjs`
- 修改 `.github/workflows/ci.yml`
- 修改 `scripts/ci-release-lane.test.mjs`
- 修改 `ai-assistant-observability-support/src/test/java/com/aiassistant/observabilitysupport/OpenApiSupportAutoConfigurationTest.java`
- 新增 `ai-assistant-ui/src/composables/useAssistantAppCommands.ts`
- 新增 `ai-assistant-ui/src/composables/useAssistantAppCommands.spec.ts`
- 修改 `ai-assistant-ui/src/composables/useAssistantCommandFamilies.ts`
- 修改 `ai-assistant-ui/src/composables/useAssistantCommandFamilies.spec.ts`
- 修改 `ai-assistant-ui/src/composables/useBuiltInCommands.ts`
- 修改 `ai-assistant-ui/src/components/AiAssistant.vue`
- 修改 `scripts/.bundle-size-baseline.json`
- 修改 `findings.md`
- 修改 `progress.md`
- 修改 `task_plan.md`

验证：
- RED：`node --test scripts/ci-metrics-comment.test.mjs scripts/ci-release-lane.test.mjs` 首次失败，原因是缺 `ci-metrics-comment.mjs` 且 workflow 仍 inline 拼接 comment。
- RED：`npm test -- useAssistantAppCommands.spec.ts useAssistantCommandFamilies.spec.ts` 首次失败，原因是缺 `useAssistantAppCommands` 且 command families 未包含 app family。
- GREEN：`node --test scripts/ci-metrics-comment.test.mjs scripts/ci-release-lane.test.mjs`：5 个测试通过。
- GREEN：`npm test -- useAssistantAppCommands.spec.ts useAssistantCommandFamilies.spec.ts useAssistantCommandRegistry.spec.ts`：3 个测试文件、3 个测试通过。
- `mvn -pl ai-assistant-observability-support test`：2 个测试通过。
- `node scripts/project-health-check.mjs --release-check-full`：通过，61 个脚本测试通过。
- `mvn package`：通过。
- `npm run build`（`docs`）：通过。
- `node scripts/bundle-size-check.mjs --update-baseline`：完成，写入 111 个文件 baseline；change summary 为 added none / removed none / over budget growth none / shrunk none。

### 当前阶段 13.48

状态：已完成。

目标：
- 将 `useBuiltInCommands` 改名为 `useCommandPaletteRegistration`。
- 为 `ci-metrics-comment.mjs` 增加真实文件输入输出的 CLI fixture 测试。
- 将 memory / KB palette entries 迁入 feature command family。
- 更新 README / observability quick start，说明 OpenAPI auto-configuration class 现在由 support artifact 提供。
- 完成打包、提交和推送。

修改：
- 删除 `ai-assistant-ui/src/composables/useBuiltInCommands.ts`
- 新增 `ai-assistant-ui/src/composables/useCommandPaletteRegistration.ts`
- 新增 `ai-assistant-ui/src/composables/useCommandPaletteRegistration.spec.ts`
- 修改 `ai-assistant-ui/src/components/AiAssistant.vue`
- 修改 `ai-assistant-ui/src/composables/useAssistantFeatureCommands.ts`
- 修改 `ai-assistant-ui/src/composables/useAssistantFeatureCommands.spec.ts`
- 修改 `scripts/ci-metrics-comment.test.mjs`
- 修改 `scripts/observability-support-docs.test.mjs`
- 修改 `docs/guide/observability-support-quick-start.md`
- 修改 `README.md`
- 修改 `scripts/.bundle-size-baseline.json`
- 修改 `findings.md`
- 修改 `progress.md`
- 修改 `task_plan.md`

验证：
- RED：`npm test -- useAssistantFeatureCommands.spec.ts useCommandPaletteRegistration.spec.ts` 首次失败，证明 memory/KB palette entries 缺失且新 registration composable 尚未存在。
- RED：`node --test scripts/ci-metrics-comment.test.mjs scripts/observability-support-docs.test.mjs` 首次失败，证明 public docs 尚未说明 OpenAPI class 迁移。
- GREEN：`npm test -- useAssistantFeatureCommands.spec.ts useCommandPaletteRegistration.spec.ts useAssistantCommandFamilies.spec.ts`：3 个测试文件、5 个测试通过。
- GREEN：`node --test scripts/ci-metrics-comment.test.mjs scripts/observability-support-docs.test.mjs`：6 个测试通过。
- `node scripts/project-health-check.mjs --release-check-full`：通过，63 个脚本测试通过。
- `mvn package`：通过。
- `npm run build`（`docs`）：通过。
- `node scripts/bundle-size-check.mjs --update-baseline`：完成，写入 111 个文件 baseline；change summary 为 added none / removed none / over budget growth none / shrunk none。

### 当前阶段 13.51

状态：已完成。

说明：阶段 13.50 为本轮最新实现记录；本段补充最终验证口径，避免尾部阶段顺序误读。

验证：
- `node scripts/project-health-check.mjs --release-check-full`：通过，66 个脚本测试通过。
- `mvn package`：通过。
- `npm run build`（`docs`）：通过。
- `node scripts/refresh-release-baselines.mjs`：通过，bundle change summary 为 added none / removed none / over budget growth none / shrunk none。

### 当前阶段 13.52

状态：已完成。

目标：
- command registry debug report 接入 CI metrics。
- duplicate command id 严格模式在测试环境启用。
- `refresh-release-baselines.mjs` 增加 `--check` 模式。
- README 增加 observability support direct/optional 能力矩阵。
- 完成打包、提交和推送。

修改：
- 新增 `scripts/command-registry-report.mjs`
- 新增 `scripts/command-registry-report.test.mjs`
- 修改 `.github/workflows/ci.yml`
- 修改 `scripts/ci-metrics-comment.mjs`
- 修改 `scripts/ci-metrics-comment.test.mjs`
- 修改 `scripts/ci-release-lane.test.mjs`
- 修改 `scripts/frontend-command-registry.test.mjs`
- 修改 `scripts/refresh-release-baselines.mjs`
- 修改 `scripts/refresh-release-baselines.test.mjs`
- 修改 `README.md`
- 修改 `scripts/.bundle-size-baseline.json`
- 修改 `progress.md`
- 修改 `task_plan.md`

验证：
- GREEN：`npm test -- useAssistantCommandRegistry.spec.ts useAssistantCommandFamilies.spec.ts`：5 个测试通过。
- GREEN：`node --test scripts/command-registry-report.test.mjs scripts/ci-metrics-comment.test.mjs scripts/ci-release-lane.test.mjs scripts/refresh-release-baselines.test.mjs scripts/observability-support-docs.test.mjs scripts/frontend-command-registry.test.mjs`：15 个测试通过。
- `node scripts/project-health-check.mjs --release-check-full`：通过，68 个脚本测试通过。
- `mvn package`：通过。
- `npm run build`（`docs`）：通过。
- `node scripts/refresh-release-baselines.mjs`：通过，bundle change summary 为 added none / removed none / over budget growth none / shrunk none。

### 当前阶段 13.50

状态：已完成。

目标：
- 在 `AiAssistant.vue` 中消费 duplicate command palette id 检测结果。
- 为 command family 增加 `source` / `description` metadata。
- 新增 release baseline refresh 脚本。
- 在 support quick start 中补 starter/support POM 示例。
- 完成打包、提交和推送。

修改：
- 修改 `ai-assistant-ui/src/components/AiAssistant.vue`
- 修改 `ai-assistant-ui/src/composables/useAssistantCommandFamilies.ts`
- 修改 `ai-assistant-ui/src/composables/useAssistantCommandFamilies.spec.ts`
- 修改 `ai-assistant-ui/src/composables/useAssistantCommandRegistry.ts`
- 新增 `scripts/frontend-command-registry.test.mjs`
- 新增 `scripts/refresh-release-baselines.mjs`
- 新增 `scripts/refresh-release-baselines.test.mjs`
- 修改 `scripts/observability-support-docs.test.mjs`
- 修改 `docs/guide/observability-support-quick-start.md`
- 修改 `scripts/.bundle-size-baseline.json`
- 修改 `findings.md`
- 修改 `progress.md`
- 修改 `task_plan.md`

验证：
- RED：`npm test -- useAssistantCommandFamilies.spec.ts` 首次失败，证明 command family metadata 缺失。
- RED：`node --test scripts/frontend-command-registry.test.mjs scripts/refresh-release-baselines.test.mjs scripts/observability-support-docs.test.mjs` 首次失败，证明 UI 未消费 duplicate ids、baseline refresh 脚本缺失、docs 缺 POM 对照。
- GREEN：`npm test -- useAssistantCommandFamilies.spec.ts useAssistantCommandRegistry.spec.ts`：2 个测试文件、3 个测试通过。
- GREEN：`node --test scripts/frontend-command-registry.test.mjs scripts/refresh-release-baselines.test.mjs scripts/observability-support-docs.test.mjs scripts/ci-metrics-comment.test.mjs`：8 个测试通过。
- `node scripts/project-health-check.mjs --release-check-full`：通过，65 个脚本测试通过。
- `mvn package`：通过。
- `npm run build`（`docs`）：通过。
- `node scripts/refresh-release-baselines.mjs`：通过，bundle change summary 为 added none / removed none / over budget growth none / shrunk none。

### 当前阶段 13.49

状态：已完成。

目标：
- 给 command registry 增加 palette command duplicate id 检测。
- 补 `useCommandPaletteRegistration` 动态更新测试。
- 把 CI metrics comment marker、report 顺序、footer 变成可测试常量。
- 在 support quick start 中加入 starter-only vs with-support OpenAPI 对照示例。
- 完成打包、提交和推送。

修改：
- 修改 `ai-assistant-ui/src/composables/useAssistantCommandRegistry.ts`
- 修改 `ai-assistant-ui/src/composables/useAssistantCommandRegistry.spec.ts`
- 修改 `ai-assistant-ui/src/composables/useCommandPaletteRegistration.spec.ts`
- 修改 `scripts/ci-metrics-comment.mjs`
- 修改 `scripts/ci-metrics-comment.test.mjs`
- 修改 `scripts/observability-support-docs.test.mjs`
- 修改 `docs/guide/observability-support-quick-start.md`
- 修改 `scripts/.bundle-size-baseline.json`
- 修改 `findings.md`
- 修改 `progress.md`
- 修改 `task_plan.md`

验证：
- RED：`npm test -- useAssistantCommandRegistry.spec.ts useCommandPaletteRegistration.spec.ts` 首次失败，证明 duplicate id computed 缺失。
- RED：`node --test scripts/ci-metrics-comment.test.mjs scripts/observability-support-docs.test.mjs` 首次失败，证明 CI constants 尚未导出且 support quick start 缺 starter-only/with-support 对照。
- GREEN：`npm test -- useAssistantCommandRegistry.spec.ts useCommandPaletteRegistration.spec.ts`：2 个测试文件、4 个测试通过。
- GREEN：`node --test scripts/ci-metrics-comment.test.mjs scripts/observability-support-docs.test.mjs`：6 个测试通过。
- `node scripts/project-health-check.mjs --release-check-full`：通过，63 个脚本测试通过。
- `mvn package`：通过。
- `npm run build`（`docs`）：通过。
- `node scripts/bundle-size-check.mjs --update-baseline`：完成，写入 111 个文件 baseline；change summary 为 added none / removed none / over budget growth none / shrunk none。
