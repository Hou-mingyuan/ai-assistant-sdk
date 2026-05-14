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
              :aria-label="t.sessionsDrawerSearch || 'Filter sessions'"
              class="ai-sessions-drawer-input"
            />
            <span
              v-if="crossSearch.effectiveQuery.value && crossSearch.totalMatches.value > 0"
              class="ai-sessions-drawer-search-count"
              role="status"
              aria-live="polite"
            >
              {{
                (t.sessionsDrawerMatchesCount || '{count} matches').replace(
                  '{count}',
                  String(crossSearch.totalMatches.value),
                )
              }}
            </span>
          </div>

          <div v-if="grouped.length === 0" class="ai-sessions-drawer-empty">
            {{ t.sessionsDrawerEmpty || 'No sessions match this filter.' }}
          </div>

          <div v-else class="ai-sessions-drawer-list">
            <div v-for="group in grouped" :key="group.label" class="ai-sessions-drawer-group">
              <div class="ai-sessions-drawer-group-title">{{ group.label }}</div>
              <div
                v-for="s in group.items"
                :key="s.id"
                class="ai-sessions-drawer-item"
                :class="{ 'is-active': s.id === activeId, 'is-editing': editingId === s.id }"
              >
                <button
                  v-if="editingId !== s.id"
                  type="button"
                  class="ai-sessions-drawer-item-main"
                  @click="onPick(s.id)"
                >
                  <span class="ai-sessions-drawer-item-title">
                    <span v-if="s.pinned" class="ai-sessions-drawer-item-pin" aria-label="pinned"
                      >★</span
                    >
                    {{ s.title || t.newSession || 'New chat' }}
                  </span>
                  <span class="ai-sessions-drawer-item-meta">
                    {{ formatTime(s.createdAt) }} · {{ s.messages.length }}
                    {{ t.sessionsDrawerMsgUnit || 'msgs' }}
                  </span>
                </button>
                <form
                  v-else
                  class="ai-sessions-drawer-item-edit"
                  @submit.prevent="commitRename(s.id)"
                >
                  <input
                    ref="renameInputRef"
                    v-model="editingTitle"
                    type="text"
                    maxlength="80"
                    class="ai-sessions-drawer-rename-input"
                    :aria-label="t.sessionsDrawerRename || 'Rename session'"
                    @keydown.escape.prevent="cancelRename"
                    @blur="commitRename(s.id)"
                  />
                </form>
                <div class="ai-sessions-drawer-item-actions">
                  <button
                    type="button"
                    class="ai-sessions-drawer-item-act"
                    :class="{ active: s.pinned }"
                    :title="t.sessionsDrawerPin || 'Pin'"
                    :aria-label="t.sessionsDrawerPin || 'Pin'"
                    :aria-pressed="s.pinned ? 'true' : 'false'"
                    @click.stop="$emit('toggle-pin', s.id)"
                  >
                    ★
                  </button>
                  <button
                    type="button"
                    class="ai-sessions-drawer-item-act"
                    :title="t.sessionsDrawerRename || 'Rename'"
                    :aria-label="t.sessionsDrawerRename || 'Rename'"
                    @click.stop="startRename(s)"
                  >
                    ✎
                  </button>
                  <button
                    v-if="sessions.length > 1"
                    type="button"
                    class="ai-sessions-drawer-item-act ai-sessions-drawer-item-delete"
                    :aria-label="t.closeSession || 'Delete'"
                    @click.stop="$emit('delete', s.id)"
                  >
                    &times;
                  </button>
                </div>
                <!-- K39: matched-message snippets shown under each session
                     when filterText is active and message bodies contain it.
                     Up to maxPerSession entries (3 by default) with HTML-safe
                     highlight; click jumps the host into that session + scrolls
                     to the message via the pick-message emit. -->
                <ul
                  v-if="
                    crossSearch.effectiveQuery.value &&
                    crossSearch.matchesBySession.value.get(s.id)?.length
                  "
                  class="ai-sessions-drawer-match-list"
                >
                  <li
                    v-for="match in crossSearch.matchesBySession.value.get(s.id) ?? []"
                    :key="match.sessionId + ':' + match.msgIndex"
                    class="ai-sessions-drawer-match"
                  >
                    <button
                      type="button"
                      class="ai-sessions-drawer-match-btn"
                      :title="match.rawText"
                      @click.stop="onPickMessage(match.sessionId, match.msgIndex)"
                    >
                      <span class="ai-sessions-drawer-match-role">
                        {{ match.role === 'user' ? '👤' : '🤖' }}
                      </span>
                      <span class="ai-sessions-drawer-match-snippet" v-html="match.snippet" />
                    </button>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, toRef } from 'vue';
