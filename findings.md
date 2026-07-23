# AI Assistant SDK 优化发现记录

## 2026-07-22 v1.x 发布候选验收

- 最终验收结论：PR `#45` 与合并后端口修复 PR `#48` 均已在适用检查全绿后非强制合并；最终应用合并提交为 `dced55b9`。该提交的 GitHub 官方源码归档在全新目录以被忽略的 `.env` 使用宿主 `19010`、容器内部 `8080` 完成一键启动，页面与 HTTP/SSE `9/9`、真实浏览器 SSE、控制台零告警/错误均通过；验收应用容器已全部清理，shared-infra 未改动。当前没有已知 P0/P1，也没有核心流程已知可复现问题。
- 合并后从远端重新 clone 才暴露出并行端口契约的遗漏：Compose 会自动读取根 `.env` 的 `AI_ASSISTANT_WEB_PORT`，Node smoke 与两个一键脚本却只读取进程环境，因此实际页面在 `19010` 时会误测、误打印 `3000`。端口来源必须收敛到一个只读取显式 origin、进程端口或被忽略 `.env` 的解析器，并校验 `1-65535`；不能要求用户重复维护第二份环境变量。
- 2026-07-23 干净 Compose smoke 暴露了一个可观测性语义缺陷：HTTP 客户端完整读取 SSE 后，Servlet 适配层会以 Reactor `CANCEL` 结束上游订阅；`StreamingLlmCallExecutor` 的指标已将它记为 `cancel`，审计却把所有非 `ON_COMPLETE` 都记成 `ERROR`。新增 `AuditEvent.Outcome.CANCELLED` 并按终止信号映射后，同一运行链路的审计结果为 `SUCCESS/CANCELLED/SUCCESS`，不再污染错误率。
- 2026-07-23 远端 CI 的两项失败都能由干净环境事实解释：E2E 缺少 Web Component 构建产物，Security 则是 Trivy 新数据库识别到 Netty `4.1.135.Final` 的四个 HIGH。前者不是 flaky，后者也不能沿用前一天的“零漏洞”快照。
- `build:lib` 只生成 Vue library，不能满足 `e2e/src/wc.ts` 的 `@ai-assistant/vue/wc` export；E2E job 必须运行 `build:publish`，同时生成 library、Web Component、声明文件并校验全部 exports。定向真实后端 WC E2E 和完整 `32/32` 零重试结果证明该修复覆盖了实际失败链路。
- Spring Boot parent 模块可通过 `<netty.version>` 覆盖到 `4.1.136.Final`；独立 BOM 导入的 Starter 需要把 `io.netty:netty-bom` 放在 Spring Boot BOM 前。不能只检查 POM 字面量，最终以三个 dependency tree 和 Redis 独立服务 JAR 内 17 个 Netty 构件为准。
- 当前本地无法下载 Trivy `0.69.3` Windows 发布包或 Docker 镜像，GitHub/Docker Hub 均出现连接超时/EOF；这不是扫描通过证据。修复提交后的远端 Security job 必须成功后，才能恢复“当前数据库下零 HIGH/CRITICAL”的最终结论。
- 冷启动 E2E 超时已用同一断言、`retries=0` 关闭：目标三文件重复两轮 `14/14`，完整套件 `32/32` 一次通过。旧远端 PR 的失败运行检出的是合并提交 `5cdb6c2`（分支头 `08dc655`），Web Component 在 5 秒内尚未出现 FAB；当前未推送配置已把 CI 并发限为 1 并将 UI 等待预算校准为 10 秒，需以新提交远端 CI 作为最终证明。
- ESLint 的 17 项 warning 均为明确维护债而非产品缺陷：一个文件仅超软性行数阈值 2 行，另 16 项只在宿主省略可选个性化配置 prop 时触发静态规则，组件对 theme/audio 有显式缺省隐藏分支，其余输入由受控宿主传入。lint 退出 0，UI `801/801`、构建和 E2E 均通过；触发条件与影响已记录，不将其误报为零警告。
- 最终安全结论来自同一 `797` 文件候选快照的两类独立工具：Trivy 同时覆盖漏洞、密钥和配置，OWASP Dependency-Check 以更新至 `2026-07-22` 的 NVD 数据分析 Java 依赖；二者均为 0 阻断问题，精确 suppression 仅覆盖已人工核对的 Kotlin runtime 元数据误报并设置到期日。
- 最终 E2E 首轮的 3 个 retry 不是可接受完成证据。三张失败截图分别已出现正确的 prompt history 输入、完整助手面板和 Web Component FAB，且重试均在 `19.9-22.7s` 通过；共同根因是本地 5 worker 同时请求尚未缓存的 Vite 大组件转换，使 5 秒 locator 或 30 秒 test timeout 先到。合理修复是约束开发服务器并发并覆盖冷启动预算，不能删除断言或把 flaky 隐藏为通过。
- 用户提供的截图不是合理布局：模型选择浮层覆盖快捷工具和输入区，破坏“选择模型”和“继续输入”的层级边界，手机还会越过面板右边缘。最终菜单需要以面板为包含块、固定可预测宽度并为快捷工具留出独立垂直间距，不能靠视觉上接近但实际重叠的悬浮位置。
- 当前 HEAD 的真实浏览器几何已关闭该缺陷：桌面/平板/手机菜单与快捷工具分别保留约 `10.5/9/9px`，手机菜单左右边界为约 `8.45/228.45px`，完全位于面板内；静态主题/布局契约 `6/6`、publish build 27 个导出和定向 E2E 几何断言均通过。
- 干净消费证据必须同时满足“仓库初始无生成物”和“子进程未关闭 TLS 校验”。首次继承本机 `NODE_TLS_REJECT_UNAUTHORIZED=0` 的包 smoke 只能作为诊断；显式清除变量后第二次从真实 tarball 安装并解析 8 个公开入口，才是可采信结果。
- 独立服务与 Starter 两条 README 路径均已从干净 clone 验证。独立服务用 `19013 -> 8080` 的两个无状态容器且不复制基础设施；Starter 用本机 `19012` 前台 JAR。两者都通过同步 Chat/SSE，Demo 响应始终明确标记 deterministic local response、health 明确 `mock=true`，没有冒充真实 Provider。
- Java Client 当前 14 项契约覆盖同步响应、SSE 空格/多行帧、runtime model、认证与租户头、HTTP/逻辑/流式结构化错误、URL/timeout/tenant 输入校验；Starter 干净 reactor 的 827+3 项测试说明 Demo 宿主与核心自动装配在同一提交上可用。
- 续跑基线确认当前 `19014` 页面默认选中 Obsidian，主题列表为 Obsidian/Cobalt/Pulse/Circuit/Ember；浏览器验收必须同时核对持久化 key、CSS 主题变量和面板内所有可见 Sparkles，不能仅凭主题 radio 选中态下结论。
- 助手在 Obsidian 下可正常展开，DOM 语义与主要交互控件完整；下一步必须用计算样式定位标题/空状态/回复头像 Sparkles 的真实颜色，因为 SVG 本身不暴露可见文本，DOM 快照不能证明颜色同步。
- 源码确认 Playground 在每次主题变化时同步写入 `playground-theme` 与 `ai-assistant.theme.palette.v1`，并通过 `ai-assistant-theme-change` 通知组件；组件反向切换也使用同一事件。五套主题沿用 `graphite/sky/plum/forest/sunset` 兼容 key，Sparkles 应分别使用该预设的 `mark/darkMark`。
- Circuit 的浏览器权威值已一致：两个 storage key=`forest`，`--ai-brand-mark=#0f766e`，标题、空状态与 FAB Sparkles 的实际 `color/stroke=rgb(15,118,110)` 且 `fill=none`。这证明主题切换不仅改变页面色块，也已到达组件内双闪星。
- 真实 SSE 回复出现后，回复头像 Sparkles 为 `22x22`、`fill=none`、`color/stroke=rgb(15,118,110)`；同屏标题 Sparkles 为 `17x17` 且颜色完全一致。响应正文明确 Demo Provider 边界，证明这是实际后端完整 chat pipeline，而非前端 Mock。
- Cobalt 再次证明联动是动态的而非首次加载巧合：storage key=`sky`，Playground `#163b8c -> #5b8def`，组件 mark=`#2457d6`，标题/头像/FAB 三处 Sparkles 同步为 `rgb(36,87,214)`。
- Pulse 与 Ember 同样动态同步：兼容 key 分别为 `plum`/`sunset`，mark 分别为 `#0891b2`/`#c2410c`，每次切换后三处可见 Sparkles stroke 都与 mark 完全一致；已覆盖全部非默认彩色主题中的三套，Circuit/Cobalt/Pulse/Ember 均通过。
- 切回默认 Obsidian 后，历史消息头像也立即恢复为 `rgb(23,23,23)`，与标题/FAB 一致；说明现有消息不是在创建时固化颜色，而是实时消费主题令牌。默认黑色与主题切换跟随两项用户要求均有浏览器计算样式证据。
- `1440x900` 当前构建截图显示 Obsidian 页面保持克制的浅灰工作台与黑色主操作，助手标题/回复头像均为无圆底黑色 Sparkles；五个主题 swatch 提供蓝、青绿、青、橙和黑，不形成单一紫色主题。
- `768x1024` Circuit 截图显示主题星与页面 accent 一致，但末条回复与底部快捷模板区域视觉接近；需要读取两者 bounding boxes 与实际重叠面积，避免把滚动裁切误判为布局遮挡，也不能仅凭截图忽略潜在 P2。
- 几何结论为真实遮挡：助手 bubble `bottom=793.05`，快捷模板层 `top=770.20`，横向覆盖完整 bubble、纵向交叠 `22.85px`；CSS 在 `99-enterprise-overhaul.css` 将该层设为 `position:absolute; bottom:calc(100% + 4px)`，且注释明确不占 footer 空间。修复应让其回到 flow，而非继续追加消息区 padding 魔数。
- 为保留此前“胶囊在输入框外且没有灰框”的视觉契约，最终没有把模板行塞回 footer 内部；改为 footer 在存在模板行时用 `:has()` 预留 `var(--ai-quick-toggle-min-height) + 8px`，模板仍绝对定位在透明区域。移动端变量自动从 22px 提升到 44px，避免硬编码单一视口高度。
- 修复后 `768x1024` 中消息滚动容器底部为 `766.2`、模板层顶部为 `770.2`，可见区域已有 4px 安全间距；bubble 的未裁剪 `getBoundingClientRect()` 仍可落到容器外，不能再用原始 bubble/模板矩形直接判定重叠，必须取与 overflow viewport 的交集并验证可滚动到底。
- 平板问题的第二层根因是 geometry 默认高度固定 `520px`，而 `<=820px` 触控门禁把 header/model/quick/send 等控件统一增至 `44px`；两套策略此前不协调。新规则仅在 `601-820px` 把默认提高到 `680px`，桌面保持 `520px`、手机仍由 `<=600px` 全屏逻辑接管、低高度继续 clamp，用户 resize 值仍优先。
- 修复后重新发送真实 Demo SSE 并滚动到底，`768x1024` 下消息区 `maxScrollTop=78`、快捷模板与消息滚动视口保持 `4px` 间距，可见回复与模板交集面积为 `0`；复制/重试/反馈操作栏和 reaction bar 均完整落在消息视口内。截图 `output/playwright/tech-themes-circuit-19014-768x1024-final.png` 已人工检查通过。
- 手机 `375x812` 关闭全屏助手后切换 Pulse 并重新打开，两个主题 key 均为 `plum`、`--ai-brand-mark=#0891b2`；标题、历史回复头像、隐藏态 FAB 三处 Sparkles 均为 `rgb(8,145,178)` 且 `fill=none`。面板 `375x812` 全屏、页面 `scrollWidth=clientWidth=375`、面板无横向溢出，当前可见控件没有小于 `44px`；消息滚到底后与模板交集为 `0`，截图为 `output/playwright/tech-themes-pulse-19014-375x812-recheck.png`。
- 桌面 `1440x900` 切回 Obsidian 后两个 key 均为 `graphite`、`--ai-brand-mark=#171717`；标题/头像/FAB Sparkles 均为 `rgb(23,23,23)`。面板完整落在视口内、页面与面板均无横向溢出，消息与模板交集为 `0`；截图为 `output/playwright/tech-themes-obsidian-19014-1440x900-final.png`。
- 提交前扩展色值审计发现暗色面板粒子仍有一处 `rgba(192,132,252)`，原主题契约未收录该紫色 RGB；已改为中性灰并把暗面板背景从蓝黑收敛为 `#171717 -> #0a0a0a`，同时新增 `#c084fc`/对应 RGB 禁止项。扩展测试 `5/5` 和全源紫色扫描均通过。
- 同一真实 Chromium 会话继续遍历 Demo、Admin Console 与 Form Auto-Fill；页面路由、Admin 7 个标签、表单控件和主题选择语义均正常。最终控制台为 `0 error / 0 warning`，仅有 Chrome 对 password input 不在 form 内的 verbose 提示；全部动态 API 与三次真实 SSE 请求均为 HTTP `200`，会话已正常关闭。

### 黑色品牌主题追加验收

