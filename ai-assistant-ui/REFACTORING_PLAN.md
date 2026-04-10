# AiAssistant.vue 重构计划

## 已完成

### usePanelGeometry.ts（已创建）
从 AiAssistant.vue 抽取的面板几何逻辑 composable，包含：
- 面板尺寸计算（effectivePanelWidthPx/HeightPx）
- 面板缩放 8 向手柄（resize pointer handlers）
- 标题栏拖拽（header drag with tentative mode）
- 视口夹紧（ensurePanelInViewport）
- 象限对齐（resolveFabScreenQuadrant, wrapperOffsetFromFab）
- 面板展开/缩放状态（panelExpanded, panelUserSize）
- 面板打开/关闭生命周期辅助（onPanelOpen, onPanelClose）

## 下一步：集成到 AiAssistant.vue

### 步骤 1：添加 import
```ts
import { usePanelGeometry, RESIZE_ZONES, type PanelResizeEdge } from '../composables/usePanelGeometry'
```

### 步骤 2：调用 composable
在 `const fab = useFabDrag(...)` 之后添加：
```ts
const panelGeo = usePanelGeometry({
  fabLeft, fabTop, fabSize: FAB_SIZE,
  isOpen, saveFabPos, clampFabPos,
  defaultPosition: options.position || 'bottom-right',
})
const {
  panelExpanded, panelUserSize, panelMountedForLayout, panelDragging,
  panelOpenFabAlignClass, panelTransformOrigin, resizeZoneDefs,
  effectivePanelWidthPx, effectivePanelHeightPx, togglePanelExpand,
  wrapperOffsetFromFab, ensurePanelInViewport, resolveFabScreenQuadrant,
  syncFabPixelFromWrapperDom, clampPanelSize,
  onPanelResizePointerDown, onPanelHeaderPointerDown,
  onPanelOpen, onPanelClose, onWinResizePanel, cleanupGeometry,
} = panelGeo
```

### 步骤 3：删除被替代的代码块
从 AiAssistant.vue 中删除以下区域（约 500 行）：
- 行 822-840: PANEL_W/H 常量、PanelResizeEdge 类型、RESIZE_ZONES 数组
- 行 842-958: getPanelScreenRect, syncFabToPanelRect, computeRectFromResizePointer, getViewportCssSize
- 行 973-998: panelExpanded, panelUserSize, panelResizeDrag 等状态声明
- 行 1002-1003: winResizeRaf（保留，但 onWinResize 中改用 onWinResizePanel）
- 行 1042-1135: clampPanelSize, effectivePanelWidthPx/HeightPx, togglePanelExpand, resize pointer handlers
- 行 1137-1199: resolveFabScreenQuadrant, wrapperOffsetFromFab, syncFabPixelFromWrapperDom
- 行 1201-1310: 标题栏拖拽（tentative + header drag handlers）
- 行 1325-1334: effectivePositionClass、panelOpenFabAlignClass（用 composable 版本）
- 行 1542-1551: panelTransformOrigin（用 composable 版本）

### 步骤 4：更新 watch(isOpen)
将 watch(isOpen) 中约 70 行面板打开/关闭逻辑替换为调用 `onPanelOpen`/`onPanelClose`。

### 步骤 5：更新 onWinResize
在 `onWinResize` 中将面板尺寸重算逻辑替换为 `onWinResizePanel()`。

### 步骤 6：更新 onUnmounted
将面板相关的清理逻辑替换为 `cleanupGeometry()`。

### 步骤 7：更新 wrapperStyle
引用 `effectivePanelWidthPx()` 和 `effectivePanelHeightPx()` 来自 composable。

## 预期效果
- AiAssistant.vue 从 ~2285 行减至 ~1785 行（-22%）
- 面板几何逻辑独立可测试
- 无模板更改，零 UI 回归风险

## 后续可继续抽取的 composable
1. `useChatEngine` — send/stream/scroll/urlPreview（~250 行）
2. `useFabInteraction` — FAB pointerdown/move/up/contextmenu（~120 行）
3. `useSessionManager` — 多会话切换/分叉/清除（~80 行）
4. `useFileHandler` — 文件上传/拖放/图片粘贴（~100 行）
