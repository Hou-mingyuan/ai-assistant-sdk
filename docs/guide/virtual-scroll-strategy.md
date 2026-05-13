# 长会话虚拟滚动策略

`@ai-assistant/vue` 在长会话场景（几百到几千条消息）提供 **两套互补的渲染优化**：

| 机制 | 默认值 | 作用 | 启用方式 |
|------|------|------|---------|
| **DOM 折叠**（已默认开启） | 渲染最近 60 条；更老的折叠成"上方还有 X 条 — 点击展开"提示 | 防止初次挂载渲染上千条 DOM 卡死浏览器 | 开箱即用，常量 `MAX_RENDERED_MESSAGES = 60` |
| **虚拟滚动**（opt-in） | 仅渲染 viewport ± overscan 区间内的消息，其余 spacer 占位 | 滚动到顶部加载历史不爆内存；ResizeObserver 真实测量高度 | `AiAssistantOptions.virtualScroll = true` 或对象 |

## 何时选哪种

- **大多数场景，60 条折叠足够**：用户通常只浏览最近若干轮；翻历史时点"展开上方"也只多渲染一次。
- **真有长会话浏览需求**（例如客服对话、长程协作）：开启 `virtualScroll`，并显式调高 `threshold`。

## 两种机制如何避免冲突

折叠是「裁剪掉早期消息」，虚拟滚动是「DOM 上同时存在所有消息，但只挂载窗口内」。两者直接同时打开会有歧义：被折叠的 N 条到底要不要计入虚拟窗口？

实现已统一处理：

- 折叠（`hiddenOlderCount > 0`）时，传给虚拟滚动的 `messageCount` 是 `displayedMessages.length`（已扣掉折叠条数）。虚拟滚动只看见可显示的子集，不会把折叠掉的条目当作"实际渲染的 spacer"。
- 折叠的"展开上方"按钮独占一行，不参与虚拟窗口计算。
- 当用户点"展开"后 `hiddenOlderCount` 归零、`displayedMessages` 变长；虚拟滚动 composable 的 `messageCount` 自动重算，新加入的历史段也进入窗口。

## 推荐配置

```ts
import { createApp } from 'vue'
import App from './App.vue'
import AiAssistant from '@ai-assistant/vue'
import '@ai-assistant/vue/dist/style.css'

createApp(App).use(AiAssistant, {
  baseUrl: '/ai-assistant',
  /* 启用虚拟滚动并把激活阈值设为 80（消息数 ≤ 80 时仍走全量渲染）*/
  virtualScroll: { threshold: 80, estimatedItemHeight: 110 },
}).mount('#app')
```

参数说明：

| 字段 | 类型 | 默认 | 含义 |
|------|------|------|------|
| `threshold` | number | 60 | `messageCount` ≤ 此值 → 关闭虚拟化（防止小列表反而变慢） |
| `estimatedItemHeight` | number | 90 | 单条消息未测量前的高度估算（像素）；建议按你气泡平均高调 |

如果只想 toggle 开关：

```ts
app.use(AiAssistant, { virtualScroll: true })
```

## 何时关闭虚拟滚动

- 列表里夹带富媒体（图表 / 大量代码块 / Mermaid 图）且高度差异巨大时，初始 `estimatedItemHeight` 误差大、scroll position 易抖动。先用 ResizeObserver 让真实高度回写一遍 spacer 再启用。
- 移动端 < 600px：默认 60 条折叠已经够轻；虚拟滚动收益不大但额外引入测量 + spacer 维护成本。

## 自己接入纯算法版

`useMessageVirtualScroll` 是纯算法 composable，不绑 MessageList，宿主可在自有列表组件里复用：

```ts
import { ref, computed } from 'vue'
import { useMessageVirtualScroll } from '@ai-assistant/vue'

const messages = ref<{ id: string; content: string }[]>([])
const scrollTop = ref(0)
const viewportHeight = ref(600)
const messageCount = computed(() => messages.value.length)

const vs = useMessageVirtualScroll({
  messageCount,
  scrollTop,
  viewportHeight,
  estimatedItemHeight: 110,
  overscan: 6,
  minActivationCount: 80,
})

/* 模板：
   <div :style="{ height: vs.totalHeight + 'px' }">
     <div :style="{ height: vs.window.value.topSpacer + 'px' }" />
     <MyMessageBubble
       v-for="i in range(vs.window.value.startIndex, vs.window.value.endIndex)"
       :key="messages[i].id"
       :msg="messages[i]"
       @rendered="(h) => vs.updateMeasuredHeight(i, h)"
     />
     <div :style="{ height: vs.window.value.bottomSpacer + 'px' }" />
   </div>
*/
```

要点：

1. 把容器 scroll 事件绑到 `scrollTop`（rAF 节流，避免每次滚动都重算）。
2. 渲染后用 ResizeObserver 把真实高度回写 `updateMeasuredHeight`，下次窗口移动时 spacer 会立即纠偏。
3. `messageCount` 改变时窗口自动重算，无需手动刷新。

## 失败模式与排查

| 现象 | 可能原因 | 排查 |
|------|---------|------|
| 滚动时新消息没出现 | `scrollTop` 没及时回填 | 检查容器 scroll 监听是否绑到了正确的元素（不是 window） |
| 滚动到顶部空白 | `estimatedItemHeight` 太小，spacer 估算不足 | 调大 `estimatedItemHeight` 或先 ResizeObserver 测量后再启用 |
| 输入新消息后页面跳 | totalHeight 增长，浏览器自动保持 scrollTop | 在 `messages.push()` 后 `scrollToBottom`（已封装在 `useChatOrchestrator`） |
| 单测里 `window` 是 disabled=false 但实际不应该启用 | 测试中 `messageCount.value > minActivationCount` | 单测用 `minActivationCount: 5` 加边界控制 |

## 完整 OPT-IN 校验

```bash
node scripts/project-health-check.mjs --ui-test
```

`useMessageVirtualScroll.spec.ts` 内置 7 个单测覆盖：阈值启用 / 边界条件 / 高度测量 / overscan / 末尾 clamp / clearMeasured / disabled 路径。