- 用户明确要求双闪星为黑色，Playground、Vue 组件和 Web Component 的字体、主按钮、焦点、选中态与品牌主题统一为黑白灰现代科技风，不能保留“黑色图标 + 紫色内部主题”的割裂。
- 当前 `4ce2e5e` 只统一了 Sparkles 图形；`ai-assistant-vue-playground/src/App.vue` 仍有 `#6366f1 -> #8b5cf6` 紫色渐变，UI 历史样式仍有 violet/purple tone 与 indigo fallback，用户反馈可由代码复现。
- 收敛范围以品牌色为主，错误、警告、成功等语义状态仍保留可辨识颜色；所有结论必须在 `375x812`、`768x1024`、`1440x900` 的真实浏览器中复验。
- 当前工作树在本轮修改前干净；分支相对远端 ahead 3 / behind 2，最终发布前必须非破坏性整合远端提交并重跑门禁。
- 主题根因不是单一图标：`AiAssistant.vue` 与 Playground 都默认持久化 `sky`，公开预设还包含 `plum`；`99-enterprise-overhaul.css` 继续硬编码紫色粒子、焦点光晕、卡片 hover 和 violet tone。因此必须同时收敛主题状态、最终 CSS 令牌和页面层，不能只给星形加 `color: black`。
- 现有错误/警告/成功色承担状态辨识与无障碍含义，不属于品牌紫色；黑色主题修改只覆盖品牌、焦点、选中、装饰和主操作，不把所有状态做成不可区分的灰色。
- 现有干净环境真实截图显示：右下角 Sparkles 仍为亮蓝，展开面板有淡紫背景光晕，顶部主题切换器同时暴露蓝/橙/青/紫/灰五个大色块；视觉割裂可直接观察，不是仅存在于废弃 CSS。
- 推荐方向为 `ink black + graphite + white`：品牌图标/主操作用近黑色，hover/focus 用石墨灰和清晰黑色轮廓，暗色模式反转为近白品牌标记；避免黑色背景上的黑色焦点不可见。
- 组件基础令牌文件当前自述为 `indigo-violet brand`，主色、渐变、glow 与暗色透明度全部从紫色原语派生；`09-modern-overhaul.css` 又以 `!important` 强制 sky/cyan。这两处必须改源令牌，不能靠页面末端堆新覆盖。
- 为兼容已经持久化的主题值，保留 `sky/sunset/forest/plum/graphite` 内部 ID，默认改为黑色 Obsidian；其余展示为 Cobalt/Pulse/Circuit/Ember 现代科技色，外部自定义 `presets` 接口保持不变。
- 暗色模式需把品牌标记和焦点色反转为近白，避免黑色主题在深色背景上丢失可见性；成功/警告/错误/信息仍使用语义色。
- `99-enterprise-overhaul.css` 中紫色并非少量 fallback：`#5b6cff` 29 处、`#4f46e5` 27 处、`#c4b5fd` 18 处、`#9333ea` 13 处，另有多组紫色 rgba。需要建立明确的“紫色品牌色族 -> 黑/石墨/锌灰色族”映射并做静态扫描回归。
- Playground 后段样式已经把主要布局做成克制的工作台风格，但仍有蓝色 hover、SSE 左边线、主按钮、loader 星形和 Admin 激活态；这些属于品牌态，需同步为黑色。状态 success/warn/error 保留现值。
- 新增黑色主题契约首次真实红灯为 `0/4`；完成第一轮源令牌和页面映射后变为 `2/4`，Playground/Admin 无蓝紫品牌色与中性预设两项已经通过。
- 二次全源扫描发现连接诊断、表单填充、多模型比较、Prompt 模板及早期 CSS 层仍有 RGB 形式的靛紫字面量；这些弹窗/功能态可能绕过最终覆盖，故契约范围应扩到整个 `ai-assistant-ui/src`，而非只扫六个入口文件。
- 全 UI 源目录的紫色字面量已按黑/石墨/锌灰映射清理；空状态六类装饰 tone 也统一灰阶，但 success/warning/danger/info 语义令牌保持独立。
- Sparkles 不再直接读取渐变起点 `--ai-theme-from`，统一使用可切换的 `--ai-brand-mark`：浅色读取每套主题的 `mark`，暗色读取对比度更高的 `darkMark`；因此默认 Obsidian 为黑色，切换 Cobalt/Pulse/Circuit/Ember 时三处双闪星会同步变色。

### 星形品牌视觉追加验收

- 用户参考图明确要求入口只保留 `Sparkles` 轮廓，去掉黑色圆底；展开面板后，标题栏紫点、空状态紫球和助手消息头像也必须统一为同一无圆底星形。
- 最终样式源是 `99-enterprise-overhaul.css`，其中旧品牌形态分散在多个历史覆盖块；在文件末端用实际 SVG 类和高优先级规则统一清除伪元素、渐变背景、边框、圆角与球状阴影，改动面更小且不会影响消息网格尺寸。
- `14-adaptive-effects.css` 与 `15-artifacts.css` 没有标题、空状态或助手头像规则，不会在 `99-enterprise-overhaul.css` 之后重新覆盖本次视觉。

### 阶段 6 恢复发现

- 当前未提交差异不是阶段 1-5 的大范围实现，而是 7 个文件的发布门禁收口；必须在提交前独立验证，不能因历史全绿直接接受。
- `api.spec.ts` 中结构化 HTTP 错误与尾部 SSE 错误两组测试各出现两次完全相同的定义，属于明确的测试重复，应只保留一份而不降低断言。
- Redis 自动配置顺序回归、OpenAPI 校验约束、生成类型来源摘要和 CI Dependency-Check fallback 都有可验证意图；是否保留由定向测试、OpenAPI 漂移检查和完整发布门禁决定。
- 当前 OpenAPI 约束只改变 JSON Schema 的长度/格式限制，`openapi-typescript` 生成的结构类型本身可能不变；给生成文件写入规范化 JSON 摘要，能让约束漂移也被 `--check` 阻断。首次检查已真实红灯，证明门禁有效。
- 去重后 `api.spec.ts` 从 `62` 项回到 `57` 项，结构化同步错误、不可解析错误体、尾部 SSE 错误和流式 HTTP 错误断言仍全部保留并通过；测试数量下降来自消除重复，不是删除覆盖。
- 原 CI 安全任务只运行 `ai-assistant-ui` 的 `critical` npm audit，低于本轮四工作区实际使用的 `high` 门禁；统一 CI 口径后，未来 Playground、文档站或 E2E 锁文件引入高危依赖也会阻断 PR。
- 四个工作区在当前锁文件上的在线 audit 均为 0，且命令子进程已显式移除 `NODE_TLS_REJECT_UNAUTHORIZED=0`；这批结果可以作为当前依赖证据，不依赖不安全 TLS 环境。
- Windows 上从模块 `target` 直接运行可执行 JAR 会持有独占文件锁；最终 `clean verify` 前必须停止本项目旧原生验收进程。此次失败的 846 项 Surefire 结果全部通过，不能误报为代码红灯。
- 文件锁释放后相同 `clean verify` 命令完整通过，证明无需代码绕过；根因与修复已闭环。发布检查也证明 OpenAPI 摘要会在静态 codegen 漂移门禁中实际比较，而不是装饰性注释。
- 当前前端回归总数为 UI `794`、Playground `13`、Chromium `31`，均无跳过或失败重试；本轮新增的结构化错误断言已进入 UI 全量计数。
- Trivy 的 scanner 选择不会阻止 Java manifest 丰富化访问远端仓库；在 Maven Central 限流环境中，可靠做法是先由 Maven 验证预热依赖，再把仓库只读挂载并启用 offline scan。本轮最终报告为 0 HIGH/CRITICAL、0 secrets、0 failed misconfig，不复用 429 失败轮次。

### 最终门禁与差异终审结论

- 最终安全结论来自当前工作树 789 文件快照和当前两个镜像，不是复用旧报告：源码依赖/secret/配置以及 `sha256:2450e718...` 服务镜像、`sha256:b60afee6...` Web 镜像均无 HIGH/CRITICAL；四个 npm audit 也均为 0。
- Dependency-Check 最终仍只使用两条 Kotlin runtime 精确、限时例外；禁用在线更新后以今天已完成的 245 MB 本地数据库在 63 秒内复验成功，没有因网络失败伪造通过。
- README 的旧 `demo.png` 是真实页面但早于 Lucide 图标迁移；已替换为本轮 zero-key smoke + SSE 对话截图。浏览器返回的数据实际为 JPEG，已转码并验证 PNG 文件签名，避免扩展名与内容不符。
- `docs/PROMOTION.md` 仍引用已删除的 `demo.gif` 并声称缺演示图，`PERFORMANCE_REPORT.md` 仍使用较早一轮通过数据；两项均已同步到当前真实截图和最终性能 JSON，文档构建通过。
- 提交前只有有意的源码、测试、文档和真实 README 图片差异；本地配置、缓存、构建产物、扫描报告与临时截图均不在 Git 变更中。当前没有已知 P0/P1 或核心流程可复现 P2。

### 阶段 5 OWASP suppression 策略发现

- 安全补丁后的 E2E 真实后端明确加载 Tomcat `10.1.57`，31 个 Chromium 场景全绿，说明依赖升级没有破坏 Starter、SSE、Web Component 或核心前端交互。
- 最终桌面截图显示 1280px 级工作区在 `1440x900` 内完整展开，顶部主导航与主题/命令/GitHub 工具分组清晰；DOM 几何扫描没有横向越界、裁切或小于 32px 的可见交互目标。
- 桌面页面 smoke 与助手对话均由当前 `19014` 容器代理返回；助手响应包含请求原文、明确 Demo 标识和真实 Provider 配置边界，证明页面没有用前端固定文案伪造成功。浏览器控制台未记录 warning/error。
- CDP 网络事件与 UI 一致：6 个 smoke API 均返回真实 HTTP 200、无失败响应、无缓存伪装或事件截断；因此“全部通过”状态不是仅靠前端本地断言展示。
- `768x1024` 断点的导航重排有效：三项主入口保持可读，主题色、命令按钮和 GitHub 落到第二行；页面没有横向滚动，所有首屏交互目标达到 44px 触控门槛。
- Admin 在 `768px` 时 7 个 tab 本身都可见、可用且达到 44px，但 flex 内容比 tablist 宽约 2px，浏览器因此渲染明显横向滚动条。`<=700px` 的两列网格不会覆盖该视口；应在平板断点使用多列网格或等价无滚动布局，不能仅隐藏仍需要滚动的内容。
- `<=820px` 四列网格在 768px 的每列为 `177px`，最长的 `Tokens & Quota` 仍完整显示；第二行容纳 3 个标签。移动端继续由 `<=700px` 收窄为两列，既消除了平板滚动条，也不牺牲窄屏可访问性。
- Admin Console 的空凭据保护是可见、即时且不会触网冒充成功：点击后结果区保留具体 endpoint、0ms、失败状态和缺 Token 原因，用户可以直接诊断配置问题。
- `375x812` 的 Admin 两列网格最终几何为 `162px x 44px`，tablist 与 document 都没有横向滚动；长标签、输入区、折叠按钮和首个 endpoint 在窄屏可读且不互相遮挡。
- 移动 Assistant 的短导航标签为 `Assistant / Admin / Auto-Fill`，打开助手后对话框保留完整语义控件，没有因窄屏隐藏核心模式、模型或输入操作。
- 最终手机助手不是简单缩放桌面浮窗，而是准确覆盖整个可见视口；Header、消息、快捷模板、模式、模型和 composer 均在同一无横向溢出的交互面中，触控扫描没有小于 44px 的目标。
- 安全补丁与平板 CSS 变更后，搜索触控变量仍贯穿最终层叠：输入、前后匹配和设置均为 44px；查询高亮与 `1/2` 计数证明不仅是静态尺寸规则。
- 助手内 `Ctrl+K` 的 composed-path 守卫仍有效：最终 DOM 只有一个 Command Palette，15 项命令在窄屏可滚动但不横向溢出，搜索输入与所有 option 都达到触控门槛。
- 重复快捷键由助手命令面板自身消费并关闭，不会把事件泄漏给 Playground；助手关闭动画结束后 dialog 正常卸载，不残留透明遮罩或焦点陷阱。
- Auto-Fill 手机页面没有因长表单裁掉业务能力：文本、number、date、select、radio、checkbox、textarea、排除字段和表格批量输入均存在；样例按钮写入的剪贴板不是空占位，而是完整 13 行键值数据。
- 当前 Compose 重建实际产物已包含安全补丁：运行日志显示 Tomcat `10.1.57`；Web 镜像由当前 UI/Playground 源码重新构建，容器创建时间与镜像摘要均为本轮新值。
- 运行态仍只暴露 `19014 -> 8080`，后端没有宿主发布端口；已有 `infra-redis:16379` 与 `infra-mysql:13306` 未被 Compose 依赖或操作，满足端口和 shared-infra 边界。
- Demo benchmark 的同步与 SSE 契约都验证响应中的明确 Demo 标识，不把固定响应当真实上游 AI 性能；其价值是证明 SDK/服务/代理/流式管线在并发下的本地开销和阈值，而不是声称公网模型延迟。
- “扫描零活动漏洞”不等于 suppression 文件必须为空。当前两项 Kotlin runtime CPE 误映射已有代码路径、版本范围和构件内容证据，正确门禁应要求精确、已说明、可到期复核，而不是删除例外或放宽扫描。
- 仓库契约现在同时检查 suppression 开始标签与完整闭合条目数量，避免格式不完整的新增例外绕过逐项 `until` 校验；当前只允许一个条目、两个明确 CVE 和版本锁定的 Kotlin stdlib 家族 package URL，不接受 CPE 级屏蔽。
- 本地安全命令必须从仓库根运行并使用 CI 同一 suppression 文件，否则开发者得到的 Dependency-Check 结果与发布门禁可能不一致。

### 阶段 5 搜索触控层叠根因

