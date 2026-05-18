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
 *   维护一份 height 缓存和实测差值树，避免每次滚动都从第 0 条重新累加。
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

class FenwickTree {
  private readonly tree: number[];

  constructor(readonly size: number) {
    this.tree = Array(size + 1).fill(0);
  }

  add(index: number, delta: number) {
    for (let i = index + 1; i <= this.size; i += i & -i) {
      this.tree[i] += delta;
    }
  }

  prefix(upToExclusive: number): number {
    let sum = 0;
    for (let i = Math.min(upToExclusive, this.size); i > 0; i -= i & -i) {
      sum += this.tree[i];
    }
    return sum;
  }

  total(): number {
    return this.prefix(this.size);
  }
}

export function useMessageVirtualScroll(opts: UseMessageVirtualScrollOptions) {
  const estimatedItemHeight = Math.max(20, opts.estimatedItemHeight ?? DEFAULT_ITEM_HEIGHT);
  const overscan = Math.max(0, opts.overscan ?? DEFAULT_OVERSCAN);
  const minActivationCount = Math.max(1, opts.minActivationCount ?? DEFAULT_MIN_ACTIVATION);

  const measured = ref<Map<number, number>>(new Map());
  let treeSize = 0;
  let measuredDeltas = new Map<number, number>();
  let heightTree = new FenwickTree(0);

  function ensureTreeSize(count: number) {
    if (treeSize === count) return;
    treeSize = count;
    const nextDeltas = new Map<number, number>();
    heightTree = new FenwickTree(count);
    for (const [index, height] of measured.value) {
      if (index >= count) continue;
      const delta = height - estimatedItemHeight;
      nextDeltas.set(index, delta);
      heightTree.add(index, delta);
    }
    measuredDeltas = nextDeltas;
  }

  function updateMeasuredHeight(index: number, height: number): number {
    if (index < 0 || height <= 0) return 0;
    const prev = measured.value.get(index);
    if (prev === height) return 0;
    const next = new Map(measured.value);
    next.set(index, height);
    measured.value = next;
    const prevEffectiveHeight = prev ?? estimatedItemHeight;
    ensureTreeSize(opts.messageCount.value);
    if (index < treeSize) {
      const nextDelta = height - estimatedItemHeight;
      const prevDelta = measuredDeltas.get(index) ?? 0;
      measuredDeltas.set(index, nextDelta);
      heightTree.add(index, nextDelta - prevDelta);
    }
    return height - prevEffectiveHeight;
  }

  function clearMeasured() {
    if (measured.value.size === 0) return;
    measured.value = new Map();
    measuredDeltas = new Map();
    heightTree = new FenwickTree(treeSize);
  }

  function itemHeight(i: number): number {
    return measured.value.get(i) ?? estimatedItemHeight;
  }

  function prefixHeight(upToExclusive: number): number {
    if (upToExclusive <= 0) return 0;
    ensureTreeSize(opts.messageCount.value);
    const capped = Math.min(upToExclusive, treeSize);
    return capped * estimatedItemHeight + heightTree.prefix(capped);
  }

  const totalHeight = computed(() => {
    const total = opts.messageCount.value;
    ensureTreeSize(total);
    return total * estimatedItemHeight + heightTree.total();
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
    ensureTreeSize(count);
    let start = Math.min(count, Math.floor(top / estimatedItemHeight));
    if (measured.value.size > 0) {
      let low = 0;
      let high = count;
      while (low < high) {
        const mid = Math.floor((low + high) / 2);
        if (prefixHeight(mid + 1) > top) high = mid;
        else low = mid + 1;
      }
      start = Math.min(low, count);
    }
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
