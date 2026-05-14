<template>
  <Teleport to="body">
    <Transition name="ai-modal">
      <div
        v-if="open"
        class="ai-personalize-overlay ai-compare-regions-overlay"
        :class="{ 'ai-dark': isDark }"
        role="presentation"
        @click.self="$emit('close')"
        @keydown.esc.stop.prevent="$emit('close')"
      >
        <div
          ref="dialogRef"
          class="ai-personalize-dialog ai-compare-regions-dialog"
          role="dialog"
          aria-modal="true"
          :aria-labelledby="titleId"
          tabindex="-1"
          @click.stop
        >
          <div class="ai-personalize-head">
            <h2 :id="titleId" class="ai-personalize-title">
              {{ t.compareDialogTitle || 'Compare regions' }}
              <span v-if="sides.length > 2" class="ai-compare-sides-count">
                · {{ sides.length }}-way
              </span>
            </h2>
            <button
              type="button"
              class="ai-personalize-close"
              :aria-label="t.closePanel"
              @click="$emit('close')"
            >
              &times;
            </button>
          </div>

          <!-- K42: pair-tab strip when sides.length > 2. For 2 sides the
               sole pair is rendered directly (no tabs to avoid clutter).
               K47: an extra "All columns" tab appended at the end of the
               strip switches to N-column side-by-side view. -->
          <div
            v-if="pairs.length > 1"
            class="ai-compare-pair-tabs"
            role="tablist"
            :aria-label="t.compareDialogPairTabsAria || 'Comparison pairs'"
          >
            <button
              v-for="(p, idx) in pairs"
              :key="`${p.aSlot}-${p.bSlot}`"
              type="button"
              role="tab"
              class="ai-compare-pair-tab"
              :class="{
                'ai-compare-pair-tab-active': viewMode === 'pair' && activePairIdx === idx,
              }"
              :aria-selected="viewMode === 'pair' && activePairIdx === idx ? 'true' : 'false'"
              @click="
                viewMode = 'pair';
                activePairIdx = idx;
              "
            >
              {{ pairLabel(p) }}
            </button>
            <button
              type="button"
              role="tab"
              class="ai-compare-pair-tab ai-compare-pair-tab-all"
              :class="{ 'ai-compare-pair-tab-active': viewMode === 'all' }"
              :aria-selected="viewMode === 'all' ? 'true' : 'false'"
              @click="viewMode = 'all'"
            >
              {{ t.compareDialogAllColumns || 'All columns' }}
            </button>
          </div>

          <div v-if="viewMode === 'pair'" class="ai-compare-stats" role="status" aria-live="polite">
            <span class="ai-compare-stat ai-compare-stat-equal"> {{ summary.equal }} = </span>
            <span class="ai-compare-stat ai-compare-stat-change"> {{ summary.changed }} ~ </span>
            <span class="ai-compare-stat ai-compare-stat-add"> +{{ summary.added }} </span>
            <span class="ai-compare-stat ai-compare-stat-remove"> -{{ summary.removed }} </span>
            <span class="ai-compare-stat ai-compare-stat-delta"> Δ {{ summary.delta }} </span>
            <span class="ai-compare-stats-spacer" />
            <label class="ai-compare-stats-toggle">
              <input v-model="hideEqual" type="checkbox" />
              <span>{{ t.compareDialogHideEqual || 'Hide unchanged' }}</span>
            </label>
          </div>
          <!-- K47: per-pair stat strip in all-columns view shows N-1 deltas
               vs A so the user gets the big-picture similarity / drift map
               while reading N parallel columns. -->
          <div
            v-else
            class="ai-compare-stats ai-compare-stats-all"
            role="status"
            aria-live="polite"
          >
            <span
              v-for="d in allModeDeltas"
              :key="d.label"
              class="ai-compare-stat"
              :class="
                d.delta === 0
                  ? 'ai-compare-stat-equal'
                  : d.delta > 8
                    ? 'ai-compare-stat-remove'
                    : 'ai-compare-stat-change'
              "
            >
              {{ d.label }} Δ {{ d.delta }}
            </span>
            <span class="ai-compare-stats-spacer" />
            <span class="ai-compare-stats-note">
              {{ t.compareDialogAllColumnsHint || 'Scrolls sync across columns' }}
            </span>
          </div>

          <div class="ai-compare-pair-head">
            <div class="ai-compare-pair-head-left">
              <span class="ai-compare-pair-badge ai-compare-pair-badge-a">
                {{ slotLetter(activePair?.aSlot ?? 0) }}
              </span>
              <span class="ai-compare-pair-label">{{
                activePair?.aLabel || t.compareDialogLeftDefault || 'Side A'
              }}</span>
            </div>
            <div class="ai-compare-pair-head-right">
              <span class="ai-compare-pair-badge ai-compare-pair-badge-b">
                {{ slotLetter(activePair?.bSlot ?? 1) }}
              </span>
              <span class="ai-compare-pair-label">{{
                activePair?.bLabel || t.compareDialogRightDefault || 'Side B'
              }}</span>
            </div>
          </div>

          <div v-if="viewMode === 'pair' && rows.length === 0" class="ai-compare-empty">
            {{ t.compareDialogEmpty || 'No content to compare.' }}
          </div>

          <div v-else-if="viewMode === 'pair'" class="ai-compare-rows" role="table">
            <div
              v-for="(row, idx) in visibleRows"
              :key="idx"
              class="ai-compare-row"
              :class="`ai-compare-row-${row.kind}`"
              role="row"
            >
              <div class="ai-compare-cell ai-compare-cell-num" role="cell">
                {{ row.leftLine ?? '' }}
              </div>
              <div class="ai-compare-cell ai-compare-cell-left" role="cell">
                <pre class="ai-compare-pre">{{ row.leftText }}</pre>
              </div>
              <div class="ai-compare-cell ai-compare-cell-num" role="cell">
                {{ row.rightLine ?? '' }}
              </div>
              <div class="ai-compare-cell ai-compare-cell-right" role="cell">
                <pre class="ai-compare-pre">{{ row.rightText }}</pre>
              </div>
            </div>
          </div>

          <!-- K47: N-column all-columns view. Each column scrolls independently
               but vertical scroll syncs via onAllScroll below. -->
          <div v-else class="ai-compare-all-cols" role="table">
            <div
              v-for="(s, slotIdx) in sides"
              :ref="(el) => setAllColRef(slotIdx, el as HTMLElement | null)"
              :key="`all-${slotIdx}-${s.msgIndex}`"
              class="ai-compare-all-col"
              role="cell"
              @scroll.passive="onAllScroll($event, slotIdx)"
            >
              <div class="ai-compare-all-col-head">
                <span class="ai-compare-pair-badge" :class="`ai-compare-pair-badge-${slotIdx}`">
                  {{ slotLetter(slotIdx) }}
                </span>
                <span class="ai-compare-pair-label">{{ s.label }}</span>
              </div>
              <pre class="ai-compare-pre ai-compare-all-pre">{{ s.content }}</pre>
            </div>
          </div>

          <div class="ai-personalize-actions">
            <button
              v-if="sides.length > 2"
              type="button"
              class="ai-personalize-done ai-compare-clear"
              @click="$emit('clear-set')"
            >
              {{ t.compareDialogClearSet || 'Clear set' }}
            </button>
            <button
              v-if="activePair"
              type="button"
              class="ai-personalize-done ai-compare-swap"
              @click="$emit('swap-pair', activePair.aSlot, activePair.bSlot)"
            >
              {{
                (t.compareDialogSwapPair || 'Swap {a} ⇄ {b}')
                  .replace('{a}', slotLetter(activePair.aSlot))
                  .replace('{b}', slotLetter(activePair.bSlot))
              }}
            </button>
            <button type="button" class="ai-personalize-done" @click="$emit('close')">
              {{ t.personalizeDone || 'Done' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import type { I18nMessages } from '../utils/i18n';
import { diffLines } from '../composables/useLineDiff';

export interface CompareSideView {
  msgIndex: number;
  content: string;
  label: string;
}

interface PairView {
  aSlot: number;
  bSlot: number;
  aLabel: string;
  bLabel: string;
  aText: string;
  bText: string;
}

const props = defineProps<{
  open: boolean;
  isDark: boolean;
  t: I18nMessages;
  /** K42: 1-4 sides (only when length >= 2 is the dialog functionally usable). */
  sides: CompareSideView[];
}>();

defineEmits<{
  (e: 'close'): void;
  /** K42: swap two slots in the parent's compareSet (slot indices, not msgIndex). */
  (e: 'swap-pair', aSlot: number, bSlot: number): void;
  /** K42: clear the entire compare set (only relevant for N > 2). */
  (e: 'clear-set'): void;
}>();

const titleId = `ai-compare-title-${Math.random().toString(36).slice(2, 8)}`;
const hideEqual = ref(false);
const activePairIdx = ref(0);
/** K47: 'pair' = K42 single-pair diff. 'all' = N-column synced-scroll view. */
const viewMode = ref<'pair' | 'all'>('pair');

const dialogRef = ref<HTMLDivElement>();
watch(
  () => props.open,
  (v) => {
    if (v) {
      activePairIdx.value = 0;
      viewMode.value = 'pair';
      void nextTick(() => {
        dialogRef.value?.focus();
      });
    }
  },
);
watch(
  () => props.sides.length,
  () => {
    activePairIdx.value = 0;
  },
);

function slotLetter(slot: number): string {
  return String.fromCharCode(65 + slot);
}

/**
 * K47: synced-scroll plumbing.
 *
 * - allColRefs[i] is the i-th column's scroll container.
 * - syncScrolling = true guard prevents the scroll handler from re-emitting
 *   scroll events when WE programmatically set scrollTop on the other
 *   columns (would otherwise infinite-loop).
 * - Aligns vertical scrollTop only — horizontal independent so very long
 *   lines in one column don't drag the others sideways.
 */
const allColRefs: Record<number, HTMLElement | null> = {};
let syncScrolling = false;
function setAllColRef(slotIdx: number, el: HTMLElement | null) {
  allColRefs[slotIdx] = el;
}
function onAllScroll(_e: Event, slotIdx: number) {
  if (syncScrolling) return;
  const src = allColRefs[slotIdx];
  if (!src) return;
  syncScrolling = true;
  try {
    const top = src.scrollTop;
    for (const [keyStr, el] of Object.entries(allColRefs)) {
      const k = Number(keyStr);
      if (k !== slotIdx && el) el.scrollTop = top;
    }
  } finally {
    /* Yield to next frame so dependent scroll events fire before flipping
     * the guard back off. */
    requestAnimationFrame(() => {
      syncScrolling = false;
    });
  }
}

/**
 * K42: build C(n, 2) pair list when N > 2.
 *
 * Order: lexicographic on (aSlot, bSlot) so tab order is stable (A-B, A-C,
 * A-D, B-C, B-D, C-D for 4 sides). With only 2 sides this is the single
 * tab A-B that's rendered inline without the tab strip.
 */
const pairs = computed<PairView[]>(() => {
  const out: PairView[] = [];
  const n = props.sides.length;
  for (let a = 0; a < n; a++) {
    for (let b = a + 1; b < n; b++) {
      const sa = props.sides[a]!;
      const sb = props.sides[b]!;
      out.push({
        aSlot: a,
        bSlot: b,
        aLabel: sa.label,
        bLabel: sb.label,
        aText: sa.content,
        bText: sb.content,
      });
    }
  }
  return out;
});

function pairLabel(p: PairView): string {
  return `${slotLetter(p.aSlot)} ⇄ ${slotLetter(p.bSlot)}`;
}

const activePair = computed(() => pairs.value[activePairIdx.value] ?? null);

const diff = computed(() => {
  const p = activePair.value;
  if (!p) return diffLines('', '');
  return diffLines(p.aText, p.bText);
});
const rows = computed(() => diff.value.rows);
const summary = computed(() => diff.value.summary);
const visibleRows = computed(() =>
  hideEqual.value ? rows.value.filter((r) => r.kind !== 'equal') : rows.value,
);

/**
 * K47: in all-columns mode, show per-(A,X) delta for X in B..D so user gets
 * the similarity map at a glance. Hides pure-equal pair entries to keep
 * the bar uncluttered (those columns are "structurally identical to A").
 */
const allModeDeltas = computed(() => {
  const out: { label: string; delta: number }[] = [];
  if (props.sides.length < 2) return out;
  const baseText = props.sides[0]!.content;
  for (let i = 1; i < props.sides.length; i++) {
    const cmp = diffLines(baseText, props.sides[i]!.content);
    out.push({
      label: `A↔${slotLetter(i)}`,
      delta: cmp.summary.delta,
    });
  }
  return out;
});
</script>

<style scoped>
.ai-compare-regions-dialog {
  width: min(960px, calc(100vw - 32px));
  max-width: none;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
}

.ai-compare-sides-count {
  font-size: 13px;
  font-weight: 500;
  color: #64748b;
  margin-left: 6px;
}
.ai-dark .ai-compare-sides-count {
  color: #94a3b8;
}

/* K42: pair-tab strip rendered only for sides.length > 2. */
.ai-compare-pair-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 8px 0;
  border-bottom: 1px solid rgba(148, 163, 184, 0.2);
}
.ai-compare-pair-tab {
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 600;
  border: 1px solid rgba(148, 163, 184, 0.3);
  background: transparent;
  border-radius: 14px;
  cursor: pointer;
  color: #475569;
  transition:
    background 0.12s ease,
    border-color 0.12s ease;
  font-variant-numeric: tabular-nums;
}
.ai-compare-pair-tab:hover {
  background: rgba(59, 130, 246, 0.08);
}
.ai-compare-pair-tab-active {
  background: rgba(59, 130, 246, 0.18);
  border-color: rgba(59, 130, 246, 0.55);
  color: #1d4ed8;
}
.ai-dark .ai-compare-pair-tab {
  color: #cbd5e1;
  border-color: rgba(71, 85, 105, 0.55);
}
.ai-dark .ai-compare-pair-tab:hover {
  background: rgba(59, 130, 246, 0.16);
}
.ai-dark .ai-compare-pair-tab-active {
  background: rgba(59, 130, 246, 0.32);
  color: #93c5fd;
}

.ai-compare-stats {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 0 10px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.2);
  font-size: 12px;
  color: #475569;
  font-variant-numeric: tabular-nums;
}

