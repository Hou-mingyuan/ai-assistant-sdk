<template>
  <Teleport to="body">
    <Transition name="ai-modal">
      <div
        v-if="open"
        class="ai-personalize-overlay ai-sessions-drawer-overlay"
        :class="{ 'ai-dark': isDark }"
        role="presentation"
        @click.self="$emit('close')"
      >
        <div
          class="ai-personalize-dialog ai-sessions-drawer"
          role="dialog"
          aria-modal="true"
          :aria-labelledby="titleId"
          @click.stop
        >
          <div class="ai-personalize-head">
            <h2 :id="titleId" class="ai-personalize-title">
              {{ t.sessionsDrawerTitle || 'All sessions' }}
              <span class="ai-sessions-drawer-count">({{ sessions.length }})</span>
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

          <div class="ai-sessions-drawer-search">
            <input
              v-model="filterText"
              type="search"
              :placeholder="t.sessionsDrawerSearch || 'Filter by title…'"
              class="ai-sessions-drawer-input"
            />
          </div>

          <div v-if="grouped.length === 0" class="ai-sessions-drawer-empty">
            {{ t.sessionsDrawerEmpty || 'No sessions match this filter.' }}
          </div>

          <div v-else class="ai-sessions-drawer-list">
            <div v-for="group in grouped" :key="group.label" class="ai-sessions-drawer-group">
              <div class="ai-sessions-drawer-group-title">{{ group.label }}</div>
              <button
                v-for="s in group.items"
                :key="s.id"
                type="button"
                class="ai-sessions-drawer-item"
                :class="{ 'is-active': s.id === activeId }"
                @click="onPick(s.id)"
              >
                <span class="ai-sessions-drawer-item-title">{{ s.title || (t.newSession || 'New chat') }}</span>
                <span class="ai-sessions-drawer-item-meta">
                  {{ formatTime(s.createdAt) }} · {{ s.messages.length }} {{ t.sessionsDrawerMsgUnit || 'msgs' }}
                </span>
                <button
                  v-if="sessions.length > 1"
                  type="button"
                  class="ai-sessions-drawer-item-delete"
                  :aria-label="t.closeSession || 'Delete'"
                  @click.stop="$emit('delete', s.id)"
                >
                  &times;
                </button>
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import type { I18nMessages } from '../utils/i18n';
import type { SessionEntry } from '../composables/useMultiSession';

const props = defineProps<{
  open: boolean;
  isDark: boolean;
  t: I18nMessages;
  sessions: SessionEntry[];
  activeId: string;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'pick', id: string): void;
  (e: 'delete', id: string): void;
}>();

const titleId = `ai-sessions-drawer-title-${Math.random().toString(36).slice(2, 8)}`;
const filterText = ref('');

function onPick(id: string) {
  emit('pick', id);
  emit('close');
}

interface SessionGroup {
  label: string;
  items: SessionEntry[];
}

/** 把 sessions 按时间桶分组（今天 / 昨天 / 7 天内 / 更早），按 createdAt 倒序 */
const grouped = computed<SessionGroup[]>(() => {
  const q = filterText.value.trim().toLowerCase();
  const filtered = q
    ? props.sessions.filter((s) =>
        (s.title || '').toLowerCase().includes(q)
        || s.messages.some((m) => (m.content || '').toLowerCase().includes(q)),
      )
    : props.sessions.slice();
  filtered.sort((a, b) => b.createdAt - a.createdAt);

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000;
  const startOfWeek = startOfToday - 7 * 24 * 60 * 60 * 1000;

  const buckets = new Map<string, SessionEntry[]>();
  for (const s of filtered) {
    let label: string;
    if (s.createdAt >= startOfToday) label = props.t.sessionsDrawerToday || 'Today';
    else if (s.createdAt >= startOfYesterday) label = props.t.sessionsDrawerYesterday || 'Yesterday';
    else if (s.createdAt >= startOfWeek) label = props.t.sessionsDrawerThisWeek || 'This week';
    else label = props.t.sessionsDrawerOlder || 'Older';
    const arr = buckets.get(label) ?? [];
    arr.push(s);
    buckets.set(label, arr);
  }
  return [...buckets.entries()].map(([label, items]) => ({ label, items }));
});

function formatTime(ts: number): string {
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}
</script>
