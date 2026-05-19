<template>
  <!--
    顶部会话内消息搜索栏。Enter / Shift+Enter 上下跳；选项菜单提供大小写敏感、
    全词匹配、正则三档；空查询时不显示导航与选项按钮。
    Refactor (T1)：从 AiAssistant.vue 抽出。
  -->
  <div
    class="ai-chat-search"
    :class="{
      'ai-chat-search-active': !!debouncedQuery.trim(),
      'ai-chat-search-empty': !!debouncedQuery.trim() && totalMatches === 0,
    }"
  >
    <input
      :value="inputValue"
      type="search"
      class="ai-chat-search-input"
      :placeholder="t.searchMessages"
      :aria-label="t.searchMessages"
      autocomplete="off"
      @input="(ev) => emit('update:input', (ev.target as HTMLInputElement).value)"
      @keydown.enter.exact.prevent="emit('next')"
      @keydown.enter.shift.prevent="emit('prev')"
    />
    <span
      v-if="countLabel"
      class="ai-search-count"
      :class="{ 'ai-search-count-empty': totalMatches === 0 }"
    >
      {{ countLabel }}
    </span>
    <button
      v-if="debouncedQuery.trim()"
      type="button"
      class="ai-search-nav"
      :disabled="totalMatches === 0"
      :aria-label="t.searchPrev"
      @click="emit('prev')"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z" />
      </svg>
    </button>
    <button
      v-if="debouncedQuery.trim()"
      type="button"
      class="ai-search-nav"
      :disabled="totalMatches === 0"
      :aria-label="t.searchNext"
      @click="emit('next')"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z" />
      </svg>
    </button>
    <div v-if="debouncedQuery.trim()" class="ai-search-options">
      <button
        type="button"
        class="ai-search-options-toggle"
        :class="{ active: caseSensitive || wholeWord || regex }"
        :title="t.settingsLabel || 'Search options'"
        :aria-label="t.settingsLabel || 'Search options'"
        :aria-expanded="optionsOpen ? 'true' : 'false'"
        @click="emit('update:options-open', !optionsOpen)"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          aria-hidden="true"
        >
          <path d="M4 7h16" />
          <path d="M7 12h10" />
          <path d="M10 17h4" />
        </svg>
      </button>
      <div v-if="optionsOpen" class="ai-search-options-menu" role="menu">
        <button
          type="button"
          role="menuitemcheckbox"
          class="ai-search-mode"
          :class="{ active: caseSensitive }"
          :title="t.searchCaseSensitive || 'Case sensitive (Aa)'"
          :aria-checked="caseSensitive ? 'true' : 'false'"
          @click="emit('update:case-sensitive', !caseSensitive)"
        >
          <span aria-hidden="true">Aa</span>
          <span>{{ t.searchCaseSensitive || 'Case sensitive' }}</span>
        </button>
        <button
          type="button"
          role="menuitemcheckbox"
          class="ai-search-mode"
          :class="{ active: wholeWord }"
          :title="t.searchWholeWord || 'Whole word (\\b)'"
          :aria-checked="wholeWord ? 'true' : 'false'"
          @click="emit('update:whole-word', !wholeWord)"
        >
          <span aria-hidden="true">W</span>
          <span>{{ t.searchWholeWord || 'Whole word' }}</span>
        </button>
        <button
          type="button"
          role="menuitemcheckbox"
          class="ai-search-mode"
          :class="{ active: regex }"
          :title="t.searchRegex || 'Regular expression (.*?)'"
          :aria-checked="regex ? 'true' : 'false'"
          @click="emit('update:regex', !regex)"
        >
          <span aria-hidden="true">.*</span>
          <span>{{ t.searchRegex || 'Regular expression' }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { I18nMessages } from '../utils/i18n';

defineProps<{
  inputValue: string;
  debouncedQuery: string;
  totalMatches: number;
  countLabel: string;
  optionsOpen: boolean;
  caseSensitive: boolean;
  wholeWord: boolean;
  regex: boolean;
  t: I18nMessages;
}>();

const emit = defineEmits<{
  (e: 'update:input', value: string): void;
  (e: 'update:options-open', value: boolean): void;
  (e: 'update:case-sensitive', value: boolean): void;
  (e: 'update:whole-word', value: boolean): void;
  (e: 'update:regex', value: boolean): void;
  (e: 'next'): void;
  (e: 'prev'): void;
}>();
</script>