.ai-dark .ai-compare-stats {
  color: #cbd5e1;
  border-bottom-color: rgba(71, 85, 105, 0.45);
}

.ai-compare-stat {
  display: inline-flex;
  padding: 1px 8px;
  border-radius: 4px;
  font-weight: 600;
  background: rgba(148, 163, 184, 0.18);
}

.ai-compare-stat-equal {
  background: rgba(148, 163, 184, 0.18);
}
.ai-compare-stat-change {
  background: rgba(250, 204, 21, 0.18);
  color: #92400e;
}
.ai-dark .ai-compare-stat-change {
  color: #fef3c7;
}
.ai-compare-stat-add {
  background: rgba(34, 197, 94, 0.18);
  color: #15803d;
}
.ai-dark .ai-compare-stat-add {
  color: #bbf7d0;
}
.ai-compare-stat-remove {
  background: rgba(239, 68, 68, 0.18);
  color: #b91c1c;
}
.ai-dark .ai-compare-stat-remove {
  color: #fecaca;
}
.ai-compare-stat-delta {
  background: rgba(59, 130, 246, 0.18);
  color: #1d4ed8;
}
.ai-dark .ai-compare-stat-delta {
  color: #bfdbfe;
}
.ai-compare-stats-spacer {
  flex: 1 1 auto;
}
.ai-compare-stats-toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  user-select: none;
  font-weight: 500;
}
.ai-compare-stats-toggle input[type='checkbox'] {
  accent-color: #3b82f6;
  cursor: pointer;
}

