# UI 体验指南（settings 齿轮 / 会话抽屉 / 键盘快捷键）

本文聚焦 SDK 默认 UI 中**最常被问到、但不那么显眼**的 3 块交互：
设置入口、长会话管理、键盘提速。**截图占位**章节说明：本仓库不在文档站托管运行时截图（避免 CI/CD 抖动），下方所有面板都可以在 `ai-assistant-vue-playground` 启动后实拍。

> 💡 想跑起来：`cd ai-assistant-vue-playground && npm install && npm run dev`，
> 然后打开 `http://localhost:5173/`，悬浮球默认在右下角。

---

## 一、Settings 齿轮（D2）

### 它替代了谁

历史版本里 header 同时有 **「Personalize」🧑** 和 **「Diagnostics」📊** 两个独立按钮，加上 mode 切换按钮、关闭按钮，header 视觉非常拥挤。D2 把所有设置相关入口收敛到**一个齿轮 ⚙**。

```
Before  ┌─────────────────────────────────────┐
        │ AI 助手   [模式▼] [🧑] [📊] [×]      │
        └─────────────────────────────────────┘

After   ┌─────────────────────────────────────┐
        │ AI 助手                  [⚙]  [×]    │
        └─────────────────────────────────────┘
                                     │
                                     ▼  (click)
                                    ┌──────────────────────┐
                                    │  🧑  Personalize     │
                                    │  📊  Diagnostics     │
                                    │  📋  All sessions    │← 进入 G1 抽屉
                                    └──────────────────────┘
```

### 交互细节

| 行为 | 表现 |
| --- | --- |
| 点齿轮 | popover 弹出，3 个 menuitem |
| 点 menuitem | popover 关闭并打开对应 dialog（personalize / diagnostics / sessions） |
| 点 popover 外部 | popover 自动关闭（click-outside 守卫） |
| 键盘 Tab | 焦点在 trigger 与 menuitem 之间循环 |
| `aria-haspopup="menu"` / `aria-expanded` | 屏幕阅读器宣告“菜单已展开”/“已收起” |
| 主题适配 | 暗色 / 浅色自动切换，与 header 一致 |

### 隐藏其中一项（host 控制）

`showSystemPromptUi=false` 时 Personalize 一项隐藏；其余 2 项始终显示。

```ts
app.use(AiAssistant, {
  baseUrl: '/ai-assistant',
  showSystemPromptUi: false,
});
```

---

## 二、会话抽屉（G1）— All Sessions

### 何时用

- Tabs 在窗口顶部只显示最近 ~5 个会话标签，**长期使用后会话数会很快超过这个量**。
- G1 抽屉是“所有会话”的全量视图，配合搜索、置顶、改名、删除。

### 入口

齿轮菜单 → **All sessions**（中文 `全部会话`）。

### 抽屉内容布局

```
┌───────────────────────────────────────────────────┐
│  全部会话 (37)                                  ×  │
├───────────────────────────────────────────────────┤
│  🔍 [按标题或内容搜索…                        ]   │
├───────────────────────────────────────────────────┤
│  ★ 置顶                                          │
│  ─────────────────────────                      │
│  ★  TypeScript ↔ Java 跨语言术语                │
│           2 hours ago · 14 msgs   [✎] [🗑]       │
│                                                  │
│  今天                                            │
│  ─────────────────────────                      │
│  ▸  设计评审反馈整理（活跃）                    │
│           20 mins ago · 6 msgs    [★] [✎] [🗑]   │
│  ▸  会议纪要 - 5/13 产品周会                    │
│           3 hours ago · 22 msgs   [★] [✎] [🗑]   │
│                                                  │
│  昨天                                            │
│  ─────────────────────────                      │
│  ▸  解 bug：useStreamWithFallback...            │
│           Yesterday 16:42 · 8 msgs [★] [✎] [🗑]  │
│                                                  │
│  本周                                            │
│  …                                              │
│                                                  │
│  更早                                            │
│  …                                              │
└───────────────────────────────────────────────────┘
```

### 关键功能

| 功能 | 行为 |
| --- | --- |
| **按时间桶分组** | 「置顶」「今天」「昨天」「本周」「更早」5 段；置顶横跨所有时间段 |
| **search filter** | 同时匹配会话标题 + 任一消息内容（不区分大小写）|
| **★ 置顶 (pin)** | 点星，会话提升到顶部置顶组，再点取消 |
| **✎ 改名 (rename)** | 点笔，title 变 inline `<input>`，回车提交 / Esc 取消 / blur 也提交 |
| **🗑 删除 (delete)** | 鼠标 hover 才显示，避免误删 |
| **激活态** | 当前会话有左侧科技蓝边框 + 浅色背景 |
| **空状态** | 搜索无结果时显示「No sessions match this filter」|