- 安全门禁发现不能沿用 Trivy 单一结论：Trivy 0.72 对当前 789 文件快照报告 `HIGH/CRITICAL=0`、secret=0，但 OWASP Dependency-Check 12.2.2 的更新数据库识别到 Tomcat 10.1.55 的 4 个 CVSS 9.1；必须以更严格结果修复后再验收。
- 依赖路径已核实：Tomcat/Jackson 来自 Spring Boot 3.5.16 BOM，Log4j/Commons Lang 来自 POI，PDFBox 为直接依赖，Swagger UI 来自 springdoc，Kotlin 1.9.25 仅来自可选 OkHttp 4.12。Maven Central 已提供 Tomcat 10.1.57、Jackson 2.21.5/2.18.9、PDFBox 3.0.8、Commons Lang 3.18.0、Log4j 2.25.5、Swagger UI 5.32.8。
- Swagger UI 5.32.8 的上游 `package.json` 明确依赖 DOMPurify `^3.4.11`，高于报告中 3.4.7 修复线。Kotlin 的 CVE-2026-53914 描述限定为编译器 build-cache metadata，`kotlin-stdlib-1.9.25.jar` 不含 compiler/build-cache 类；CVE-2020-29582 又只影响 1.4.21 之前版本，因此两项均为 runtime 包 CPE 误映射，可做包版本精确、定时到期例外。
- 最终 ODC JSON 中 `dependencies=404`、`activeVulnerabilities=0`、`suppressedVulnerabilities=2`；suppression 只匹配 `org.jetbrains.kotlin:kotlin-stdlib[-common|-jdk7|-jdk8]@1.9.25`，不会覆盖 compiler、Gradle plugin 或其他 Kotlin 构件。
- Playground 的 `@ai-assistant/vue` 是指向本仓 `ai-assistant-ui` 的 Junction，`dist/style.css` 也包含移动触控变量，因此“旧本地包”假设不成立。
- Chromium `CSS.getMatchedStylesForNode` 给出决定性证据：最终计算值为 `height/min-height: 26px`，来源是 `99-enterprise-overhaul.css` Round 32 的固定 `26px !important`；该规则位于变量化规则之后且同等高优先级。
- 根因修复应让 Round 32 读取既有变量，而不是新增更强覆盖：桌面 fallback 保持 `26px`，`<=820px` 自动使用 `44px`。同段搜索导航按钮也必须读取 `--ai-search-nav-size`，避免输入查询后出现隐藏的触控回归。
- 真实查询状态证明变量链生效：搜索输入为 `209x44px`，两个匹配导航按钮和设置按钮均为 `44x44px`；截图目视无裁切、遮挡或布局跳动，全部可见交互目标扫描无小于 `44px` 项。

### 阶段 4 助手图标审计

- 真实浏览器发现 Playground 与助手各注册一套 `Ctrl+K`；当焦点在助手输入框时两个监听器均响应，DOM 中同时出现两个 `dialog "命令面板 / Command Palette"`。修复应在 Playground 全局监听器识别助手交互边界并忽略该事件，不能禁用助手自身快捷键，也不能破坏页面级命令面板。
- 根因修复采用 `shouldHandleShortcut` 守卫，不改变默认全局 API；Playground 仅拒绝 composed path 中包含 `.ai-assistant-wrapper` 的快捷键事件。`CommandPalette` 自身消费 Ctrl/Meta+K，避免 Teleport 搜索框中的二次冒泡。回归覆盖助手内不打开页面面板、页面级快捷键仍打开，以及面板内快捷键关闭且不泄漏到 window。
- 真实浏览器复验与单测一致：初次快捷键只有助手命令面板，重复快捷键关闭它且没有打开 Playground 面板；浏览器控制台没有 warning/error。该 P2 已关闭。
- 桌面真实自动填表预览为居中 `720x765` 模态，13 条键值全部匹配 13 个字段；填入后的 textbox/spinbutton/date/select/radio/checkbox/textarea 均显示预期值，scanner 明确排除的两个输入保持空。立即点击状态 Toast 中“撤销”后全部恢复初始值，证明 15 秒恢复窗口在真实浏览器可用。
- 平板导航按预期拆成主导航与工具两行，`scrollWidth=clientWidth=768`，没有文字遮挡或布局跳动；Admin 为 768px 无越界，Form 页面考虑滚动条后 document width `753px`、无越界。助手位于 `(264,480)-(746,1002)`，不越过视口。
- 手机 Demo 的 `window.innerWidth=375`、滚动条后 `document.clientWidth=scrollWidth=360`；无越界且首屏控件无小于 44px。助手为 `(0,0)-(375,812)` 全屏，消息完成后 `.ai-msg` 宽 `343.2px`、助手气泡右边界 `340px`，不存在截图观感上的实际裁切。
- SSE 生成期间 `.ai-progress-bar-fill` 使用负向 transform，边界短暂到 `-92px`，但父级 `.ai-body` 为 `overflow-x:hidden` 且完成后节点移除；这是受控进度动画，不是文档横向滚动。命令面板行项目均 `scrollWidth=clientWidth=325`；当时唯一触控缺口是 search input `242x20px`，其外层行虽为 73px，但可聚焦目标本身不足 44px。
- 搜索 input 增加移动端 `min-height: 44px` 并重建 Web 后，真实浏览器实测为 `242.45x46px`；面板 `343.2x617.11px` 完整落在 `375x812` 视口，document/面板横向溢出均为 `0`，面板内可见 input/button/option 无小于 `44px`。命令项内容最右边界 `332.8px` 小于 item 右边界 `344.8px`，证明工具内图片预览的右侧裁切观感不是页面缺陷。
- 手机 Admin 首轮页面本身无横向溢出且控件达到 `44px`，但 `.admin-app-tabs` 为 `scrollWidth=722/clientWidth=328` 的嵌套横向滚动，只显示前三个入口；这违反本 Goal 的移动端无横向滚动要求。根因是重载样式强制 `flex-wrap: nowrap` 与 `overflow-x: auto`。
- 修复仅覆盖 `<=700px`：tablist 改为两列网格并保留桌面/平板规则。最新真实浏览器中 tablist `scrollWidth=clientWidth=328`，7 个按钮各 `162x44px`，逐项切换后的选中状态和 panel 控件均正确，document 横向溢出与 console warning/error 均为 `0`。
- 手机 Form Auto-Fill 全页高 `3875px`、document `scrollWidth=clientWidth=360`，没有越界或内部横向滚动容器；3 个 radio 和 4 个 checkbox 的原生输入为 `18px`，但每个关联 label 的真实点击区域为 `268.8x44px`，因此触控门槛按有效交互目标通过。批量表格在 360px 文档宽度内完整显示 3x3 输入区。
- Starter 首页首次真实浏览器基线无横向溢出，但 Web Component 入口链接高 `21.6px`、Chat/Translate/Summarize 按钮高 `32.8px`；Web Component 页返回链接高 `18.4px`，同时两个静态页仍使用 12px 卡片与旧单色样式。该问题只在宿主页面 CSS，不在 Starter/API/WC 协议。
- 两页样式已收敛为中性工作台：交互链接和按钮至少 `44px`、手机命令按钮单列、边框/6px 圆角/焦点态一致；首页增加输入 label 和动态 `aria-live`，Web Component 仍只加载本地 `/vue-dist` 资产。新增 Starter 集成测试直接 GET 两页并固定这些契约。
- 重启一键 Starter 后，三视口两页 document overflow 均为 `0`；手机/平板小于 `44px` 的有效交互目标为 `0`。手机真实同步 Chat 返回 Demo marker 且 stats 从 0 更新，真实 Web Component SSE 返回同一 marker；助手面板手机 `375.2x812`，平板/桌面 `480x520`，浏览器 console warning/error 为 `0`。
- 最新 Compose 解析结果仅含 `ai-assistant` 与 `web`；本次容器镜像分别为 `sha256:44b96c...` 与 `sha256:47b000...`，均在重建后 healthy，宿主应用端口仅为 `19014`。
- 运行态脚本 zero-key smoke `8/8` 通过且前端响应头完整。后端启动日志只有明确的零密钥 Demo 安全提示、SpringDoc 开发端点提示，以及一个 `commons-logging.jar` 冲突提示；前两类符合显式 Demo 配置，Commons Logging 依赖提示需在全量依赖审计时确认是否可消除。
- 真实浏览器桌面 `1440x900`：`scrollWidth=clientWidth=1440`、横向越界元素 0、可见控件中的旧 emoji 0、main/article `1216px`；视觉为中性开发者工作台，无渐变或嵌套装饰卡片。
- 图标迁移后的 UI 全量结果为 `100` 个文件、`787/787`；publish build、27 路径包导出、ESM/CJS/Web Component/type declarations 均通过，新增官方 Lucide 依赖的 npm audit 为 0 漏洞。
- 最新 bundle gate 没有超预算退出：总 gzip `1235.30 KB`，较 baseline `+19.88 KB (+1.6%)`；chunks `+27.76 KB (+4.8%)`，Web Component group `-8.54 KB (-1.5%)`。`ai-assistant-wc.mjs` 的 `+0.13 KB (+10.1%)` 是极小文件的相对增幅，不能单独据此刷新 baseline，需结合 Lighthouse 和首屏资源复验。
- 浏览器发现的 emoji 来自四个明确渲染入口：四语言模式标签、`ChatInputComposer` 快捷开关、`useEmptyStateContent` 的技能/Starter/能力数据，以及命令面板/Artifact 卡片。
- reaction、消息归档的图片前缀和工具调用痕迹属于用户数据或协议文本，不应按装饰图标清理。
- UI 包当前没有图标运行依赖。为保证 Vue library 与 Web Component 都能直接渲染且不要求宿主额外安装，采用官方 `@lucide/vue` 并让 Vite 将实际使用的图标树摇进产物；空状态和命令数据改用稳定语义图标名，由组件集中映射。
- 命令面板的 `CommandItem.icon` 是宿主可提供的扩展字段；实现保留未知字符串的文本回退，只有内置命令迁移到语义图标名，因此不会强制已有集成修改自定义命令。
- 新一轮源码残留检索只命中 reaction、图片消息归档前缀、工具调用痕迹清洗规则及一条注释；前几项属于业务/协议数据，不能删除。内置模式、快捷动作、空状态、命令和 Artifact 已无可见 emoji 数据。
- `npm install` 明确只新增 1 个包；Vitest 3.2.7 在安装前红灯测试中已经生效，因此锁文件相对 `HEAD` 的其余依赖变化属于既有受保护改动，不能为缩小本轮 diff 而反向覆盖。
- Unicode 扩展扫描补充发现问候语、声音/Code Wall 开关、Header 主题/多选、Artifact 运行工具栏、错误重试和会话抽屉仍直接渲染字符图标；这些是内置控件而非 reaction/消息协议数据，应继续迁入同一 Lucide 映射。
- 第二批迁移后扫描只剩 reaction 定义、图片消息前缀、工具调用清洗协议和对应测试夹具；`A↔B` 是对比关系标签。没有继续改动这些数据语义。

### 阶段 3 安全审计：追踪字段边界

- `TracingFilter` 以 order `-4` 运行，早于 `TenantFilter`（`-2`）和 `RequestIdFilter`（`-1`），因此后两者的规范化不会保护追踪 MDC。
- 当前实现会把原始 `X-Tenant-Id`、`X-User-Id` 写入 MDC；`X-Request-Id` 只检查非空，`traceparent` 只检查长度后固定截取。攻击者可污染结构化日志/追踪字段，并可让不可信 request id 出现在 `X-Trace-Id` 响应头。
- 修复需要严格验证 W3C `traceparent`（版本、32 位 trace id、16 位 parent id、flags、非全零），并对 request/tenant/user 标识应用长度与字符白名单；无效值应生成 trace id 或不写可选 MDC 字段。
- 已按上述边界完成修复：合法 v00 W3C traceparent 与安全 request id 保持兼容；无效 trace 生成 32 位 hex，非法 tenant/user 不进入 MDC。新增测试覆盖控制字符、HTML 字符、全零 id、非法版本、大小写、异常清理。

### 阶段 3 安全审计：认证、CORS、上传、内容过滤