.ai-compare-pair-head {
  display: grid;
  grid-template-columns: 40px 1fr 40px 1fr;
  align-items: center;
  padding: 10px 0 6px;
  font-size: 12px;
  color: #1e293b;
  font-weight: 600;
}
.ai-dark .ai-compare-pair-head {
  color: #e2e8f0;
}
.ai-compare-pair-head-left,
.ai-compare-pair-head-right {
  grid-column: span 2;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 6px;
}
.ai-compare-pair-badge {
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 700;
  color: #fff;
}
.ai-compare-pair-badge-a,
.ai-compare-pair-badge-0 {
  background: #ef4444;
}
.ai-compare-pair-badge-b,
.ai-compare-pair-badge-1 {
  background: #22c55e;
}
.ai-compare-pair-badge-2 {
  background: #3b82f6;
}
.ai-compare-pair-badge-3 {
  background: #a855f7;
}
.ai-compare-pair-label {
  font-size: 12px;
  font-weight: 500;
  color: inherit;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ai-compare-empty {
  padding: 28px;
  text-align: center;
  color: #64748b;
  font-size: 13px;
}

.ai-compare-rows {
  flex: 1 1 auto;
  overflow: auto;
  border-top: 1px solid rgba(148, 163, 184, 0.2);
  border-bottom: 1px solid rgba(148, 163, 184, 0.2);
  background: #fafafa;
}
.ai-dark .ai-compare-rows {
  background: rgba(15, 23, 42, 0.5);
  border-top-color: rgba(71, 85, 105, 0.5);
  border-bottom-color: rgba(71, 85, 105, 0.5);
}

.ai-compare-row {
  display: grid;
  grid-template-columns: 40px 1fr 40px 1fr;
  min-height: 22px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.1);
}
.ai-compare-row:hover {
  background: rgba(148, 163, 184, 0.06);
}

