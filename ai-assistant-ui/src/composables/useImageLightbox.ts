import { watch, onUnmounted, type Ref } from 'vue';

/**
 * Refactor (T1)：从 AiAssistant.vue 抽出的 #18 图片点击放大功能。
 *
 * - 监听 panel 内任何 img 的点击，命中条件（消息正文 / 待发送图片）时弹全屏预览
 * - 单一 overlay 实例复用，DOM 直接挂 document.body，摆脱 panel 的层级限制
 * - Esc 键和点击 overlay 关闭
 * - 排除 FAB、avatar、自身 overlay 上的 img
 */

interface UseImageLightboxOptions {
  panelRef: Ref<HTMLElement | undefined>;
  closeAriaLabel: () => string;
}

export function useImageLightbox(opts: UseImageLightboxOptions) {
  const { panelRef, closeAriaLabel } = opts;
  let overlayEl: HTMLDivElement | null = null;

  function closeImageLightbox() {
    if (!overlayEl) return;
    (overlayEl as unknown as { _aiTeardown?: () => void })._aiTeardown?.();
    overlayEl.remove();
    overlayEl = null;
  }

  function openImageLightbox(src: string) {
    if (typeof document === 'undefined' || !src) return;
    closeImageLightbox();
    const overlay = document.createElement('div');
    overlay.className = 'ai-image-lightbox-overlay';
    const img = document.createElement('img');
    img.src = src;
    img.alt = '';
    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'ai-image-lightbox-close';
    closeBtn.setAttribute('aria-label', closeAriaLabel() || 'Close');
    closeBtn.textContent = '×';
    overlay.appendChild(img);
    overlay.appendChild(closeBtn);
    const handleClick = (ev: Event) => {
      if (ev.target === overlay || ev.target === closeBtn) closeImageLightbox();
    };
    const handleKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') closeImageLightbox();
    };
    overlay.addEventListener('click', handleClick);
    document.addEventListener('keydown', handleKey);
    (overlay as unknown as { _aiTeardown?: () => void })._aiTeardown = () => {
      overlay.removeEventListener('click', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
    document.body.appendChild(overlay);
    overlayEl = overlay;
  }

  function onPanelImageClick(ev: MouseEvent) {
    const target = ev.target as HTMLElement;
    if (!target || target.tagName !== 'IMG') return;
    const img = target as HTMLImageElement;
    if (!img.src) return;
    if (img.closest('.ai-fab, .ai-assistant-avatar, .ai-image-lightbox-overlay')) return;
    ev.preventDefault();
    ev.stopPropagation();
    openImageLightbox(img.src);
  }

  watch(
    panelRef,
    (el, oldEl) => {
      if (oldEl) oldEl.removeEventListener('click', onPanelImageClick);
      if (el) el.addEventListener('click', onPanelImageClick);
    },
    { immediate: true },
  );

  onUnmounted(() => {
    if (panelRef.value) panelRef.value.removeEventListener('click', onPanelImageClick);
    closeImageLightbox();
  });

  return {
    openImageLightbox,
    closeImageLightbox,
  };
}
