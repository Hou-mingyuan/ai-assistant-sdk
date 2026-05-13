/**
 * useMessageVirtualScroll
 * -----------------------
 * 纯算法版的「索引窗口」虚拟滚动 composable，**不直接操作 DOM**。
 *
 * 目的：在长会话（几百条消息）场景下，让 MessageList 仅渲染当前 viewport
 * 附近的若干消息，其余以 spacer 占位；同时避免对现有 MessageList 做侵入式
 * 重构。
 *
 * 设计要点：
 * - 高度估算保守地用 `estimatedItemHeight`（默认 90px），可由宿主调整。
 * - 真实高度通过 `updateMeasuredHeight(index, height)` 后即时纠偏：composable
 *   维护一份 height 缓存，求 prefix-sum 来计算 spacer 偏移，比典型 "windowed
 *   re-layout" 更轻量。
 * - 窗口算出后给上下各加 `overscan`（默认 4 条）缓冲，减少滚动撕裂感。
 * - 当 messageCount ≤ `minActivationCount`（默认 60）时整体降级为「全量渲染」，
 *   返回 `disabled` 标志让宿主跳过虚拟化逻辑。这刚好与项目里现有的
 *   `MAX_RENDERED_MESSAGES = 60` 折叠机制衔接。
 * - 完全可在 jsdom 单测中跑：依赖只有 ref + computed，不读 window。
 */
import { computed, ref, type Ref } from 'vue';

export interface UseMessageVirtualScrollOptions {
  /** 当前消息总数；通常是 `messages.value.length` */
  messageCount: Ref<number>;
  /** 容器（滚动器）可视区域高度（像素） */
  viewportHeight: Ref<number>;
  /** 当前滚动条 scrollTop（像素） */
  scrollTop: Ref<number>;
  /** 单条消息的高度估算值，默认 90px */
  estimatedItemHeight?: number;
  /** 上下各预渲染条数，默认 4 */
  overscan?: number;
  /** 消息数 ≤ 此值时关闭虚拟化（直接全量渲染），默认 60 */
  minActivationCount?: number;
}

export interface VirtualWindow {
  /** 是否启用了虚拟化（false 时所有消息全渲染） */
  enabled: boolean;
  /** 窗口起始索引，闭区间 */
  startIndex: number;
  /** 窗口结束索引，开区间 */
  endIndex: number;
  /** 顶部 spacer 像素高度 */
  topSpacer: number;
  /** 底部 spacer 像素高度 */
  bottomSpacer: number;
}

const DEFAULT_ITEM_HEIGHT = 90;
const DEFAULT_OVERSCAN = 4;
const DEFAULT_MIN_ACTIVATION = 60;

export function useMessageVirtualScroll(opts: UseMessageVirtualScrollOptions) {
  const estimatedItemHeight = Math.max(20, opts.estimatedItemHeight ?? DEFAULT_ITEM_HEIGHT);
  const overscan = Math.max(0, opts.overscan ?? DEFAULT_OVERSCAN);
  const minActivationCount = Math.max(1, opts.minActivationCount ?? DEFAULT_MIN_ACTIVATION);

  const measured = ref<Map<number, number>>(new Map());

  function updateMeasuredHeight(index: number, height: number) {
    if (index < 0 || height <= 0) return;
    const prev = measured.value.get(index);
    if (prev === height) return;
    const next = new Map(measured.value);
    next.set(index, height);
    measured.value = next;
  }

  function clearMeasured() {
    if (measured.value.size === 0) return;
    measured.value = new Map();
  }

  function itemHeight(i: number): number {
    return measured.value.get(i) ?? estimatedItemHeight;
  }

  function prefixHeight(upToExclusive: number): number {
    if (upToExclusive <= 0) return 0;
    let acc = 0;
    for (let i = 0; i < upToExclusive; i++) acc += itemHeight(i);
    return acc;
  }

  const totalHeight = computed(() => {
    const total = opts.messageCount.value;
    let acc = 0;
    for (let i = 0; i < total; i++) acc += itemHeight(i);
    return acc;
  });

  const window = computed<VirtualWindow>(() => {
    const count = opts.messageCount.value;
    if (count <= minActivationCount) {
      return {
        enabled: false,
        startIndex: 0,
        endIndex: count,
        topSpacer: 0,
        bottomSpacer: 0,
      };
    }

    const viewport = Math.max(0, opts.viewportHeight.value);
    const top = Math.max(0, opts.scrollTop.value);
    const bottom = top + viewport;

    let acc = 0;
    let start = 0;
    while (start < count) {
      const h = itemHeight(start);
      if (acc + h > top) break;
      acc += h;
      start++;
    }
    const topSpacer = acc;

    let end = start;
    let consumed = 0;
    while (end < count && consumed < viewport + itemHeight(end)) {
      consumed += itemHeight(end);
      end++;
    }

    const startWithOverscan = Math.max(0, start - overscan);
    const endWithOverscan = Math.min(count, end + overscan);

    const topSpacerFinal = prefixHeight(startWithOverscan);
    let middle = 0;
    for (let i = startWithOverscan; i < endWithOverscan; i++) middle += itemHeight(i);
    const bottomSpacerFinal = Math.max(0, totalHeight.value - topSpacerFinal - middle);

    /* lint hint: silence "topSpacer/bottom" unused (we may export later) */
    void bottom;
    void topSpacer;

    return {
      enabled: true,
      startIndex: startWithOverscan,
      endIndex: endWithOverscan,
      topSpacer: topSpacerFinal,
      bottomSpacer: bottomSpacerFinal,
    };
  });

  return {
    window,
    totalHeight,
    updateMeasuredHeight,
    clearMeasured,
    measuredHeights: measured,
  };
}
