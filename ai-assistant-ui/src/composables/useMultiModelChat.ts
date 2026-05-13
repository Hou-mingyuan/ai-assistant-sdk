/**
 * useMultiModelChat
 * -----------------
 * 并发地向 N 个模型发起同一份 chat 请求，逐列汇集 SSE 流式响应，
 * 用于「多模型对比」面板。
 *
 * 设计要点：
 * - 每个模型独立持有 content / loading / error / abortController / elapsedMs，
 *   单列失败/手动停止不影响其它列。
 * - 通过 rAF 节流批量刷新，避免逐 token 触发 Vue 响应式开销。
 * - 暴露 `start(prompt)` `stopAll()` `stopOne(model)` `clearAll()` 四个动作，
 *   组件侧只关心 columns 列表即可。
 * - 不持久化：刷新页面即清空，避免 localStorage 配额压力。
 */
import { ref, computed, type Ref } from 'vue';

import { streamChat, type ChatPayload, type HistoryMessage } from '../utils/api';

export interface MultiModelColumn {
  model: string;
  content: string;
  thinking: string;
  loading: boolean;
  error: string;
  elapsedMs: number;
  startedAt: number | null;
}

export interface UseMultiModelChatOptions {
  /** AI 后端 base URL，例如 `/ai-assistant` */
  baseUrl: Ref<string>;
  /** 可选 X-AI-Token */
  token?: Ref<string | undefined>;
  /** 共享上下文（与主会话一致） */
  history?: Ref<HistoryMessage[]>;
  /** 可选 systemPrompt（用户在主面板设置过） */
  systemPrompt?: Ref<string | undefined>;
  /** 列数上限，超出后再点击 start 会被截断，默认 4 */
  maxColumns?: number;
  /** 每列拉流时的解析回调（用于复用主面板的 thinking/toolCall 提取） */
  parseChunk?: (raw: string) => { content: string; thinking?: string };
}

const RAF = typeof requestAnimationFrame === 'function'
  ? requestAnimationFrame
  : (cb: FrameRequestCallback) => setTimeout(() => cb(performance.now()), 16) as unknown as number;

export function useMultiModelChat(opts: UseMultiModelChatOptions) {
  const maxColumns = opts.maxColumns ?? 4;

  const selectedModels = ref<string[]>([]);
  const columns = ref<MultiModelColumn[]>([]);
  const isRunning = computed(() => columns.value.some((c) => c.loading));
  const lastPrompt = ref('');

  const controllers = new Map<string, AbortController>();
  const pendingFlush = new Map<string, { content: string; thinking: string; scheduled: boolean }>();

  function makeColumn(model: string): MultiModelColumn {
    return {
      model,
      content: '',
      thinking: '',
      loading: true,
      error: '',
      elapsedMs: 0,
      startedAt: Date.now(),
    };
  }

  function toggleModel(model: string) {
    const idx = selectedModels.value.indexOf(model);
    if (idx >= 0) {
      selectedModels.value = selectedModels.value.filter((m) => m !== model);
    } else {
      if (selectedModels.value.length >= maxColumns) return;
      selectedModels.value = [...selectedModels.value, model];
    }
  }

  function setSelectedModels(list: string[]) {
    selectedModels.value = list.slice(0, maxColumns);
  }

  function scheduleFlush(model: string) {
    const pending = pendingFlush.get(model);
    if (!pending || pending.scheduled) return;
    pending.scheduled = true;
    RAF(() => {
      const col = columns.value.find((c) => c.model === model);
      const slot = pendingFlush.get(model);
      if (col && slot) {
        col.content = slot.content;
        col.thinking = slot.thinking;
        if (col.startedAt) col.elapsedMs = Date.now() - col.startedAt;
      }
      if (slot) slot.scheduled = false;
    });
  }

  async function runOne(model: string, prompt: string) {
    const col = columns.value.find((c) => c.model === model);
    if (!col) return;
    const ctrl = new AbortController();
    controllers.set(model, ctrl);
    pendingFlush.set(model, { content: '', thinking: '', scheduled: false });

    const payload: ChatPayload = {
      action: 'chat',
      text: prompt,
      model,
      history: opts.history?.value ?? [],
      systemPrompt: opts.systemPrompt?.value,
    };

    let buffer = '';
    try {
      for await (const chunk of streamChat(opts.baseUrl.value, payload, opts.token?.value, ctrl.signal)) {
        buffer += chunk;
        const parsed = opts.parseChunk ? opts.parseChunk(buffer) : { content: buffer, thinking: '' };
        const slot = pendingFlush.get(model);
        if (slot) {
          slot.content = parsed.content;
          slot.thinking = parsed.thinking ?? '';
          scheduleFlush(model);
        }
      }
      const slot = pendingFlush.get(model);
      if (slot) {
        const col2 = columns.value.find((c) => c.model === model);
        if (col2) {
          col2.content = slot.content;
          col2.thinking = slot.thinking;
        }
      }
    } catch (err) {
      if (ctrl.signal.aborted) {
        col.error = '';
      } else {
        col.error = err instanceof Error ? err.message : String(err);
      }
    } finally {
      col.loading = false;
      if (col.startedAt) col.elapsedMs = Date.now() - col.startedAt;
      controllers.delete(model);
    }
  }

  async function start(prompt: string) {
    const trimmed = prompt.trim();
    if (!trimmed) return;
    if (selectedModels.value.length === 0) return;
    lastPrompt.value = trimmed;
    stopAll();
    columns.value = selectedModels.value.map(makeColumn);
    await Promise.all(selectedModels.value.map((m) => runOne(m, trimmed)));
  }

  function stopOne(model: string) {
    const ctrl = controllers.get(model);
    if (ctrl) ctrl.abort();
    const col = columns.value.find((c) => c.model === model);
    if (col) {
      col.loading = false;
      if (col.startedAt) col.elapsedMs = Date.now() - col.startedAt;
    }
  }

  function stopAll() {
    for (const ctrl of controllers.values()) ctrl.abort();
    controllers.clear();
    for (const col of columns.value) {
      if (col.loading) {
        col.loading = false;
        if (col.startedAt) col.elapsedMs = Date.now() - col.startedAt;
      }
    }
  }

  function clearAll() {
    stopAll();
    columns.value = [];
    lastPrompt.value = '';
    pendingFlush.clear();
  }

  return {
    selectedModels,
    columns,
    isRunning,
    lastPrompt,
    toggleModel,
    setSelectedModels,
    start,
    stopOne,
    stopAll,
    clearAll,
  };
}