.ai-compare-cell {
  padding: 2px 8px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace;
  font-size: 12px;
  line-height: 1.45;
  overflow: hidden;
}
.ai-compare-cell-num {
  text-align: right;
  color: #94a3b8;
  font-size: 11px;
  padding-right: 8px;
  background: rgba(148, 163, 184, 0.08);
  border-right: 1px solid rgba(148, 163, 184, 0.18);
}
.ai-compare-cell-left,
.ai-compare-cell-right {
  white-space: pre-wrap;
  word-break: break-word;
  min-width: 0;
}

.ai-compare-pre {
  margin: 0;
  font-family: inherit;
  white-space: pre-wrap;
  word-break: break-word;
}

/* Row kinds: green added, red removed, amber changed, neutral equal. */
.ai-compare-row-add .ai-compare-cell-right {
  background: rgba(34, 197, 94, 0.16);
  color: #15803d;
}
.ai-compare-row-remove .ai-compare-cell-left {
  background: rgba(239, 68, 68, 0.16);
  color: #b91c1c;
}
.ai-compare-row-change .ai-compare-cell-left {
  background: rgba(239, 68, 68, 0.1);
}
.ai-compare-row-change .ai-compare-cell-right {
  background: rgba(34, 197, 94, 0.1);
}

.ai-dark .ai-compare-row-add .ai-compare-cell-right {
  background: rgba(34, 197, 94, 0.18);
  color: #bbf7d0;
}
.ai-dark .ai-compare-row-remove .ai-compare-cell-left {
  background: rgba(239, 68, 68, 0.18);
  color: #fecaca;
}
.ai-dark .ai-compare-row-change .ai-compare-cell-left {
  background: rgba(239, 68, 68, 0.12);
}
.ai-dark .ai-compare-row-change .ai-compare-cell-right {
  background: rgba(34, 197, 94, 0.12);
}

