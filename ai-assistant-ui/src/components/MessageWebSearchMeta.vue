<template>
  <div v-if="mode !== 'early' && sourceUrls.length > 0" class="ai-web-search-sources">
    <span class="ai-web-search-sources-label">
      {{ referencesLabel }}
    </span>
    <a
      v-for="(url, sourceIdx) in sourceUrls"
      :key="`${messageKey}-inline-source-${sourceIdx}`"
      :href="url"
      target="_blank"
      rel="noopener noreferrer"
      @click.stop
    >
      {{ sourceIdx + 1 }}
    </a>
  </div>
  <div v-if="visiblePreviews.length > 0" class="ai-web-search-preview-cards">
    <a
      v-for="(source, sourceIdx) in visiblePreviews"
      :key="`${messageKey}-source-preview-${sourceIdx}`"
      class="ai-web-search-preview-card"
      :href="source.url"
      target="_blank"
      rel="noopener noreferrer"
      @click.stop
    >
      <span class="ai-src-head">
        <span class="ai-src-favicon" aria-hidden="true">{{ domainInitial(source.url) }}</span>
        <span class="ai-src-index" aria-hidden="true">{{ sourceIdx + 1 }}</span>
        <span class="ai-src-headtext">
          <span class="ai-web-search-preview-title">{{ source.title || source.url }}</span>
          <span v-if="domainOf(source.url)" class="ai-src-domain">{{ domainOf(source.url) }}</span>
        </span>
        <span v-if="source.qualityLabel" class="ai-web-search-preview-quality">
          {{ source.qualityLabel }}
        </span>
      </span>
      <span v-if="source.snippet" class="ai-web-search-preview-snippet">
        {{ source.snippet }}
      </span>
      <span class="ai-src-actions">
        <button
          v-if="source.url"
          type="button"
          class="ai-src-action ai-web-search-preview-copy"
          :title="copyLabel"
          :aria-label="copyLabel"
          @click.prevent.stop="copySourceCitation(sourceIdx, source.url)"
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <rect x="9" y="9" width="11" height="11" rx="2" />
            <path d="M5 15V5a2 2 0 0 1 2-2h10" />
          </svg>
        </button>
        <button
          v-if="source.url"
          type="button"
          class="ai-src-action"
          :class="{ 'ai-src-action-on': pinnedUrls.has(source.url) }"
          :title="pinnedUrls.has(source.url) ? unpinLabel : pinLabel"
          :aria-label="pinnedUrls.has(source.url) ? unpinLabel : pinLabel"
          @click.prevent.stop="togglePinned(source.url)"
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M9 4h6l-1 6 3 3v2H7v-2l3-3-1-6z" />
            <path d="M12 15v5" />
          </svg>
        </button>
        <button
          v-if="source.url"
          type="button"
          class="ai-src-action"
          :title="hideLabel"
          :aria-label="hideLabel"
          @click.prevent.stop="hideSource(source.url)"
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M3 3l18 18" />
            <path
              d="M10.6 5.1A9 9 0 0 1 21 12a9.3 9.3 0 0 1-2.2 3M6.6 6.6A9.2 9.2 0 0 0 3 12a9 9 0 0 0 12 4.9"
            />
          </svg>
        </button>
      </span>
    </a>
  </div>
  <div
    v-if="mode !== 'early' && citationWarning"
    class="ai-web-search-citation-warning"
    role="note"
  >
    <span>{{ citationWarning }}</span>
    <button
      type="button"
      class="ai-web-search-citation-regenerate"
      @click="emit('regenerate-with-citations')"
    >
      Regenerate with citations
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import type { Message } from '../types/message';
import type { I18nMessages } from '../utils/i18n';

const props = withDefaults(
  defineProps<{
    meta?: Message['meta'];
    content: string;
    messageKey: string;
    referencesLabel: string;
    mode?: 'full' | 'early';
    t?: I18nMessages;
  }>(),
  {
    meta: undefined,
    mode: 'full',
    t: undefined,
  },
);

const copyLabel = computed(() => props.t?.citationCopy || 'Copy');
const pinLabel = computed(() => props.t?.citationPin || 'Pin');
const unpinLabel = computed(() => props.t?.citationUnpin || 'Unpin');
const hideLabel = computed(() => props.t?.citationHide || 'Hide');

/** Extract a clean host (no leading www.) from a source URL; '' if invalid. */
function domainOf(url?: string): string {
  if (!url) return '';
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}
/** First letter of the domain, for the favicon-less source avatar block. */
function domainInitial(url?: string): string {
  const d = domainOf(url);
  return d ? d.charAt(0).toUpperCase() : '?';
}

const emit = defineEmits<{
  (e: 'regenerate-with-citations'): void;
}>();

const sourceUrls = computed(() =>
  (props.meta?.webSearchSourceUrls || []).filter((url) => typeof url === 'string' && url.trim()),
);

const sourcePreviews = computed(() =>
  (props.meta?.webSearchSourcePreviews || []).filter(
    (source) => source && (source.title || source.url || source.snippet),
  ),
);

const pinnedUrls = ref<Set<string>>(new Set());
const hiddenUrls = ref<Set<string>>(new Set());

const visiblePreviews = computed(() => {
  const pinned = pinnedUrls.value;
  const hidden = hiddenUrls.value;
  return sourcePreviews.value
    .filter((source) => !source.url || !hidden.has(source.url))
    .slice()
    .sort((a, b) => Number(pinned.has(b.url || '')) - Number(pinned.has(a.url || '')));
});

const citationWarning = computed(() => {
  const meta = props.meta;
  if (!meta?.webSearchEnabled) return '';
  const sourceCount =
    sourceUrls.value.length || sourcePreviews.value.length || meta.webSearchResultCount || 0;
  if (sourceCount <= 0) return '';
  const refs = Array.from(props.content.matchAll(/\[(\d+)\]/g)).map((match) => Number(match[1]));
  if (refs.length === 0) return 'Citation check: no source number cited.';
  if (refs.some((ref) => !Number.isInteger(ref) || ref < 1 || ref > sourceCount)) {
    return 'Citation check: referenced source number is unavailable.';
  }
  return '';
});

function copySourceCitation(sourceIdx: number, url?: string) {
  if (!url || !navigator?.clipboard?.writeText) return;
  void navigator.clipboard.writeText(`[${sourceIdx + 1}] ${url}`);
}

function togglePinned(url?: string) {
  if (!url) return;
  const next = new Set(pinnedUrls.value);
  if (next.has(url)) next.delete(url);
  else next.add(url);
  pinnedUrls.value = next;
}

function hideSource(url?: string) {
  if (!url) return;
  const next = new Set(hiddenUrls.value);
  next.add(url);
  hiddenUrls.value = next;
}
</script>