- 主认证在配置 access token 后覆盖 assistant context，唯一匿名例外是非 deep 健康检查与 CORS OPTIONS；Admin 由独立过滤器保护，未配置 admin token 时 fail closed。query token 默认关闭并受显式开关控制。
- CORS 仅注册 assistant context，未启用 credentials；默认 wildcard 会产生安全姿态告警。当前没有专门的 `AiAssistantCorsConfigTest`，需补配置契约测试，防止未来误开 credentials 或放宽路径。
- 上传控制器限制 10 MiB、扩展名和声明的 MIME；当 MIME 缺失时会继续交给 `FileParserService`，必须核对后者的文件签名、解压和文本边界，才能判断上传基线是否闭环。
- `ContentFilter` 默认对输入/输出做 PII 脱敏，并对 prompt injection 产生不含正文的长度型告警；该需求是“告警”而非强制阻断，当前语义与验收标准一致。
- `FileParserService` 已校验 PDF/ZIP/OLE 魔数并限制抽取字符数，Spring Demo/独立服务也限制 multipart 为 10 MiB；但现有测试只覆盖截断与 Controller 的 MIME/扩展名，缺少空文件、大小和魔数回归。
- `FileParserService` 当前把调用方提供的原始文件名写入 info/error 日志；带控制字符或 PII 的文件名可能污染普通文本日志，需改为仅记录不可逆短指纹或规范化的非身份元数据。
- `targetLang` 原先从 REST/文件/批处理/WebSocket 直达 `LlmRequestBuilder` 并拼入 system prompt，绕过正文 `ContentFilter`；已在 `LlmService` 配额/缓存之前统一规范为受限语言标签，并拒绝带空格、换行、下划线或超长子标签的值。
- 服务层拒绝非法 `targetLang` 后，REST 同步接口原先会被通用 catch 映射为 503，兼容流接口可能成为 500，WebSocket 只返回供应商故障文案；这会混淆 4xx 输入错误和 5xx 外部故障，需补 DTO 校验及各传输层请求错误映射。
- 上述错误模型已收敛：DTO 与服务双层校验，REST/兼容 SSE/标准 SSE 返回 400，WebSocket 返回 `INVALID_REQUEST` JSON，批处理返回逐项 `INVALID_REQUEST`；普通供应商异常仍保持原 503/流式 error 语义。
- 阶段 3 安全回归组 151 项全通过，覆盖认证、Admin、CORS、租户、request/trace ID、限流、SSRF/DNS pinning、上传、PII/注入、请求/响应过滤和运行时配置。连续增量定向测试使 JaCoCo 报告提示旧执行数据类不匹配，最终覆盖率证据必须来自 `clean` 后全量测试。
- `RuntimeConfigController` 只返回“是否配置”与计数，运行时密钥持久化使用 AES-GCM；但 `ProviderConnectivityChecker` 原先会把完整 provider URL 与最多 200 字符的上游错误正文写入结果/日志，上游回显凭据或 URL query/userinfo 含密钥时可能泄漏，且控制字符可污染文本日志。
- 能力矩阵把 WebSocket 处理器测试列为证据，但此前只有握手配置测试；同时未知 action 会静默走 chat。已补处理器测试并将未知 action 收敛为 `INVALID_REQUEST`。
- 独立服务的默认 Provider 已从隐式 `openai` 迁移为明确 `demo`，生产 Compose 仍为 `openai`；原 `CHANGELOG` 未记录迁移影响，已在 Unreleased 中补充显式环境变量要求。
- OpenAI-compatible 契约组在大量 Spring 上下文之后曾因测试专用 2 秒超时抖动一次；隔离用例真实收到 503 并通过。契约夹具调整为 5 秒以容纳 Windows Reactor/Netty 冷启动，生产 60 秒默认与 401/429/503 断言未变。
- 可观测性实现与文档一致：独立服务由 Actuator 提供 liveness/readiness，AI Provider 状态由 `AiAssistantHealthIndicator` 上报；三个核心 gauge 仅在存在 `MeterRegistry` 时装配，新增 2 项数值契约测试；OpenTelemetry tracing 与 JSON logging 由 support artifact 以 optional 依赖和显式配置提供，不会在 Starter 中默认强制开启。
- 阶段 4 重建环境只使用 `docker-compose.demo.yml` 的应用与 Web 两个无状态服务，不会启动 Redis/MySQL；本地 `.env` 选择了外部 DeepSeek Provider，故保留不动并改用被忽略的 `.env.local` 显式固定 `demo`、空 Key 和宿主 `19014`，容器内部仍为原生 `8080`。
- 真实浏览器 `1440×900` 首屏功能可用：页面内 6 项零密钥 smoke 全通过，成功状态立即展示，浏览器控制台无 warning/error。视觉缺陷是内容宽度过窄、首屏下半部大面积空白，主页面被单一卡片式 article 包裹；导航仍使用 🤖/🛠/📋/⌘/↗ 等 emoji/字符图标，整体配色接近单一浅青色，需整改为更安静的开发者工具界面并使用现有图标库。
- 桌面端助手对话通过真实页面输入与 SSE 后端链路：发送按钮在填入文本后启用，约 0.1s 返回，回复显著包含 deterministic Demo marker 与真实 Provider 配置边界，控制台无 warning/error。面板入场动画约 600ms 后 opacity=1、尺寸约 482×522 且未越界；首次截到的半透明画面是过渡帧。组件内 tab/快捷动作仍大量使用 💬/🌐/📝/🧠/⚡/❤️/⭐/📌 等 emoji，次级图标偏小，与 Playground 视觉语言不统一。
- Admin Console 未填 Token 时在前端 0ms 拦截并明确提示“请先在顶部填写 Admin Token”，失败结果和最近状态可见，控制台无异常，权限不足未伪造成成功。视觉上继续存在外层工具卡内嵌按钮卡/结果卡、📊/🔑/📝/🧠/⚖️/🪂/🧩 emoji 标签以及宽屏大面积留白。
- Form Auto-Fill 页面有真实表单、scanner 排除字段、批量表格和清空/检查动作，输入均有可访问名称；点击中文样例后真实写入 13 行剪贴板并给出成功反馈。桌面首屏只显示长页面上半段，内容仍限在约 806px，三张样例卡与表单卡形成多层卡片，复制动作使用 📋 字符图标。
- 粘贴中文样例会真实弹出“自动填入表单”预览，13/13 映射均可选择并显示置信度；确认后文本、number、date、select、radio、checkbox、textarea 全部写入正确，两个 scanner 排除字段保持空白，失败 0。可复现问题：成功 Toast 的“撤销”按钮在下一次真实浏览器操作前已自动消失，恢复窗口过短，需延长并补回归测试。
- `768×1024` 实测 `scrollWidth=clientWidth=768`，无横向滚动，主体状态完整。顶部仍把三项导航、五个色板、命令按钮和 GitHub 强塞在单行，导航标签出现 2-3 行换行，信息扫描效率差；需在平板断点重排导航与辅助控件。
- `375×812` 主页面实测无横向滚动和元素越界，但 5 个色板仅 32×32、命令按钮和 smoke 按钮高 40px，未达到 44px 触控目标；导航分成三行仍拥挤，固定悬浮球会盖住长 smoke 列表右下内容。助手打开后占满移动视口，消息、输入与发送区可见且未白屏。
- 阶段 4 源码复核确认上述问题不是浏览器瞬态：`App.vue` 主导航、复制动作和外链直接使用字符/emoji，`AdminDemoPanel.vue` 的 7 个标签以 `emoji` 数据字段渲染；页面还用窄主容器和多层卡片组织。视觉整改必须在保留现有 API/表单行为的前提下替换图标、扩宽工作区并在平板/移动断点重排。
- Playground 当前仅依赖 Vue 和本地 UI 包，没有图标库；为避免手写 SVG并保持图标可访问、可树摇，将只在 Playground 增加官方 `@lucide/vue` 运行依赖并同步锁文件。
- 2026-07-22 从 npm registry 核对到 `@lucide/vue` 当前版本为 `1.25.0`；旧名 `lucide-vue-next@1.0.0` 已由 npm 标为 deprecated，未纳入最终方案。Playground 测试按可见文本/类名定位，不依赖现有导航 emoji，替换图标不会破坏现有行为断言。
- `@lucide/vue@1.25.0` 不导出品牌 `Github` 图标，首轮 App 测试因此产生 undefined vnode 告警；改用已存在的 `GitFork` 仓库符号，并保留“GitHub”可见文本与链接语义。
- 助手组件移动触控缺陷由 `99-enterprise-overhaul.css` 尾部的集中令牌造成：430px 断点把 header/empty/composer/context/quick/secondary/send 分别设为 36/40/32/32/34/34/40px，和真实浏览器测量完全对应。可用最小范围令牌修复，再单独覆盖未使用令牌的搜索、消息动作与 reaction。
- 消息复制/重试/编辑/反馈按钮在最终级联中硬编码为 24px，搜索输入与搜索导航硬编码为 26px；它们不读取移动令牌，必须在最终 430px 媒体查询内显式覆盖到 44px，不能只改变量。
- Reaction 按钮由 `MessageReactionBar.vue` 的 scoped 样式独立控制，当前仅靠 4px×8px padding 形成约 35×22px 目标；为避免异步组件 CSS 顺序影响，reaction 在组件内加移动规则，其余核心控件在 99 文件末端以 820px 断点覆盖，覆盖 375 与 768 两类触控视口。
- 重建容器后浏览器首轮 DOM 已确认新资源生效：375px 导航显示 Assistant/Admin/Auto-Fill 短标签且不换行，可访问树包含主题 radiogroup、命令按钮和 GitHub link 的明确名称，旧导航 emoji 已消失。
- 当前 in-app Browser 后端的 Playwright/CUA 截图方法缺失，但标签明确提供 CDP capability，公开 `send(method, params, options)`；后续用 `Page.captureScreenshot` 获取同一真实浏览器画面，并用 `Runtime.evaluate` 统一测量视口、溢出和触控盒。
- 新版 `1440×900` 实测：document `scrollWidth=clientWidth=1440`、越界元素 0，page 1280px、main/article 1216px（旧版约 816px）；article 背景透明、标题实色、body 中性灰。导航 primary 762px、tools 434px，命令与 GitHub 均完整落在视口内。
- 新版桌面页面内 6/6 zero-key smoke 真实点击通过；助手经异步加载真实打开，Demo 模型、禁用发送与面板语义正常。剩余视觉一致性问题：助手内部 Mode tabs 和快捷动作仍直接显示 💬/🌐/📝/🧠/⚡ 等 emoji，阶段 4 继续收敛。
- 内部 emoji 已精确定位：Mode tabs 的符号混在四语言 i18n 文案中，快捷动作在 `ChatInputComposer.vue` 写死；reaction emoji 属于用户反应数据，应保留。收敛方案是给 UI 包引入同一官方 Lucide 依赖、Mode/quick controls 用组件图标，并把 i18n 文案恢复为纯文本。

