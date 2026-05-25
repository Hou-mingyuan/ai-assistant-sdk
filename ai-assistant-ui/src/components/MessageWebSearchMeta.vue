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
  <div v-if="sourcePreviews.length > 0" class="ai-web-search-preview-cards">
    <a
      v-for="(source, sourceIdx) in sourcePreviews"
      :key="`${messageKey}-source-preview-${sourceIdx}`"
      class="ai-web-search-preview-card"
      :href="source.url"
      target="_blank"
      rel="noopener noreferrer"
      @click.stop
    >
      <span class="ai-web-search-preview-title">{{ source.title || source.url }}</span>
      <span v-if="source.qualityLabel" class="ai-web-search-preview-quality">
        {{ source.qualityLabel }}
      </span>
      <button
        v-if="source.url"
        type="button"
        class="ai-web-search-preview-copy"
        @click.prevent.stop="copySourceCitation(sourceIdx, source.url)"
      >
        Copy [{{ sourceIdx + 1 }}]
      </button>
      <span v-if="source.snippet" class="ai-web-search-preview-snippet">
        {{ source.snippet }}
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
import { computed } from 'vue';
import type { Message } from '../types/message';

const props = withDefaults(
  defineProps<{
    meta?: Message['meta'];
    content: string;
    messageKey: string;
    referencesLabel: string;
    mode?: 'full' | 'early';
  }>(),
  {
    meta: undefined,
    mode: 'full',
  },
);

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
</script>