.ai-compare-swap {
  background: rgba(59, 130, 246, 0.12) !important;
  color: #1d4ed8 !important;
  margin-right: 8px;
}
.ai-dark .ai-compare-swap {
  background: rgba(59, 130, 246, 0.22) !important;
  color: #93c5fd !important;
}
.ai-compare-clear {
  background: rgba(239, 68, 68, 0.12) !important;
  color: #b91c1c !important;
  margin-right: 8px;
}
.ai-dark .ai-compare-clear {
  background: rgba(239, 68, 68, 0.22) !important;
  color: #fecaca !important;
}

/* K47: All-columns view ---------------------------------------------- */
.ai-compare-stats-all {
  flex-wrap: wrap;
}
.ai-compare-stats-note {
  font-size: 11px;
  font-style: italic;
  color: #94a3b8;
}
.ai-compare-pair-tab-all {
  border-style: dashed;
}
.ai-compare-all-cols {
  flex: 1 1 auto;
  display: grid;
  grid-template-columns: repeat(var(--cmp-cols, 1), minmax(0, 1fr));
  gap: 1px;
  border-top: 1px solid rgba(148, 163, 184, 0.2);
  border-bottom: 1px solid rgba(148, 163, 184, 0.2);
  background: rgba(148, 163, 184, 0.2);
  overflow: hidden;
}
.ai-compare-all-cols:has(> .ai-compare-all-col:nth-child(2)) {
  --cmp-cols: 2;
}
.ai-compare-all-cols:has(> .ai-compare-all-col:nth-child(3)) {
  --cmp-cols: 3;
}
.ai-compare-all-cols:has(> .ai-compare-all-col:nth-child(4)) {
  --cmp-cols: 4;
}
.ai-compare-all-col {
  background: #fafafa;
  overflow: auto;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}
.ai-dark .ai-compare-all-col {
  background: rgba(15, 23, 42, 0.55);
}
.ai-compare-all-col-head {
  position: sticky;
  top: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 10px;
  background: rgba(248, 250, 252, 0.95);
  border-bottom: 1px solid rgba(148, 163, 184, 0.25);
  z-index: 1;
}
.ai-dark .ai-compare-all-col-head {
  background: rgba(15, 23, 42, 0.95);
  border-bottom-color: rgba(71, 85, 105, 0.45);
}
.ai-compare-all-pre {
  flex: 1 1 auto;
  padding: 8px 12px;
  margin: 0;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace;
  font-size: 12px;
  line-height: 1.45;
  color: #1e293b;
  white-space: pre-wrap;
  word-break: break-word;
}
.ai-dark .ai-compare-all-pre {
  color: #e2e8f0;
}
</style>