- 当前分支为 `main`，`HEAD` 与 `origin/main` 同在 `2984a22`；任务开始时工作树已有 127 个已跟踪文件差异和多个未跟踪实现/测试文件。
- 既有 `task_plan.md` 明确标为截至阶段 13.52 的历史归档，`progress.md` 最新记录停在 2026-05；历史绿灯不能作为本轮完成证据。
- 仓库根目录没有 `AGENTS.md`；本轮遵守用户消息内给出的全局 AGENTS 规则。
- 当前 Goal 的硬门槛包括真实浏览器三视口、zero-key/Starter/standalone/Web Component/Playground 闭环、性能与安全证据、干净 clone 一键启动，以及最终可解释 Git 状态。
- `acceptance-orchestrator` 要求的 `create-issue-gate`、`closed-loop-delivery`、`verification-before-completion` 子技能未安装；按其状态机与完成证据契约直接执行。
- 当前 diff 规模较大，必须逐文件审计并通过本轮测试确认，不能假设它们均属于已完成成果。
- README/README_EN 已把 `demo` Provider 明确标为 deterministic mock，并声明真实 Provider 失败不会静默回退；这满足“Mock 不冒充真实能力”的文档方向，仍需代码和 HTTP 测试验证。
- README 声称 Starter、独立服务、Java Client、Vue 与 Web Component 属于稳定核心，高级 RAG/Agent/MCP/WebSocket/Admin/Artifact 不属于 v1 稳定承诺；需与 `docs/CAPABILITY-MATRIX.md` 和代码逐项对齐。
- README 默认端口仍为产品原生 `8080/3000`。本轮并行运行必须通过被忽略的本地配置映射到 `19010-19019`，不能为验收修改默认配置。
- `PERFORMANCE_REPORT.md` 记录了 2026-07-21 的接口与 Lighthouse 数据，但本轮不能复用为新证据，必须在当前 commit/diff 上重新测量。
- `SECURITY.md` 仍描述默认进程内限流，而当前 diff 新增 `.github/ci/redis.yaml`；需核对分布式限流实现、故障策略、测试和文档是否一致。
- `docs/CAPABILITY-MATRIX.md` 已把 Starter、独立服务、Java Client、OpenAI-compatible、Function Calling、安全基线、Vue、Web Component 与 Playground 列为 `stable`；RAG/Agent/MCP/WebSocket/Admin/Artifact 等均明确降为 `experimental` 或 `documented-only`，Demo Provider 为 `mock-only`。这些只是待验证声明，本轮必须逐项匹配新测试或运行证据。
- 根 Maven POM、Vue 包和 Playground 当前版本均为 `1.0.1`，根聚合器包含 server、observability support、service、client 与新增 demo 模块；版本口径已比旧记录中的 `1.0.0-SNAPSHOT` 前移，仍需运行版本一致性、打包与全新消费验证。
- 当前工作区差异为 130 个已跟踪文件、约 `4013` 行新增与 `2502` 行删除，另有未跟踪实现/测试；主要改动集中在 Playground、README、客户端/Provider、真实后端 E2E 和演示启动脚本，审计与回归范围必须覆盖这些区域。
- 新增 `ai-assistant-demo` 是真实 Spring Boot Starter 宿主，包含随机端口 HTTP/SSE 集成测试、同步 API 页面和加载发布构建 Web Component 的页面；Demo 回复与健康状态均明确标识 `provider=demo` / `mock=true`，没有用静态前端结果伪装后端能力。
- Starter Demo 的 Maven `process-resources` 只复制 `ai-assistant-ui/dist` 中已存在的 Web Component 产物，Maven 自身不会构建前端；一键脚本必须先执行锁定依赖安装和 UI publish build，否则静态 Web Component 页面可能缺资源，需从干净目录实测。
- Starter 两个静态页面当前仍是通用系统字体、卡片式布局与单一靛蓝/浅灰配色，状态与基本禁用反馈存在，但设计、移动端和可访问性尚未有本轮浏览器证据，不能据代码标为页面验收通过。
- CI 已覆盖 server 的格式/测试/覆盖率、UI lint/格式/构建/测试/包安装、真实 Starter 后端 Playwright、文档与 Compose zero-key smoke；但 backend job 直接以 `ai-assistant-server/pom.xml` 为入口，Java Client、Service 和 Starter Demo 的独立 Maven 测试覆盖需要从根 Reactor 本轮验证，并检查 CI 是否有同等门槛。
- 默认 Compose 未启动 MySQL/Redis 等通用基础设施；本轮 zero-key 不需要它们。所有本机容器验收将通过被忽略的 `.local` 覆盖把宿主端口限制在 `19010-19019`，保留仓库默认 `8080/3000` 和容器内部原生端口。
- Java Client 当前 diff 已统一发送 `X-AI-Token` / `X-Tenant-Id`，校验租户 ID，保留响应 `X-Request-Id`，支持多行 SSE data，并把流内 `RATE_LIMITED`/`TIMEOUT` 等标记转成结构化 `ApiException`；相关本地 HTTP 测试已存在，仍需本轮 Maven 验证。
- `ProviderAwareChatCompletionClientTest` 使用本地 `MockWebServer` 证明同一实例可从明确 Demo 切到真实 OpenAI-compatible HTTP，并验证真实路径发送 `Bearer` 认证且 Demo 路径不触网；这属于适配契约证据，不等同于公网供应商实测。
- Demo 模式通过 `resolveLlmCredentials()` 注入只在内部轮换器使用的非密钥哨兵，实际 transport 选择 `DemoChatCompletionClient`；显式真实 Provider 仍走 `OpenAiCompatibleChatClient`，没有代码级静默回退路径。
- 独立服务 `application.yml` 默认 Provider 已从 `openai` 改为 `demo`，属于安全但可感知的默认行为变化；必须核对 CHANGELOG/迁移说明，并验证显式真实 Provider 的不可用、鉴权拒绝与限流错误可诊断。
- Runtime model config service/controller 现在仅在 `admin-enabled=true` 时注册，避免默认启动加载用户目录中的持久化管理配置；测试覆盖了关闭 Admin 时不读取旧状态。
- Vue 公共 API 与 Web Component 已加入 `tenantId` / `tenant-id`，与 Java Client 使用同一 `X-Tenant-Id` 校验规则；同步响应带 request id，流式错误使用 `AiAssistantApiError` 暴露 status/errorCode/requestId。
- 租户请求会强制回到 SSE，且 SSE 失败时明确拒绝回退到当前不能保留租户头的 WebSocket；这避免了租户隔离语义在传输切换时静默丢失，已有针对性 Vitest。
- Web Component 修复了 `endpoint`/`base-url`、`token`/`access-token` 别名同步时后一个缺失别名覆盖已有值的问题，并加入新单测；公共构建导出同时暴露 `postChat`/`streamChat`/结构化错误。
- Playground 当前有 Demo、Admin、Form Fill 三个真实交互视图、延迟加载组件、零密钥 health/provider/chat/stream smoke 清单和助手加载失败状态，不是静态首页；但 `App.vue` 仍约 1800 行，导航使用 emoji/字符图标，主题依赖多套彩色梯度，需真实浏览器审计视觉一致性、可访问名称和三视口布局。
- Playwright 现有用例覆盖 375×812 移动面板几何/触控目标、reduced motion、键盘菜单、取消、模型错误、诊断、会话、prompt history 等；多数网络交互使用严格测试替身，另有 `web-component-real-backend.spec.ts` 通过真实 Starter Demo 验证 `tenant-id`、SSE Content-Type 与明确 Demo 回复。
- E2E 的真实后端由 `e2e/start-real-backend.mjs` 本机启动，不是容器；它打包 `ai-assistant-demo` 并强制 Demo Provider，前端跑在本机 5273。容器宿主端口限制不受该本机测试端口影响，但最终容器验收仍单独使用 19010-19019。
- `demo-standalone` 一键脚本会创建缺失的 `.env`、构建两个容器并执行 health/chat/SSE smoke；`demo-starter` 一键脚本会 `npm ci`、构建 publish/WC、Maven 打包并阻塞启动，但脚本自身没有启动后 smoke，干净环境验收需另进程启动后执行 `smoke-zero-key` 并记录耗时。
- `smoke-zero-key.mjs` 明确检查 health、liveness、readiness、stats、runtime config、provider health、同步 chat 与 SSE，并要求 `mode=demo`/`mock=true`/Demo marker；失败非零退出，适合作为零密钥验收入口。
- 本机环境满足文档基线：Java `21.0.8`、Maven `3.9.11`、Node `22.22.0`、npm `10.9.4`、Docker Engine `29.6.1`、Compose `5.3.0`。
- 任务恢复时已有本项目 Demo 栈：Web 仅发布 `19014 -> 8080`，后端只在 Compose 内网暴露 8080；通用 `infra-redis`/`infra-mysql` 分别复用宿主 `16379`/`13306`，没有本项目重复基础设施容器。
- 对现有 5 小时前构建的 Demo 栈运行 zero-key smoke，8 项检查全部通过；它证明当前运行基线可用，但不是当前工作树重建后的最终证据，后续必须重新 build。
- `node scripts/check-version-consistency.mjs` 当前通过，版本口径为 `1.0.1`；`git diff --check` 当前无空白错误，仅报告可解释的 CRLF/LF 工作区提示。
- 当前工作树首轮 Java Reactor 基线通过：server `793`、Java Client `14`、Starter Demo `2` 项测试全部零失败，Reactor `BUILD SUCCESS`，耗时约 1 分 20 秒。
- Vue 协议针对性基线通过：`api.spec.ts`、`web-component.spec.ts`、`useStreamWithFallback.spec.ts` 共 `64` 项零失败。
- `project-health-check --release-check-fast` 通过：`82` 项脚本测试、版本一致性、静态 OpenAPI 类型与快照、依赖足迹、CSS budget、support dependency boundary 均通过。
- fast release gate 输出警告当前进程环境 `NODE_TLS_REJECT_UNAUTHORIZED=0`；尚无证据表明仓库脚本设置该变量。最终安全/发布验收必须在显式清除该变量的子进程中复跑，避免把关闭 TLS 校验的环境当可信证据。
- 首轮完整前端 gate 唯一失败是 `useStreamWithFallback.spec.ts` 的 Prettier 格式；用仓库锁定 Prettier 格式化单文件后，UI ESLint、Prettier 全量检查均通过。
- UI 全量 Vitest 当前通过：`95` 个测试文件、`779` 项零失败；Playground 通过 `2` 个文件、`12` 项零失败。
- `mvn package` 根 Reactor 当前通过，server/聚合器/observability support/service/client/demo 六项全部 `SUCCESS`；其中 server `793`、support `2`、client `14`、demo `2` 项测试通过，独立 service 当前无自身测试源码但由 server 集成与后续 HTTP/Docker smoke 覆盖。
- `npm run build`（Vue publish）当前通过：主库、Web Component、类型声明均生成，`Package export check OK (27 paths)`；当前产物约 main gzip `226.26 kB`、WC gzip `251.28 kB`、CSS gzip `61.88 kB`，需由既有 bundle budget gate 判断是否回归。
- Vue 包消费 smoke 当前通过：从 `npm pack` 生成的 `@ai-assistant/vue@1.0.1` tarball 在全新系统临时目录安装，ESM/CJS/WC/CSS 共 `8` 个公开入口全部解析；tarball 约 `1.3 MB`、解包约 `5.2 MB`。
- Playground 与 VitePress 文档构建当前通过。Playground 构建报告 Mermaid core `551.68 kB`、Wardley `615.46 kB` 的按需 chunk 警告，主 `AiAssistant` chunk约 `400.35 kB`（gzip `126.87 kB`）；是否构成性能问题由首屏网络与 Lighthouse/budget 实测决定。
- 包消费 smoke 再次继承本机 `NODE_TLS_REJECT_UNAUTHORIZED=0` 警告；虽然安装与解析成功，最终 clean consumption 需要在清除该变量的进程/干净目录重跑。
- 在显式清除 `NODE_TLS_REJECT_UNAUTHORIZED` 的子进程中，`project-health-check --release-check-full` 通过且无 TLS 绕过警告；82 项脚本、OpenAPI、Vue publish build、依赖/CSS/bundle gates 全绿。总 gzip 比 baseline 下降约 `0.8%`，WC group 下降约 `4.0%`。
- 完整 Playwright E2E 当前通过 `31/31`（约 1.8 分钟）：套件自动打包并启动真实 Starter Demo，真实 Web Component 场景验证 `X-Tenant-Id`、SSE Content-Type 与 Demo 标识；其余场景覆盖移动端、reduced motion、取消、键盘、诊断、provider config、会话与历史。
- 阶段 2 唯一实际阻断是单个测试文件格式，已修复并有全量复验；当前没有已知可复现功能基线失败。

## 项目结构

- `ai-assistant-server`：Spring Boot Starter，包含核心后端能力、控制器、配置、安全、RAG、工具调用、导出、限流、多租户等模块。
- `ai-assistant-client`：Java 客户端 SDK。
- `ai-assistant-service`：独立 Spring Boot 服务，面向 Docker 或直接运行。
- `ai-assistant-ui`：Vue 3 组件库，包含组件、composables、工具函数、Vitest 测试和库构建配置。
- `ai-assistant-vue-playground`：前端 Playground。
- `docs`：VitePress 文档站。
- `e2e`：Playwright 端到端测试。
- `scripts`：版本一致性和冒烟测试相关脚本。

## 已确认的轻量验证命令

- `node scripts/check-version-consistency.mjs`
  - 结果：通过。
  - 输出：`Version consistency OK: Maven 1.0.0-SNAPSHOT, npm 1.0.0`

## 当前工作区注意事项

本次开始前已有以下文件存在未提交改动，需要避免覆盖：

- `.github/workflows/ci.yml`
- `.gitignore`
- `e2e/playwright.config.ts`
- `e2e/package-lock.json`

## 发现的问题

### 文档站侧边栏存在缺失页面

`docs/.vitepress/config.ts` 中配置了以下页面，但当前 `docs/guide` 和 `docs/api` 下没有对应 Markdown 文件：

- `/guide/configuration`
- `/guide/chat`
- `/guide/function-calling`
- `/guide/mcp-server`
- `/guide/plugins`
- `/guide/kubernetes`
- `/api/chat`
- `/api/capabilities`
- `/api/admin`

影响：
- 文档站侧边栏会展示可点击入口，但用户点击后进入 404。
- 新用户会误以为相关能力没有文档或项目文档不可用。

建议：
- 补齐这些页面，先提供稳定的概要、配置入口、关键 API 和跳转关系。
- 后续再按模块深入拆分长篇 README。

处理结果：
- 已补齐以上 9 个页面。
- 已运行 `cd docs && npm run build`，构建通过。
- 构建中曾出现 `env` 代码块语言未加载警告，已把本次新增页面中的 `env` 代码块调整为 `text`，重新构建后无该警告。

### 轻量健康检查入口

新增 `scripts/project-health-check.mjs` 后，可以运行：

```bash
node scripts/project-health-check.mjs --docs
```

当前该命令会执行：

1. `node scripts/check-version-consistency.mjs`
2. `cd docs && npm run build`

脚本还预留了：

- `--ui-test`
- `--server-test`
- `--all`

处理过程中的 Windows 兼容性结论：
- 直接 `spawnSync('npm.cmd')` 在当前环境中会触发 `EINVAL`。
- 手工拼接 `cmd.exe /c` 命令容易出现引号转义问题。
- 当前实现使用 `shell: true` 交给 Node 处理 Windows 命令解析，验证通过。

### README 入口信息分散

`README.md` 当前超过 1600 行，包含功能清单、架构、配置、API、部署、FAQ 和性能说明。大量内容与 `docs/guide`、`docs/api` 中的页面重叠，新用户第一次进入仓库时不容易判断应该先看哪一页。

处理结果：
- 已在 README 顶部新增“先看这里”，把高频入口集中到文档站页面。
- 已在 `docs/guide/index.md` 中补充“从哪里开始”和“文档地图”，按接入场景引导用户选择 Starter 集成、独立服务、前端连接或上线检查。
- 已在 `docs/guide/quick-start.md` 中说明本页默认使用 Starter 集成，并把独立服务用户引导到独立部署文档。

验证：
- 已运行 `node scripts/project-health-check.mjs --docs`，版本一致性检查和文档站构建均通过。

后续建议：
- 继续把 README 中的大段配置、API、部署和高级能力说明迁移到 VitePress 独立页面。
- 每次迁移前先确认目标页面已有等价信息，再从 README 中删除重复段落，避免丢失历史细节。

### 配置项缺少分层说明

原 `docs/guide/configuration.md` 只列出了少量常用配置，无法覆盖当前后端 Starter、独立服务和前端组件的真实配置面。用户容易把必填模型连接项、安全项、性能限制和可选能力开关混在一起配置。

处理结果：
- 已对照 `ai-assistant-server/src/main/java/com/aiassistant/config/AiAssistantProperties.java`、`ai-assistant-service/src/main/resources/application.yml` 和 `.env.example`。
- 已将配置文档拆成最小可用配置、后端配置分层、独立服务环境变量映射、前端配置分层和生产配置基线。
- 已明确 `access-token`、`allowed-origins`、`allow-query-token-auth`、`url-fetch-ssrf-protection`、`admin-enabled` 等生产安全项的建议值。

验证：
- 已运行 `node scripts/project-health-check.mjs --docs`，版本一致性检查和文档站构建均通过。

### Starter 集成与独立服务部署路径容易混淆

文档中同时存在 Starter 集成、独立服务 Docker 部署、前端连接独立服务和生产清单。缺少一个明确的部署路径选择页时，用户容易把两种方式混用，例如前端指向业务后端，但实际只启动了独立服务。

处理结果：
- 已新增 `docs/guide/deployment-checklists.md`。
- 新页面分别列出 Starter 集成和独立服务部署的适用场景、上线前检查项、前端最小配置和排查重点。
- 已在 README、介绍页、快速开始页、独立服务页和 VitePress 侧边栏接入该页面。

验证：
- 已运行 `node scripts/project-health-check.mjs --docs`，版本一致性检查和文档站构建均通过。