### 与原有 SessionTabs 的关系

抽屉**不替换** tabs，是**补充**：

- 几个频繁切换的会话 → 继续用顶部 tabs（一击切换）
- 翻历史 / 找老对话 → 打开抽屉

---

## 三、键盘快捷键 cheat sheet（E1）

### 一次性看全部：`Ctrl + /`（macOS：`⌘ + /`）

按 `Ctrl + /` 弹出 cheat sheet 对话框，分 **Global / Composer / Slash menu** 3 组。
平台自适应：macOS 显示 `⌘`，其它平台显示 `Ctrl`。

### 完整快捷键表

#### Global（任何时候）

| 组合 | 行为 |
| --- | --- |
| `Ctrl + /` | 打开/关闭本 cheat sheet |
| `Ctrl + Shift + L` | 清空当前会话所有消息 |
| `Ctrl + Shift + N` | 新建会话 |
| `Ctrl + Shift + F` | 聚焦消息搜索框 |
| `Ctrl + Shift + S` | 显示 / 隐藏批量导出菜单 |
| `Ctrl + Shift + M` | 打开 / 关闭记忆面板 |
| `Esc` | 关闭当前最顶层对话框 / popover |

#### Composer（输入框聚焦时）

| 组合 | 行为 |
| --- | --- |
| `Enter` | 发送消息（`enterSendMode='ctrl-enter'` 时插入换行）|
| `Ctrl + Enter` | 强制发送（不受 enter mode 影响）|
| `Ctrl + B` | 选中区加粗（包/插入 `**`）|
| `Ctrl + I` | 斜体（`*`）|
| `Ctrl + E` | 行内代码（`` ` ``）|
| `Ctrl + K` | 链接占位符 |

#### Slash menu（在 textarea 起始打 `/` 触发后）

| 组合 | 行为 |
| --- | --- |
| `/` | 在 textarea 第一个字符处触发斜杠菜单 |
| `↑` / `↓` | 在候选命令中移动 |
| `Enter` | 运行高亮命令 |
| `Esc` | 关闭斜杠菜单 |

### 设计取舍

- **modal vs popover**：选 modal —— 17 条快捷键单 popover 装不下，且 modal 提供更清晰焦点态
- **`<kbd>` 真实键帽**：每个键独立 `<kbd>` 标签 + 阴影 CSS，跨平台一致
- **底注**：「Press Esc to close · Press Ctrl + / again to reopen」 — 闭环提示

---

## 四、配套：其它 UX 小注脚（同期产物，便于一并感知）

| 编号 | 位置 | 一句话说明 |
| --- | --- | --- |
| **D4** 上下文徽章 | footer | `[📄 上下文 · 3]` 表示已附带 N 块页面上下文；点击关闭后变 `[📄 上下文已关]` |
| **D5/E2** 流式 progress chip | 流式输出下方 | `12 char/s · ⏱ TTFT 0.42s · 1.3s` 三段实时显示首字延迟 + 速度 + 累计 |
| **F3** 搜索跳转高亮 pulse | 命中消息周围 | 搜索定位的命中消息会有 0.6s 蓝色光圈 ring 提示当前焦点 |
| **F4** 代码块语言 chip + 折叠 | 任何长代码块 | 顶部小 `python` chip；≥20 行自动折叠 + 底部渐变遮罩 + 「展开」按钮 |
| **H5** 会话置顶 + 改名 | G1 抽屉内 | 上文已讲，能力来源 |
| **H6** 搜索三模式 | 消息搜索框附近 toggle | `Aa`（区分大小写）/ `W`（whole word）/ `.*`（regex），三个开关 |
| **H2** 键盘聚焦 ring | 全局 | 所有交互元素现在都有 `:focus-visible` 蓝色 ring（鼠标点不污染） |

---

## 五、何时需要替换 UI

如果你打算**完全自定义 UI**（如使用品牌特定的会话管理弹层），可以：

- 用 `useMultiSession()` composable 直接读会话列表、自己渲染抽屉
- 用 `useSessionSearch()` 拿 filter 结果，自己渲染高亮
- 用 `useKeyboardShortcuts()` 注册自己的快捷键 handler

详见 [前端集成配方](./frontend-recipes.md) 的「替换默认 UI」段，以及 [API Overview](../api/index.md) 中的 composables 列表。

---

## 相关页面

- [前端集成配方](./frontend-recipes.md) — 接入与配置
- [Git Hooks](./git-hooks.md) — 本地 pre-commit + CI metric 评论机制
- [Configuration](./configuration.md) — 所有运行时 options 一览
- [API Overview](../api/index.md) — 程序化扩展接入点
