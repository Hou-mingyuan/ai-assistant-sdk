import { reactive, watch, onBeforeUnmount, type Ref } from 'vue';

/**
 * Hover/focus card state for inline `[n]` citation chips (reading/citation v2.1).
 *
 * The chips are produced as static HTML by `linkifyCitations` and injected via
 * v-html inside message bubbles, which carry `contain: paint` for performance —
 * so an in-flow popover would be clipped. This composable instead drives a single
 * shared card that a parent Teleports to <body>, positioned from the chip's
 * bounding rect, escaping the containment.
 *
 * Attach it to the scroll container (e.g. the chat body) via a template ref:
 * event delegation means it works for chips added/removed by virtual scrolling.
 */
export interface CitationCardState {
  visible: boolean;
  x: number;
  y: number;
  title: string;
  domain: string;
  snippet: string;
}

const CARD_WIDTH = 260;

export function useCitationHover(rootRef: Ref<HTMLElement | null | undefined>) {
  const citationCard = reactive<CitationCardState>({
    visible: false,
    x: 0,
    y: 0,
    title: '',
    domain: '',
    snippet: '',
  });

  function citeFromEvent(event: Event): HTMLElement | null {
    const target = event.target as HTMLElement | null;
    if (!target || typeof target.closest !== 'function') return null;
    return target.closest('.ai-cite');
  }

  function show(chip: HTMLElement) {
    const title = chip.getAttribute('data-cite-title') || '';
    const domain = chip.getAttribute('data-cite-domain') || '';
    const snippet = chip.getAttribute('data-cite-snippet') || '';
    if (!title && !domain && !snippet) return;
    const rect = chip.getBoundingClientRect();
    citationCard.title = title;
    citationCard.domain = domain;
    citationCard.snippet = snippet;
    citationCard.x = Math.max(8, Math.min(rect.left, window.innerWidth - CARD_WIDTH - 8));
    citationCard.y = rect.bottom + 6;
    citationCard.visible = true;
  }

  function hide() {
    citationCard.visible = false;
  }

  const onOver = (e: Event) => {
    const chip = citeFromEvent(e);
    if (chip) show(chip);
  };
  const onOut = (e: Event) => {
    if (citeFromEvent(e)) hide();
  };
  const onFocusIn = (e: Event) => {
    const chip = citeFromEvent(e);
    if (chip) show(chip);
  };
  const onFocusOut = (e: Event) => {
    if (citeFromEvent(e)) hide();
  };

  let attached: HTMLElement | null = null;

  function detach() {
    if (!attached) return;
    attached.removeEventListener('mouseover', onOver);
    attached.removeEventListener('mouseout', onOut);
    attached.removeEventListener('focusin', onFocusIn);
    attached.removeEventListener('focusout', onFocusOut);
    attached.removeEventListener('scroll', hide);
    attached = null;
  }

  function attach(node: HTMLElement | null) {
    detach();
    if (!node) return;
    attached = node;
    node.addEventListener('mouseover', onOver);
    node.addEventListener('mouseout', onOut);
    node.addEventListener('focusin', onFocusIn);
    node.addEventListener('focusout', onFocusOut);
    node.addEventListener('scroll', hide, { passive: true });
  }

  watch(rootRef, (node) => attach(node ?? null), { immediate: true });
  onBeforeUnmount(detach);

  return { citationCard };
}
