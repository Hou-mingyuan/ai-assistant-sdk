import { computed, ref, watch, onUnmounted, type ComputedRef, type Ref } from 'vue';
import { useMessageVirtualScroll } from './useMessageVirtualScroll';
import type { AiAssistantOptions } from '../index';

/**
 * Refactor (T1-Wave3)：把 AiAssistant.vue 里"消息区滚动 + 显示 scrollToBottom 按钮 +
 * C10 虚拟滚动接入"三块零散逻辑整合到一个 composable。
 *
 * 调用契约：
 *
 * - 父组件持有 `bodyRef` HTMLElement ref（消息容器 div）
 * - 父组件持有 `displayedMessages.length`（已经过 session search 折叠的可视消息数）
 * - 父组件需要把模板的 `@scroll.passive` 绑到本 composable 暴露的 `onBodyScrollForVirtual`
 * - 父组件需要把 `MessageList` 的 `:virtual-slice` 绑到 `virtualSliceForList`
 * - 父组件需要把 `MessageList` 的 `:on-measure-height` 绑到（启用时）`onVirtualMeasureHeight`
 *
 * 与原版完全等价的行为：
 *
 * - 普通滚动监听 listener 在 bodyRef 变化时 add/remove；`onUnmounted` 时移除
 * - showScrollToBottomBtn 距底 300px 触发
 * - 虚拟滚动通过 rAF 合并 scroll 事件，避免主线程阻塞
 * - 测量到的真实高度 > 估算时自动修正 scrollTop，保持 viewport 稳定
 */

interface UseScrollAndVirtualOptions {
  bodyRef: Ref<HTMLElement | undefined>;
  displayedMessageCount: ComputedRef<number>;
  /** 来自 reactive(options) 的 virtualScroll 配置；本 composable 只读 */
  virtualScrollOption: ComputedRef<{ threshold: number; estimatedItemHeight: number } | null>;
}

export function useScrollAndVirtual(opts: UseScrollAndVirtualOptions) {
  const { bodyRef, displayedMessageCount, virtualScrollOption } = opts;

  const showScrollToBottomBtn = ref(false);

  function onBodyScroll() {
    const el = bodyRef.value;
    if (!el) return;
    showScrollToBottomBtn.value = el.scrollHeight - el.scrollTop - el.clientHeight > 300;
  }

  function scrollToBottomClick() {
    const el = bodyRef.value;
    if (el) {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    }
  }

  watch(
    bodyRef,
    (el, oldEl) => {
      if (oldEl) oldEl.removeEventListener('scroll', onBodyScroll);
      if (el) el.addEventListener('scroll', onBodyScroll, { passive: true });
    },
    { immediate: true },
  );

  onUnmounted(() => {
    if (bodyRef.value) bodyRef.value.removeEventListener('scroll', onBodyScroll);
  });

  // ── 虚拟滚动（C10：opt-in）──
  const virtualScrollTop = ref(0);
  const virtualViewportHeight = ref(0);

  const virtualScroll = useMessageVirtualScroll({
    messageCount: displayedMessageCount,
    scrollTop: virtualScrollTop,
    viewportHeight: virtualViewportHeight,
    estimatedItemHeight: virtualScrollOption.value?.estimatedItemHeight ?? 90,
    minActivationCount: virtualScrollOption.value?.threshold ?? 60,
  });

  const virtualSliceForList = computed(() =>
    virtualScrollOption.value ? virtualScroll.window.value : null,
  );

  function onVirtualMeasureHeight(index: number, height: number) {
    const delta = virtualScroll.updateMeasuredHeight(index, height);
    const slice = virtualScroll.window.value;
    const el = bodyRef.value;
    if (!delta || !slice.enabled || !el || index >= slice.startIndex) return;
    el.scrollTop += delta;
    virtualScrollTop.value = el.scrollTop;
  }

  let virtualScrollRaf = 0;
  function onBodyScrollForVirtual() {
    if (!virtualScrollOption.value) return;
    if (virtualScrollRaf) return;
    virtualScrollRaf = requestAnimationFrame(() => {
      virtualScrollRaf = 0;
      const el = bodyRef.value;
      if (!el) return;
      virtualScrollTop.value = el.scrollTop;
      virtualViewportHeight.value = el.clientHeight;
    });
  }

  return {
    showScrollToBottomBtn,
    scrollToBottomClick,
    virtualScrollTop,
    virtualViewportHeight,
    virtualSliceForList,
    onVirtualMeasureHeight,
    onBodyScrollForVirtual,
    /** 暴露原始 virtualScroll 实例供调用方在 panel resize 等场景手动 sync viewport */
    virtualScroll,
  };
}

/**
 * 辅助：从 AiAssistantOptions.virtualScroll 解析出标准化的 {threshold, estimatedItemHeight}
 * 配置；undefined/false → null（关闭虚拟滚动）。抽出来便于调用方在 watch options 时复用。
 */
export function resolveVirtualScrollOption(
  v: AiAssistantOptions['virtualScroll'],
): { threshold: number; estimatedItemHeight: number } | null {
  if (v === true) return { threshold: 60, estimatedItemHeight: 90 };
  if (v && typeof v === 'object')
    return { threshold: v.threshold ?? 60, estimatedItemHeight: v.estimatedItemHeight ?? 90 };
  return null;
}