import type { I18nMessages } from '../utils/i18n';
import type { SessionEntry } from '../composables/useMultiSession';
import { useCrossSessionSearch } from '../composables/useCrossSessionSearch';

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
  /** K39: jump to a specific message inside a (possibly different) session. */
  (e: 'pick-message', sessionId: string, msgIndex: number): void;
  (e: 'delete', id: string): void;
  (e: 'toggle-pin', id: string): void;
  (e: 'rename', id: string, title: string): void;
}>();

const titleId = `ai-sessions-drawer-title-${Math.random().toString(36).slice(2, 8)}`;
const filterText = ref('');

/**
 * K39: feeds the live filterText into the cross-session search composable.
 * Returned `matchesBySession` is consumed inline above to render the snippet
 * list under each session item; `totalMatches` shows the badge next to the
 * search input.
 */
const crossSearch = useCrossSessionSearch({
  sessions: toRef(props, 'sessions'),
  query: filterText,
});

function onPickMessage(sessionId: string, msgIndex: number) {
  emit('pick-message', sessionId, msgIndex);
  emit('close');
}
const editingId = ref<string | null>(null);
const editingTitle = ref('');
const renameInputRef = ref<HTMLInputElement | HTMLInputElement[] | null>(null);

function onPick(id: string) {
  emit('pick', id);
  emit('close');
}

function startRename(s: SessionEntry) {
  editingId.value = s.id;
  editingTitle.value = s.title || '';
  void nextTick(() => {
    const ref = renameInputRef.value;
    const el = Array.isArray(ref) ? ref[0] : ref;
    if (el) {
      el.focus();
      el.select();
    }
  });
}

function cancelRename() {
  editingId.value = null;
  editingTitle.value = '';
}

function commitRename(id: string) {
  if (editingId.value !== id) return;
  const newTitle = editingTitle.value.trim();
  if (newTitle) emit('rename', id, newTitle);
  editingId.value = null;
  editingTitle.value = '';
}

interface SessionGroup {
  label: string;
  items: SessionEntry[];
}

/** 把 sessions 按时间桶分组；pinned 会话统一在最顶部 "Pinned" 分组，按 createdAt 倒序 */
const grouped = computed<SessionGroup[]>(() => {
  const q = filterText.value.trim().toLowerCase();
  const filtered = q
    ? props.sessions.filter(
        (s) =>
          (s.title || '').toLowerCase().includes(q) ||
          s.messages.some((m) => (m.content || '').toLowerCase().includes(q)),
      )
    : props.sessions.slice();
  filtered.sort((a, b) => b.createdAt - a.createdAt);

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000;
  const startOfWeek = startOfToday - 7 * 24 * 60 * 60 * 1000;

  const pinnedLabel = props.t.sessionsDrawerPinned || 'Pinned';
  const todayLabel = props.t.sessionsDrawerToday || 'Today';
  const yesterdayLabel = props.t.sessionsDrawerYesterday || 'Yesterday';
  const weekLabel = props.t.sessionsDrawerThisWeek || 'This week';
  const olderLabel = props.t.sessionsDrawerOlder || 'Older';

  const buckets = new Map<string, SessionEntry[]>();
  for (const s of filtered) {
    let label: string;
    if (s.pinned) label = pinnedLabel;
    else if (s.createdAt >= startOfToday) label = todayLabel;
    else if (s.createdAt >= startOfYesterday) label = yesterdayLabel;
    else if (s.createdAt >= startOfWeek) label = weekLabel;
    else label = olderLabel;
    const arr = buckets.get(label) ?? [];
    arr.push(s);
    buckets.set(label, arr);
  }
  /* Display order: Pinned 永远在最顶，其他按时间桶 */
  const order = [pinnedLabel, todayLabel, yesterdayLabel, weekLabel, olderLabel];
  return order
    .filter((label) => buckets.has(label))
    .map((label) => ({ label, items: buckets.get(label)! }));
});

function formatTime(ts: number): string {
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}
</script>
