/**
 * usePromptTemplateLibrary
 * ------------------------
 * 用户侧 Prompt 模板库（角色卡）：本地持久化、可视化管理。
 *
 * 与 `AiAssistantOptions.promptTemplates` 的关系：
 * - options 中的 `promptTemplates` 由宿主应用预置，**只读**，永远显示在前；
 * - 本 composable 管理的是「用户自己加的」模板，存 localStorage，可增删改；
 * - 列表 `mergedTemplates` 把两者拼起来供 UI 使用，并用 source 字段区分。
 *
 * 模板渲染：`{{var}}` 占位符按变量映射替换，未提供值则用变量的 default，
 * 仍空就保留 `{{var}}` 字面（提示用户填写）。
 */
import { computed, ref, type Ref } from 'vue';

export interface PromptTemplateVariable {
  name: string;
  label?: string;
  default?: string;
  placeholder?: string;
}

export interface PromptTemplate {
  id: string;
  label: string;
  template: string;
  variables?: PromptTemplateVariable[];
  createdAt?: number;
  /** 'user' = 本地保存的；'preset' = 宿主 options 注入的，只读 */
  source?: 'user' | 'preset';
}

const STORAGE_KEY = 'ai-assistant-prompt-templates';
const MAX_TEMPLATES = 50;

function genId(): string {
  return 't_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

export function renderPromptTemplate(
  template: string,
  vars: Record<string, string> = {},
  defs: PromptTemplateVariable[] = [],
): string {
  if (!template) return '';
  const defaults: Record<string, string> = {};
  for (const d of defs) {
    if (d.default != null) defaults[d.name] = d.default;
  }
  return template.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (_, key: string) => {
    const v = vars[key];
    if (v != null && v !== '') return v;
    if (defaults[key] != null && defaults[key] !== '') return defaults[key];
    return `{{${key}}}`;
  });
}

export interface UsePromptTemplateLibraryOptions {
  storageKey?: string;
  presetTemplates?: Ref<PromptTemplate[] | undefined>;
}

export function usePromptTemplateLibrary(opts: UsePromptTemplateLibraryOptions = {}) {
  const storageKey = opts.storageKey ?? STORAGE_KEY;
  const userTemplates = ref<PromptTemplate[]>([]);

  function load() {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        userTemplates.value = parsed
          .slice(0, MAX_TEMPLATES)
          .map((t: PromptTemplate) => ({ ...t, source: 'user' as const }));
      }
    } catch {
      /* ignore */
    }
  }

  function save() {
    try {
      const payload = userTemplates.value.slice(0, MAX_TEMPLATES).map((t) => ({
        id: t.id,
        label: t.label,
        template: t.template,
        variables: t.variables,
        createdAt: t.createdAt,
      }));
      localStorage.setItem(storageKey, JSON.stringify(payload));
    } catch {
      /* ignore */
    }
  }

  function addTemplate(input: Omit<PromptTemplate, 'id' | 'source' | 'createdAt'>): PromptTemplate {
    const tpl: PromptTemplate = {
      id: genId(),
      label: input.label.trim() || `模板 ${userTemplates.value.length + 1}`,
      template: input.template,
      variables: input.variables,
      createdAt: Date.now(),
      source: 'user',
    };
    userTemplates.value = [tpl, ...userTemplates.value].slice(0, MAX_TEMPLATES);
    save();
    return tpl;
  }

  function updateTemplate(id: string, patch: Partial<Omit<PromptTemplate, 'id' | 'source'>>) {
    userTemplates.value = userTemplates.value.map((t) =>
      t.id === id ? { ...t, ...patch, source: 'user' } : t,
    );
    save();
  }

  function deleteTemplate(id: string) {
    userTemplates.value = userTemplates.value.filter((t) => t.id !== id);
    save();
  }

  const mergedTemplates = computed<PromptTemplate[]>(() => {
    const preset = (opts.presetTemplates?.value ?? []).map((t, idx) => ({
      ...t,
      id: t.id ?? `preset_${idx}`,
      source: 'preset' as const,
    }));
    return [...preset, ...userTemplates.value];
  });

  load();

  return {
    userTemplates,
    mergedTemplates,
    addTemplate,
    updateTemplate,
    deleteTemplate,
    renderPromptTemplate,
  };
}