### 前端组件配置和事件示例分散

前端组件支持 `autoMountToBody`、`quickPrompts`、`promptTemplates`、`onAssistantError`、`openCodeInIde`、模型选择、system prompt 编辑、Web Component 等能力，但此前说明分散在 README 和少量页面里，不利于宿主前端快速复制常见接入方式。

处理结果：
- 已新增 `docs/guide/frontend-recipes.md`。
- 新页面集中提供基础接入、自动挂载、同源后端、独立服务、主题语言、快捷 Prompt、Prompt 模板、组件事件、错误监控、代码块 IDE、会话限制、模型选择和 Web Component 示例。
- 已在 README、介绍页、前端连接独立服务页和 VitePress 侧边栏接入该页面。

验证：
- 已运行 `node scripts/project-health-check.mjs --docs`，版本一致性检查和文档站构建均通过。

### 生产上线清单需要覆盖高风险开关

生产清单已有镜像、必填变量、鉴权跨域、限流资源、代理、日志和验证内容，但对 SSRF、Headless 抓取、Admin、连接器管理、MCP、RAG、分 action 限流、日志脱敏和 Actuator 敏感端点的检查还不够明确。

处理结果：
- 已扩充 `docs/guide/production-checklist.md`。
- 新增“高风险功能开关”和“Actuator 和健康检查”小节。
- 在鉴权跨域、限流资源、日志可观测性部分补充更具体的生产检查项。

验证：
- 已运行 `node scripts/project-health-check.mjs --docs`，版本一致性检查和文档站构建均通过。

### 后端模块边界需要维护说明

`ai-assistant-server` 包含 controller、service、config、tool、connector、rag、agent、prompt、routing、memory、security、stats、spi 等多类能力。缺少维护说明时，新能力容易直接堆到 controller 或 `LlmService`，后续难以替换、测试和扩展。

处理结果：
- 已新增 `docs/guide/backend-architecture.md`。
- 新页面说明总体分层、包职责、新功能放置建议、Controller 规则、Service 规则、配置和自动装配规则、扩展点规则和维护检查清单。
- 已在 README、介绍页和 VitePress 侧边栏接入该页面。

验证：
- 已运行 `node scripts/project-health-check.mjs --docs`，版本一致性检查和文档站构建均通过。

### README API 长段落与文档站重复

README 中的 API 接口文档包含聊天、模型列表、流式输出、文件上传、URL 预览、导出、健康检查和统计等细节。文档站已经有 API 分组页面，继续在 README 维护完整细节会带来双份更新成本。

处理结果：
- 已新增 `docs/api/reference.md`，承接 REST API 摘要和请求示例。
- 已在 `docs/.vitepress/config.ts` 和 `docs/api/index.md` 接入该页面。
- 已将 README 的大段 API 细节替换为 API 文档入口和常用 API 摘要。

验证：
- 已运行 `node scripts/project-health-check.mjs --docs`，版本一致性检查和文档站构建均通过。

---

## 2026-05-13 第二轮：进化功能审计与决策

### 审计起点

用户在新会话首条消息要求「全部按顺序开始」实现上轮（5-12）设计的 11 项 AI 助手进化功能（A1-A4 / B5-B8 / C9-C11）。
不能盲目按顺序开干，必须先盘点 `ai-assistant-ui/src` 现状，避免重复造轮子。

### 现状审计结果

| 候选项 | 现状文件 | 真实缺口 |
|--------|----------|----------|
| A1 多模型并行对话 | — | **完全缺失** |
| A2 RAG/知识库 | `useKnowledgeBase.ts`（LocalStorage 模拟） | 与后端 RAG 语义不匹配，见下文 |
| A3 MCP 工具集成 | `usePluginRegistry.ts`（按钮注册器） | 缺真 MCP 协议客户端 |
| A4 语音输入 + TTS | `useVoiceInput.ts`（仅输入端） | TTS 朗读完全缺失 |
| B5 会话搜索 | `useSessionSearch.ts` + `highlightSearchInHtml` 已 export | ✅ 已完整 |
| B6 消息编辑/重生成 | `useChatOrchestrator.ts` + `MessageList.vue` + `MessageContextMenu.vue` | ✅ 已完整 |
| B7 Prompt 模板库 | `options.promptTemplates`（预置） | 缺用户侧管理 UI |
| B8 代码块增强 | `useCodeWall.ts` + 复制按钮 + IDE 按钮 | 缺 Mermaid / 行号 |
| C9 测试覆盖 | 5 个 `.spec.ts` + 根目录 e2e | 新增 composable 缺测试 |
| C10 性能优化 | rAF + perfMetrics + `MAX_RENDERED_MESSAGES = 60` | 缺虚拟滚动 |
| C11 i18n 补全 | zh/en/ja/ko 4 语言完整 | ✅ 已完整 |

### A2 RAG 决策（不对接）

**事实**：
- 前端 `useKnowledgeBase.ts` 已实现：用户在本浏览器创建多个「知识库」、上传文件（仅记录元数据）、勾选启用 → 通过 `ragPromptFragment` 注入 system prompt 提示 LLM。
- 后端 `RagService.java`（在 `ai-assistant-server/.../rag/`）有完整 ingest/retrieveContext，但**唯一对外端点是 `POST /admin/rag/ingest` + `GET /admin/rag/stats`**（在 `AdminDashboardController.java`）。
- 这两个端点都在 `@RequestMapping("/admin")` 下，需要 admin 权限；接入后**全局共享**索引（所有终端用户访问到同一份向量库）。

**冲突点**：
- 前端组件库的 `useKnowledgeBase` 设计目标是「每个浏览器用户管理自己的知识库」（不需 admin 权限、不污染他人）。
- 后端 admin RAG 设计目标是「运营方一次性灌入文档，所有用户共享检索」。
- 两者语义、权限、生命周期都不同，不能直接桥接。

**决策**：
- 本轮保持 `useKnowledgeBase` 当前实现不变（LocalStorage + prompt 注入）。
- 不在 `utils/api.ts` 增加 `/admin/rag/ingest` 包装；如需要，宿主应用按需直接调用。
- 后续若要做「用户私有 RAG」，需在 server 端新增 `/users/{userId}/rag/ingest` 端点 + 隔离命名空间，那是后端独立工程。

### A3 MCP 客户端落地

**事实**：
- 后端已有 `McpServerController.java`（`@RequestMapping("/mcp")`），把所有 `AssistantCapability` 暴露为 MCP tools，**自身是 MCP server**，不是 client。
- 协议版本 `2025-03-26`；支持 `initialize` / `tools/list` / `tools/call`。

**实施**：
- 新增 `useMcpClient.ts`（HTTP JSON-RPC client）+ `useMcpClient.spec.ts`。
- 默认指向 `/ai-assistant/mcp`（即 SDK 自己的后端），但 endpoint 可任意覆盖以连接外部 MCP server（如 织信、其它服务）。
- 不支持 SSE streaming（多数 MCP server HTTP-only 即可工作；如需，宿主自接 EventSource）。
- **不主动接入 AiAssistant.vue**：MCP tools 暴露后如何用（自动调用 / 显示成插件按钮 / 集成到 Function Calling）是产品决策，本轮把基础设施落地，留待后续 UX 设计。

### B7 Prompt 模板：用户库 vs 后端模板

**事实**：
- 后端有 `PromptTemplateController.java`：`GET /templates` `POST /templates/{name}/render` `POST /templates`，是「服务端共享模板库」。
- 前端 `options.promptTemplates` 是「编译期由宿主预置」，运行时只读。
- 本轮新增的 `usePromptTemplateLibrary` 是「用户私有 + LocalStorage」。

**三层并存**的合理性：
- **服务端 PromptTemplateController**：运营人员维护的「官方模板」，可后续通过 `fetchPromptTemplates(baseUrl)` API 拉取（本轮未实现该 fetch 函数）。
- **options.promptTemplates**：宿主应用按业务定制的预置模板（如「合同审查」「代码 review」）。
- **usePromptTemplateLibrary**：用户个人收藏的 prompt。

三者在 `PromptTemplateDialog.vue` 中已通过 `mergedTemplates` 合并展示（preset → user），未来如要并入服务端模板只需扩展 composable 的 source 字段，无需重构 UI。

### B8 Mermaid 作为可选 peer

**为什么不直接加进 dependencies**：
- mermaid 完整 bundle 约 600 KB（gzip ~180 KB），强制依赖会显著拖累不需要图表的宿主。
- 改为 `import('mermaid')` 动态加载 + 标记 `external`，使「需要 mermaid 的宿主自己 npm i 即可生效，不需要的宿主完全无感」。

**失败降级**：
- `useMermaidRenderer.renderInside` 在动态 import 失败时把所有 placeholder 内容设为 `<pre>` 显示原始源码，用户至少能读到 Mermaid 文本，不会出现空白方框。

### C10 不接入 MessageList 的理由

- `useMessageVirtualScroll` 是纯算法 composable，已写 7 个单测覆盖所有边界（启用阈值、scroll 位移、高度测量、过末尾 clamp）。
- 真要接入 MessageList 需要：a) 在外层挂 scroll listener；b) 测量每条消息渲染后的实际高度并 feedback；c) 渲染 spacer 占位；d) 处理 `hiddenOlderCount` 与 virtual window 的优先级冲突。
- 这是独立的 200 行级别改动，且会破坏现有 `MAX_RENDERED_MESSAGES = 60` 折叠的契约（哪些消息可见？哪些被折叠？）。
- 本轮先把工具做完备，留专项 PR 接入，避免单次 PR 风险面过大。

### 跳过的「测试型」工作

- B8 `useMermaidRenderer.spec.ts` 未写：mermaid 是可选 peer，测试需要 mock dynamic import + jsdom 不支持的 SVG 渲染，性价比低。已通过手动审阅 + 边界路径设计（fallback / error）保证健壮性。

### 未引入的破坏性变更

- 没有删除任何现有 API。
- 没有修改任何现有 spec.ts。
- 没有破坏现有 6 个预先存在的 vue-tsc 类型错误（pre-existing，与本轮无关）。
- 没有动后端代码（仅 audit 后端 controller 端点结构）。
- 没有 commit / push，保持工作区干净待审阅。

---

## 2026-05-20 第六轮启动发现

### 深度分析结论

`ai-assistant-sdk` 已经是完整的多模块 SDK：Spring Boot Starter、独立服务、Java Client、Vue 组件库、Web Component、文档站、E2E、Docker/Helm 和 CI 均已具备。当前主要风险不在功能缺失，而在能力面扩大后的维护复杂度。

### 按序整改判断

1. `AiAssistant.vue` 仍是前端复杂度最高的聚合点，且已有 `ai-assistant-ui/REFACTORING_PLAN.md` 指向继续拆分，适合作为第一阶段。
2. `/stream` 与 `/sse` 并存，当前前端与 Java client 主要依赖 `/stream`，后续应明确兼容层与标准 SSE 层边界。
3. 生产安全依赖使用方正确配置：空 `access-token`、`allowed-origins=*`、URL fetch、Admin/MCP/Connector 等应形成可执行检查或启动强告警。
4. `@ai-assistant/vue` 公共导出面较大，后续应区分稳定 API 与实验性工具。

### 阶段 13.1 细化发现

- 批量导出主体已经抽到 `ai-assistant-ui/src/composables/useExportActions.ts`，包括菜单开关、JSON/Markdown 全量导出、server export 和单条 assistant 消息导出。
- `AiAssistant.vue` 中仍保留批量选择/删除状态：`selectMode`、`selectedMsgIndices`、`toggleSelectMode`、`toggleMsgSelection`、`deleteSelectedMessages`。
- 因此第一阶段实际拆分目标调整为 `useMessageSelection.ts`，避免重复创建 `useBatchExport.ts`。

### 阶段 13.4 公共 API 分层发现

- `@ai-assistant/vue` 主入口同时导出了主组件、API helper、Admin SDK、MCP、插件、虚拟滚动、TTS、Prompt 模板、表单自动填充和多个低层算法工具。
- 这些导出的稳定性不应等同看待；主接入层最稳定，低层算法 / 实验工具适合高级宿主锁版本使用。
- 本轮选择只补文档和导出区维护提示，不移除导出，避免破坏已集成用户。

### 阶段 13.5 Helm / Kubernetes 生产基线发现

- `docs/guide/configuration.md`、`production-checklist.md`、`deployment-checklists.md`、`.env.example` 和 `docker-compose.prod.yml` 已经覆盖大部分生产安全基线。
- Helm chart 原本只有 `secrets.apiKey` 走 Kubernetes Secret，`AI_ASSISTANT_ACCESS_TOKEN`、`AI_ASSISTANT_ADMIN_TOKEN` 和 `AI_ASSISTANT_RUNTIME_CONFIG_SECRET_KEY` 仍主要出现在 `env` values 中。
- `docs/guide/kubernetes.md` 只覆盖基础部署提醒，缺少 Secret 注入、多副本状态一致性、Redis / 网关限流和 Actuator 暴露边界的具体说明。
- 本阶段选择只调整 Helm 模板和文档，不修改 Java / Vue 运行时逻辑，降低回归风险。

### 阶段 13.6 Compare regions 拆分发现

- `useExportActions`、`useMessageSelection`、`useAssistantDiagnostics` 已存在，批量导出和诊断状态不是当前最大残留点。
- `AiAssistant.vue` 中 Compare regions 仍直接维护 `compareSet`、label、mark/unmark、compare-with、swap 和 clear，适合先抽为纯状态 composable。
- 多模型并行对比由 `useMultiModelChat` 管理，和消息区域 Compare regions 是两套能力，本阶段只迁移消息区域比较集合。
- KB drop / KB picker 仍留在主 SFC，后续可按 `useKnowledgeDrop.ts` 单独拆分。

