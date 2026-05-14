import { ref, type Ref, type ComputedRef } from 'vue';
import { postServerExport, type ExportFormat } from '../utils/api';
import type { SessionEntry } from './useMultiSession';
import type { I18nMessages } from '../utils/i18n';
import { useExportProgress } from './useExportProgress';

interface ExportDeps {
  sessions: Ref<SessionEntry[]>;
  messages: Ref<{ role: string; content: string; contentArchive?: string }[]>;
  wrapperRef: Ref<HTMLElement | undefined>;
  getBaseUrl: () => string | undefined;
  getAccessToken: () => string | undefined;
  isDark?: ComputedRef<boolean>;
  t: ComputedRef<I18nMessages>;
  exportServerBusy: Ref<boolean>;
  setExportToast: (text: string, ms: number) => void;
  reportError: (source: string, msg: string) => void;
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function useExportActions(deps: ExportDeps) {
  const batchExportMenuOpen = ref(false);
  /* K53.2: Loading + toast state machine lives in useExportProgress so the
   * busy/preparing/receiving/download-started lifecycle is owned in exactly
   * one place. useExportActions itself is now only concerned with payload
   * construction (title, content, message list, theme). */
  const progress = useExportProgress({
    exportServerBusy: deps.exportServerBusy,
    setExportToast: deps.setExportToast,
    reportError: deps.reportError,
    t: deps.t,
  });

  function toggleBatchExportMenu() {
    batchExportMenuOpen.value = !batchExportMenuOpen.value;
  }

  function resolveExportImageUrl(raw: string | null | undefined): string | null {
    if (!raw?.trim()) return null;
    const u = raw.trim();
    if (u.startsWith('data:') || u.startsWith('blob:')) return u;
    try {
      return new URL(u, document.baseURI).href;
    } catch {
      return u;
    }
  }

  function buildExportContentFromAssistantBubble(globalIndex: number, fallback: string): string {
    const m = deps.messages.value[globalIndex];
    const source = (m?.contentArchive ?? fallback ?? '').replace(/\r\n/g, '\n');
    let out = source.trim();
    const root = deps.wrapperRef.value?.querySelector(`[data-ai-msg-global-idx="${globalIndex}"]`);
    const bubble = root?.querySelector('.ai-bubble') as HTMLElement | undefined;
    if (!bubble) return out;
    const urls: string[] = [];
    bubble.querySelectorAll('img').forEach((img) => {
      const raw = (img as HTMLImageElement).currentSrc || img.getAttribute('src');
      const resolved = resolveExportImageUrl(raw);
      if (resolved) urls.push(resolved);
    });
    if (urls.length) {
      out += '\n\n' + urls.map((u) => `![](${u})`).join('\n');
    }
    return out;
  }

  async function exportAssistantMessageServer(globalIndex: number, fmt: ExportFormat) {
    const baseUrl = deps.getBaseUrl();
    if (!baseUrl || progress.isBusy()) return;
    const m = deps.messages.value[globalIndex];
    if (!m || m.role !== 'assistant') return;
    const title = `${deps.t.value.title}-${globalIndex + 1}`;
    const content = buildExportContentFromAssistantBubble(
      globalIndex,
      m.contentArchive ?? m.content,
    );
    await progress.runExport({
      errorSource: 'export-server',
      run: (onPhase) =>
        postServerExport(
          baseUrl,
          fmt,
          title,
          [{ role: 'assistant', content }],
          deps.getAccessToken(),
          onPhase,
          deps.isDark?.value ? 'dark' : 'light',
        ),
    });
  }

  function collectAllSessionMessages(): { role: string; content: string }[] {
    const allMsgs: { role: string; content: string }[] = [];
    for (const s of deps.sessions.value) {
      if (s.messages.length > 0) {
        allMsgs.push({ role: 'assistant', content: `--- ${s.title || 'Untitled'} ---` });
        for (const m of s.messages) {
          allMsgs.push({ role: m.role, content: m.contentArchive ?? m.content });
        }
      }
    }
    return allMsgs;
  }

  function batchExportAllJson() {
    batchExportMenuOpen.value = false;
    const data = deps.sessions.value
      .filter((s) => s.messages.length > 0)
      .map((s) => ({
        title: s.title || 'Untitled',
        createdAt: s.createdAt,
        messages: s.messages.map((m) => ({ role: m.role, content: m.contentArchive ?? m.content })),
      }));
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    triggerDownload(blob, `ai-sessions-${new Date().toISOString().slice(0, 10)}.json`);
  }

  function batchExportAllMarkdown() {
    batchExportMenuOpen.value = false;
    const lines: string[] = [];
    for (const s of deps.sessions.value) {
      if (s.messages.length === 0) continue;
      lines.push(`# ${s.title || 'Untitled'}`, '');
      for (const m of s.messages) {
        const label = m.role === 'user' ? '**User**' : '**Assistant**';
        lines.push(`${label}:`, '', m.contentArchive ?? m.content, '', '---', '');
      }
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/markdown; charset=utf-8' });
    triggerDownload(blob, `ai-sessions-${new Date().toISOString().slice(0, 10)}.md`);
  }

  async function batchExportAllServer(fmt: ExportFormat) {
    batchExportMenuOpen.value = false;
    const baseUrl = deps.getBaseUrl();
    if (!baseUrl || progress.isBusy()) return;
    const allMsgs = collectAllSessionMessages();
    const title = `${deps.t.value.title}-all-sessions`;
    await progress.runExport({
      errorSource: 'batch-export-server',
      run: (onPhase) =>
        postServerExport(
          baseUrl,
          fmt,
          title,
          allMsgs,
          deps.getAccessToken(),
          onPhase,
          deps.isDark?.value ? 'dark' : 'light',
        ),
    });
  }

  return {
    batchExportMenuOpen,
    toggleBatchExportMenu,
    batchExportAllJson,
    batchExportAllMarkdown,
    batchExportAllServer,
    exportAssistantMessageServer,
    buildExportContentFromAssistantBubble,
    resolveExportImageUrl,
  };
}