### 阶段 13.7 KB drop 拆分发现

- `useFabDropIngest` 边界清晰，只负责 HTML5 drag/drop 事件和文件过滤，不应直接知道知识库。
- `AiAssistant.vue` 中残留的 KB drop 编排包含 Quick Ingest、picker 可见性、pending files、auto-dismiss timer、键盘快捷键和 toast，适合集中到 `useKnowledgeDrop`。
- 新 composable 保持纯状态和依赖注入：知识库 store、i18n、toast、focus picker 由父组件传入，避免直接依赖 DOM。
- `AiAssistant.vue` 仍保留一个很小的 DOM focus 回调，用于 Teleport 后聚焦 picker shell。

### 阶段 13.8 连接诊断状态拆分发现

- `useAssistantDiagnostics.ts` 仍同时承担状态映射、网络请求、运行时模型配置保存、连接配置持久化和复制诊断文本。
- error → status、状态文案、token/baseUrl 诊断、model status、source、hint 和 remedy kind 都是纯状态计算，适合先抽离并单测。
- 本阶段不移动 `fetchModels`、`fetchRuntimeModelConfig`、`saveRuntimeModelConfig`、`discoverRuntimeProviderModels` 调用，避免把网络副作用和纯状态拆分混在一次提交里。
- 后续可继续把连接配置持久化和运行时 provider 表单保存拆成更小的 composable。

### 阶段 13.9 协议契约测试发现

- UI `streamChat` 已覆盖标准 SSE data 解析、跨 chunk、multiline、`[DONE]`、runtime meta header 和错误响应。
- 后端 `AiAssistantControllerTest` 已覆盖 `/chat`、兼容 `/stream` 和 `/models` 的主要契约。
- 后端 `SseStreamControllerTest` 原本只覆盖 translate/summarize 透传 model，缺少标准 `/sse` 的 `message` / `done` / `error` event 契约。
- `LlmService.chatStream` 同时存在 `String imageData` 和 `List<String> imageDataList` 两个 7 参重载，测试中必须使用 typed matcher 避免 Mockito 重载歧义。

### 阶段 13.10 依赖分层发现

- Starter 中 Web/WebFlux/WebSocket/Actuator、Redis、JDBC、Resilience4j、Tracing、OTLP、Playwright、Springdoc、Logstash 等依赖已标 optional。
- PDFBox/POI 当前不是 optional，因为 `/export` 和文件处理运行时直接依赖；如果未来拆分，需要独立 feature artifact 和清晰启动提示。
- 独立服务显式带 Web/WebFlux/WebSocket/Actuator/JSON logging，但默认不带 Redis/JDBC/Playwright。
- 前端 Mermaid 保持动态 import / 宿主 opt-in，不在 `@ai-assistant/vue` 默认 dependencies 中。

### 阶段 13.11 连接配置状态拆分发现

- `useAssistantDiagnostics.ts` 中连接配置输入、localStorage 持久化和默认 baseUrl 提示是纯状态逻辑，不依赖网络请求。
- 将这部分拆到 `useConnectionConfigState` 后，`useAssistantDiagnostics.ts` 中剩余的主要职责是运行模型诊断、保存 runtime provider 配置、发现模型和复制诊断文本。
- localStorage 写入仍做 try/catch，保持原有“不可用或满容量时不影响 UI”的行为。

### 阶段 13.12 Runtime provider 表单状态拆分发现

- runtime provider 表单输入、从 sanitized config 回填、保存 payload 构造和 discover models 回填都是纯状态转换。
- 拆出 `useRuntimeProviderConfigState` 后，`useAssistantDiagnostics.ts` 的 provider 相关代码只保留 API 调用成功/失败和状态消息处理。
- API key 仍保持 write-only：读取 runtime config 后会清空 `providerApiKeyInput`，避免把已配置密钥回显到 UI。

### 阶段 13.13 Java Client stream 契约发现

- `AiAssistantClientTest` 已覆盖 chat 错误处理、token header、builder 校验、stream SSE 空格保留。
- 本阶段补齐 `chatStream(text, systemPrompt, model, onChunk)` 的请求契约，确保 Java Client 与官方 `/stream` 兼容端点保持一致。

### 阶段 13.14 服务端 stream 契约发现

- `AiAssistantController.stream` 对输入超限走 HTTP 400 + text/event-stream body，内容以 `[VALIDATION_ERROR]` 前缀给前端展示。
- LLM stream 中途失败不会让 Servlet 直接变成 HTTP 500，而是通过 `fluxWithFriendlyErrors` 转成单个友好错误 chunk。
- `/stream` 仍是官方 UI 和 Java Client 的兼容端点；typed event 需求继续由 `/sse` 覆盖。

### 阶段 13.15 Runtime config 后端契约发现

- `RuntimeConfigControllerTest` 已覆盖只读 `/runtime/config` 的安全摘要、密钥不泄露、feature flags 和 limits。
- `RuntimeModelConfigController` 原本没有 controller 层测试；service 层已有更新、持久化、discover models 覆盖。
- 本阶段补 controller 层契约，确保 Admin runtime model config 的响应仍保持 sanitized / write-only API key 语义。

### 阶段 13.16 行尾噪音发现

- 仓库已有 `.gitattributes`、`.editorconfig` 和前端 `.prettierrc`，三者均要求 LF。
- 当前 `git status` 显示大量 modified，但这些文件大多没有可展示的 text patch；属于 CRLF/LF 或 status-only 噪音，不能混入功能提交。
- 新增的 `scripts/line-ending-noise-check.mjs` 能把真实内容 diff 与 line-ending/status-only diff 分开展示。
- 本阶段不做全仓行尾重写，避免制造 80+ 文件的纯行尾 review 噪音。

### 阶段 13.17 OpenAPI 类型同步发现

- `scripts/generate-frontend-types.mjs --check` 已存在，但需要运行中的 `/v3/api-docs` 和 `openapi-typescript` npx codegen，不适合作为本阶段最小 CI 改动。
- 当前 `ai-assistant-ui/src/types/api-generated.d.ts` 只覆盖聊天相关 wire contract：`ChatRequest`、`ChatResponse` 以及 `/chat`、`/stream`、`/sse` 请求体。
- 轻量 guard 先覆盖 `AiAssistantController`、`SseStreamController`、`ChatRequest`、`ChatResponse` 这 4 个文件；如果它们变更但 `api-generated.d.ts` 未变更，PR 失败。
- 这不是完整 live OpenAPI drift check。后续要扩大到所有 REST DTO 时，应先扩大 generated snapshot 或引入静态 `docs/api/openapi.json`。

### 阶段 13.18 Diagnostics clipboard 拆分发现

- `useAssistantDiagnostics.ts` 中复制诊断文本逻辑是纯 UI side effect：构造文本、写剪贴板、设置 copied 状态和 timer 清理，不依赖网络请求。
- 这部分适合独立成 `useDiagnosticsClipboard.ts`，既能被单测覆盖，也让 `useAssistantDiagnostics.ts` 更专注于模型/连接诊断编排。
- `writeClipboardText` 仍被 `AiAssistant.vue` 的消息复制功能复用，因此迁移到新文件后需要同步调整导入路径。

### 阶段 13.19 Feature artifact 拆分路线发现

- 当前默认 Starter 仍承担基础聊天、导出、文件解析、RAG、连接器、Headless、观测扩展等多类能力，依赖足迹对“只要聊天”的宿主偏重。
- 最适合优先拆的是已经接近 optional 的 Headless / Observability；风险最低。
- PDFBox/POI 是依赖足迹重点，但 `/export` 和文件解析已有公开 API，拆分前必须提供缺依赖时的明确提示，不能让用户遇到运行期 500。
- RAG / Connector 涉及管理面、工具注册、安全和存储一致性，适合最后拆。

### 阶段 13.20 前端公共 API 收窄发现

- `package.json` 已有 `./admin`、`./mcp`、`./form-fill`、`./screenshot`、`./wc` 等二级入口，适合承接高级能力。
- 主入口 `src/index.ts` 仍保留大量高级导出以兼容历史用户；本阶段不删除导出，只强化文档和注释约束。
- 新项目应优先按能力从二级入口导入，后续新增高级 helper 默认不再加入主入口。

### 阶段 13.21 OpenAPI 静态 spec 输入发现

- live `/v3/api-docs` drift check 需要启动后端和 springdoc 暴露，CI 成本与失败面较大。
- 先让 `generate-frontend-types.mjs` 支持 `--spec-file`，可以把“读取 spec”与“生成/比对类型”解耦。
- 后续只要提交 `docs/api/openapi.json` 快照，就能在 CI 中运行 `--spec-file docs/api/openapi.json --check`，不需要每次启动服务。

### 阶段 13.22 静态 OpenAPI 快照发现

- `docs/api/openapi.json` 先覆盖前端当前最常用的 REST wire types，不一次性扩到所有 Admin / Connector / Async DTO。
- `api-generated.d.ts` 现在由 `openapi-typescript` 生成，替代原先手写临时快照。
- `utils/api.ts` 中模型列表、runtime config、URL preview、prompt template 等类型已改为 generated schema alias。

### 阶段 13.23 Diagnostics model requests 拆分发现

- `useAssistantDiagnostics.ts` 中网络请求编排可独立测试，依赖面是 options、若干 refs、provider state 回调和 API 函数。
- 抽成 `useDiagnosticsModelRequests.ts` 后，API 函数可注入，单测无需 mount Vue 组件或 mock 全局 fetch。

### 阶段 13.24 依赖足迹护栏发现

- 直接做 core-only starter artifact 拆包风险较高，先用脚本守住 optional 依赖边界更稳。
- `dependency-footprint-check` 能防止低频能力意外退化为 starter 默认依赖，为后续拆包提供 CI 护栏。

### 阶段 13.25 包体归因发现

- 当前 baseline gzip 构成中 main 约 464 KB，feature chunks 约 280 KB，Web Component 约 224 KB，secondary entries 约 6.5 KB。
- secondary entries 体积很小，说明继续把高级能力留在子入口是正确方向；主入口瘦身应优先分析 main 与 feature chunks 的关系。

### 阶段 13.26 Core entry 瘦身路径发现

- 直接从主入口移除高级导出会破坏历史用户，不适合作为小版本改动。
- 新增 `@ai-assistant/vue/core` 可以先提供更窄的接入入口，后续文档示例可逐步引导新用户使用 core 或专门子入口。
- `core.mjs` 本身非常小，但它仍会指向核心插件；真正降低宿主最终体积还需要后续继续拆主组件内部静态依赖。

### 阶段 13.27 Core plugin 隔离发现

- 将 core entry 改为直接依赖 `core-plugin.ts` 后，`core` 不再经过 `index.ts` 的高级 re-export 面。
- Vite library build 会把核心实现放到共享 chunk，`ai-assistant.mjs` 主入口本身显著变小；这为后续逐步移除主入口高级导出提供了可验证路径。
- 当前仍保留主入口历史导出，真正 breaking removal 可以放到后续 v2 changelog / migration guide 中处理。

### 阶段 13.28 Admin DTO generated schema 发现

- Admin SDK 的类型面主要是简单响应 DTO，适合先迁移到静态 OpenAPI components，不必一次补全所有 Admin paths。
- `AdminAbTestConfig` 保留 `additionalProperties: true`，兼容后端可扩展配置 map。
- `adminApi.ts` 迁移为 generated schema alias 后，仍保留 `AdminResult<T>` 包装类型作为前端 SDK 自己的错误归一化协议。

### 阶段 13.29 Core-only starter 验证发现

- 当前 starter 在缺少 Redis/JDBC/Playwright/OpenAPI/Tracing/Logstash 等低频依赖时，基础聊天自动装配仍可启动。
- 这说明后续拆 feature artifact 时可以先围绕这些 optional 能力推进；PDF/POI 仍是更晚阶段的高风险拆分点。

### 阶段 13.32 Admin path-level OpenAPI 发现

- `adminApi.ts` 的公开函数已经稳定对应一组 `/admin/*` routes，适合先补 path-level OpenAPI snapshot，而不是一次扩全仓 REST paths。
- Admin SDK 仍需要保留 `AdminResult<T>`，因为它是前端调用层的错误归一化协议；OpenAPI 只描述后端 200 JSON payload。
- request body schema 适合从 paths 派生，能减少 `adminApi.ts` 中 `{ success: ... }` 等手写 inline 类型继续扩散。

### 阶段 13.33 Public path-level OpenAPI 发现

- 非 Admin endpoints 中不少 Controller 返回 `Map<String,Object>` 或 JSON 字符串，静态快照适合先用“稳定字段 + additionalProperties”的方式描述，不宜为了 OpenAPI 过度收紧服务端实现。
- 文件上传和导出需要分别用 `multipart/form-data` 与 `application/octet-stream` 表达，否则 generated paths 会误导前端把它们当普通 JSON API。
- Runtime model discovery 是 Admin runtime config 的子路径，但没有 request body；测试应只要求 responses 覆盖，不能强行要求 JSON body。

### 阶段 13.34 Frontend API path-level 类型发现

- `api.ts` 里仍有通用 helper 需要保留前端自己的归一化结果类型，例如 `PromptTemplatesListResult` 和 server export 的 `{ ok }` 下载结果；OpenAPI 类型只适合作为 wire payload 的来源。
- 用临时 TypeScript probe 做脚本测试，比把类型断言塞进 `*.spec.ts` 更可靠，因为前端 `tsconfig.json` 明确排除了 spec 文件。
- `RuntimeDiscoverModelsResult` 需要显式 schema，否则从 `additionalProperties` 生成的类型太宽，不能给调用层提供实际约束。

### 阶段 13.35 OpenAPI sync guard 发现

- 静态快照覆盖范围扩大后，原 guard 只盯 ChatRequest/ChatResponse 已经不够，会漏掉 Session、Export、Connector、Async、Capability 等契约漂移。
- 仅检查 `api-generated.d.ts` 不足以防止手工改 generated types；后端契约变更时应同时要求 `docs/api/openapi.json` 与 generated types 更新。
- OpenAPI snapshot 单独变化也必须要求 generated types 更新，否则 `--spec-file --check` 会在后续 CI 才发现漂移。

### 阶段 13.36 OpenAPI 文档同步发现

- `docs/guide/openapi-typescript-codegen.md` 仍停留在 chat-only 阶段，会误导后续维护者只更新 `api-generated.d.ts`。
- 文档需要明确 `docs/api/openapi.json` 是当前 reviewed contract，generated types 是由它派生的产物，两者应一起 review。
- 当前更现实的后续路线不是继续扩大 paths 数量，而是做 release-time snapshot refresh 和逐步收紧 broad schema。

### 阶段 13.37 下一轮 1-4 推进发现

- Release-time refresh 不应自动启动后端；脚本只负责从 live URL 或已导出的 spec 文件刷新 snapshot，并复用现有 generator。
- `UsageStats` 和 batch response 已有稳定字段，适合先收紧 schema；仍返回自由结构的能力保持 broad schema，避免和实现脱节。
- OpenAPI support 当前是独立 auto-configuration，适合用显式 enable 的 bean wiring 测试作为 Observability/Support 拆分前置护栏。
- `AiAssistant.vue` 中服务端模板刷新逻辑是低风险可抽离切口，抽出后主 SFC 少承担一个远端模板编排职责。

### 阶段 13.38 下一轮继续推进发现

- `refresh-openapi-snapshot --check` 应只做 dry-run 比对，不写 snapshot；这样 release lane 可以安全地验证 live/exported spec 是否漂移。
- Connector/provider health 的 status 值在实现中已经是固定集合，收紧 enum 不会改变运行时行为，却能让 generated types 更有用。
- Prompt template 的弹窗交互可以继续独立于模板数据来源拆分，后续再接 command palette 触发时不必回到主 SFC。
- Observability artifact 真拆前需要先把候选范围写清楚，尤其要排除 PDF/Office、RAG、Connector、Headless 这些不同风险面的能力。

### 阶段 13.39 Module skeleton 与 release-check 发现

- 新增空 module skeleton 可以先验证 reactor 与发布坐标，不急于迁移 production auto-configuration，降低 v2 拆包第一步风险。
- `project-health-check --release-check` 适合承接 refresh dry-run；这样 release lane 同时验证 snapshot 格式与 generated types。
- quick prompt 过滤逻辑是另一个低风险 SFC 瘦身切口，和 prompt template interaction 不共享状态，可独立抽离。
- bundle baseline 更新确认当前构建输出已被记录；后续体积回归判断会基于最新 chunk/hash 结构。

### 阶段 13.40 全部推进发现

- Observability support module 目前仍不适合一次性迁移 tracing/logstash/health/metrics 的生产类；先把 Spring Boot auto-configuration metadata 放进 support artifact，可以验证 artifact 边界，又不删除 starter 里的兼容类。
- `AiAssistant.vue` 里 quick prompt button、empty-state prompt template、slash `/template` 和 command palette prompt 入口本质上都是“把 prompt 写入输入区或打开模板库”，适合统一到 `useAssistantPromptCommands`。
- `useBuiltInCommands` 以前每次 watch 都会 `clear()` 后重新注册 built-in commands，因此外部单独 register 的 prompt commands 会被覆盖；新增 `extraCommands` 比在组件里手动补 register 更稳定。
- OpenAPI refresh dry-run 失败时只说 stale 不够定位；path/schema key 的新增删除已经能覆盖大多数 release drift 判断，字段级差异保留给 review diff。
- Bundle baseline review 最常见的问题是“不知道变化来自新增 chunk、删除 chunk 还是已有 chunk 变胖”，新增/删除/增长/缩小摘要比只看 top table 更容易审查。

### 阶段 13.41 继续推进发现

- OpenAPI support 的安全迁移点是 metadata 归属，不是立即删除 implementation class。将 starter metadata 移除、support metadata 保留、standalone service 显式依赖 support，可以同时实现“core starter 默认更轻”和“独立服务行为不变”。
- Line-ending-only 噪音在本轮 `git add -u` 后不再出现在工作区状态里，说明这些差异只是 Git 触碰时的 CRLF/LF 归一化提示，没有需要单独提交的实际内容。
- Slash command 和 command palette 的重复主要集中在 feature panel actions。新增 `useAssistantFeatureCommands` 后，plugins / compare / form-fill 的 palette 入口和 slash 入口共享同一组 action，后续 memory / KB 内置 palette 也可以按同样方向继续收敛。
- `project-health-check --release-check` 接入 bundle-size lane 后会依赖已构建的 `ai-assistant-ui/dist`。这符合 release 前先 build 再 check 的使用方式，但文档必须写清楚，避免在干净仓库直接跑 release-check 误以为失败。

### 阶段 13.42 继续推进发现

- Support artifact 如果只承接 `AutoConfiguration.imports`，宿主仍需要额外记住 springdoc 依赖；把 `springdoc-openapi-starter-webmvc-ui` 放进 support artifact 更符合“加一个 support artifact 即获得 OpenAPI support”的用户心智。
- Support module 不是 Spring Boot parent，需要显式导入 Spring Boot BOM；否则 springdoc 传递依赖会拉到 3.5.13 一组依赖，导致下载和版本对齐都不稳定。
- 最小 Java slice test 放在 support module 内，可以验证 support artifact 的依赖边界和 `AiAssistantOpenApiAutoConfiguration` wiring；脚本测试继续负责 metadata ownership。
- `/template` 和 prompt library palette entry 属于同一 prompt 命令族，迁移到 `useAssistantPromptCommands` 后，`AiAssistant.vue` 只组合 feature commands 与 prompt commands，不再维护模板命令细节。
- 本轮刷新 bundle baseline 后，release-check 的新增/删除 hash chunk 噪音归零；后续 bundle-size 摘要会更聚焦真实增长。

### 阶段 13.43 继续推进发现

- Support artifact 自带 springdoc 后，tracing/logstash 适合先作为 optional dependency bridge，而不是立即改变运行时自动配置；这能表达 artifact 边界，同时不强迫宿主启用 tracing/exporter/logstash。
- Standalone service 不需要直接依赖 springdoc；它依赖 support artifact 即可获得 OpenAPI support classpath，脚本 guard 可以防止未来又把 springdoc 直接塞回 service。
- `useAssistantCommandRegistry` 的价值是把“命令族怎么合并”从 `AiAssistant.vue` 拿走。后续新增命令时，应优先在 prompt/feature command composable 内扩展，再由 registry 组合。
- Release-check 新增 bundle-size lane 后，必须把“先 build UI，再 release-check”写进文档；否则干净工作区直接运行会因为 dist 不存在而失败。

### 阶段 13.44 继续推进发现

- Starter POM 仍保留 tracing / OTLP / logstash optional 依赖时，虽然不会强制传递给宿主，但依赖边界仍容易被误读为 starter 所有。将这些坐标移到 support artifact 后，observability support 的职责更清晰。
- `project-health-check --release-check` 自身先运行 UI build，比只在文档中要求人工排序更可靠；CI 可以直接复用同一条 release lane，避免本地和 CI 检查顺序漂移。
- `useAssistantCommandRegistry` 如果显式接收 prompt / feature 两类参数，后续新增 memory / KB / diagnostics 命令族时仍要回主组件改组合逻辑。改为 `families` 后，主组件只声明命令族顺序。
- Bundle baseline 的 hash chunk 噪音来自已确认构建产物变化；刷新 baseline 后，release-check 的 change summary 重新回到 added / removed / growth / shrunk 全 none。

### 阶段 13.45 继续推进发现

- Observability support 仅有 split 文档时，用户仍需要在 OpenAPI、Tracing、JSON logging 三种接入方式之间自行拼配置。单独 quick start 更适合放 copy-paste 配置，并强调 tracing/logstash 不会自动启用。
- OpenAPI implementation 仍留在 starter 时，support artifact 还不是完整源码边界；当前只适合做 migration pre-study，等 breaking-version 时再移动源码并决定是否需要 compatibility shim。
- 依赖足迹检查只告诉 starter 是否违反 optional 策略，不能直观看出 observability bridge 已从 starter 移到 support。新增 support dependency report 可以把 starter/support 的 direct/optional/absent 状态作为 release-check 输出，Markdown 输出则便于后续接入 PR comment。
- `useAssistantCommandRegistry` 已支持 generic families 后，prompt / feature family 数组仍留在 `AiAssistant.vue`。新增 `useAssistantCommandFamilies` 和 workflow family 后，diagnostics / sessions / export 也能按 family 管理，后续新增命令族时不再散落拼接逻辑。
- CI 的 `npm run check:exports` 已被 release-check 内部 `npm run build` 覆盖，因为 package build 末尾会运行 `check:exports`。删除单独 step 后保留 package install smoke check，避免失去安装验证。
- Release-check 同时承担本地快速确认和 CI 完整 gate 时会变重；`--release-check-fast` / `--release-check-full` 分层后，本地可跳过 UI build / bundle，CI 和发版仍跑完整路径。

### 阶段 13.46 继续推进发现

- OpenAPI implementation 迁到 support artifact 后，starter 不应保留 compatibility shim；否则 starter 会反向依赖 support artifact，破坏“base starter 不默认带 observability support”的边界。保留相同 package name 更适合作为源码兼容缓冲。
- Repository CI 适合跑 `--release-check-fast` 来覆盖脚本测试、静态 OpenAPI、依赖足迹和 support boundary；frontend CI 再跑 `--release-check-full`，让 UI build / bundle baseline 只由前端 lane 承担。
- Support dependency report 已有 Markdown 输出，接入 PR sticky comment 后可以和 bundle / coverage 一起展示，不需要新增单独 comment marker。
- `AssistantCommandFamily` 使用 `commandPaletteCommands` 比 `paletteCommands` 更贴近 prompt / feature / workflow composable 的既有返回名；增加 `name` 后，后续 diagnostics 或 session family 出问题时更容易定位来源。
- 本轮 UI 源码变化只造成 hash chunk added/removed 噪音和极小 gzip 波动；刷新 bundle baseline 后 release-check 后续会继续聚焦真实体积增长。

### 阶段 13.47 继续推进发现

- PR metrics comment 的 YAML inline shell 已经开始承担“读取文件、拼接 markdown、写 combined report”三件事；抽成 `ci-metrics-comment.mjs` 后，workflow 只负责生成输入 report，拼接格式可以用 Node 单测保护。
- `OpenAPI` host override 属于 support artifact 的关键兼容契约，测试应放在 support module，而不是 starter auto-configuration suite。
- App-level command palette entries（panel/session/theme/personalize/keyboard help）与 prompt/feature/workflow 一样适合作为 command family；`useBuiltInCommands` 只保留 palette clear/register watch 后，`AiAssistant.vue` 的命令入口继续变薄。
- CI 去重不只靠人工审查 workflow，脚本测试可以断言 `Run repo script tests`、静态 OpenAPI 类型检查、dependency footprint 等 step 不再重复出现在 workflow 中。

### 阶段 13.48 继续推进发现

- `useBuiltInCommands` 已经不再定义 built-in commands，继续保留旧名字会误导后续维护；改名为 `useCommandPaletteRegistration` 后，command definitions 与 palette registration 的职责分离更清楚。
- 上一轮把 app commands 迁出 built-in registration 时，memory / KB palette entries 也被移走但尚未进入 feature family。补入 `useAssistantFeatureCommands` 后，slash 和 palette 入口重新共享同一组 feature actions。
- `ci-metrics-comment.mjs` 只有纯函数测试还不够，CLI fixture 能覆盖真实文件路径、输出文件和参数解析，避免 workflow 使用方式漂移。
- OpenAPI auto-configuration 实现已迁入 support artifact 后，README 和 quick start 都需要直接提醒用户通过 `ai-assistant-observability-support` 获取该 class，避免仍按 starter-internal classpath 查找。

### 阶段 13.49 继续推进发现

- Command palette 的 `register()` 会按 id 覆盖既有命令；在 registry 层暴露 duplicate id 列表，可以让后续 UI 或测试选择是否阻塞，而不改变当前注册行为。
- `useCommandPaletteRegistration` 的 immediate watch 还需要覆盖动态更新路径；否则 command families 的 computed 输出变化后可能只在首次注册时有效。
- CI metrics comment 的 marker、report 顺序和 footer 都是 PR comment 更新契约，导出常量并测试后，workflow 和脚本之间的隐性格式约定更可维护。
- Support quick start 用 “Starter only / With support artifact” 对照说明，比只说 class 迁移更容易解释为什么 starter-only 下 `ai-assistant.openapi.enabled=true` 不会暴露 springdoc endpoints。

### 阶段 13.50 继续推进发现

- duplicate id 检测只有返回值还不够，`AiAssistant.vue` 在开发环境消费后能把 family 组合错误尽早暴露给维护者，同时不影响生产运行。
- Command family metadata 的 `source` / `description` 可以作为后续调试面板或诊断日志的基础，不需要现在引入更重的 registry 模型。
- release baseline 刷新已经重复出现，独立脚本 `refresh-release-baselines.mjs` 能把“刷新哪些 baseline”集中维护，后续 coverage/openapi baseline 可按 step 追加。
