import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ref } from 'vue';
import {
  usePromptTemplateLibrary,
  renderPromptTemplate,
} from './usePromptTemplateLibrary';

const KEY = 'ai-test-prompt-tpls';

describe('renderPromptTemplate', () => {
  it('substitutes simple {{var}} placeholders', () => {
    const out = renderPromptTemplate('Hello {{name}}!', { name: 'Ada' });
    expect(out).toBe('Hello Ada!');
  });

  it('falls back to variable default when value is missing', () => {
    const out = renderPromptTemplate(
      'Role: {{role}}',
      {},
      [{ name: 'role', default: 'engineer' }],
    );
    expect(out).toBe('Role: engineer');
  });

  it('keeps the {{var}} literal when neither value nor default is provided', () => {
    const out = renderPromptTemplate('Hello {{missing}}.', {});
    expect(out).toBe('Hello {{missing}}.');
  });

  it('handles dotted / hyphenated names and trims whitespace inside braces', () => {
    const out = renderPromptTemplate('A {{  user.name  }} | B {{my-key}}', {
      'user.name': 'Bob',
      'my-key': 'X',
    });
    expect(out).toBe('A Bob | B X');
  });

  it('returns empty string for empty/null template', () => {
    expect(renderPromptTemplate('', { a: '1' })).toBe('');
    expect(renderPromptTemplate(undefined as unknown as string, {})).toBe('');
  });
});

describe('usePromptTemplateLibrary', () => {
  beforeEach(() => {
    localStorage.removeItem(KEY);
    vi.restoreAllMocks();
  });

  it('starts empty when localStorage has nothing', () => {
    const lib = usePromptTemplateLibrary({ storageKey: KEY });
    expect(lib.userTemplates.value).toHaveLength(0);
    expect(lib.mergedTemplates.value).toHaveLength(0);
  });

  it('merges preset templates ahead of user templates with source tagging', () => {
    const preset = ref([
      { id: 'p1', label: 'Preset One', template: 'A' },
    ]);
    const lib = usePromptTemplateLibrary({ storageKey: KEY, presetTemplates: preset });
    lib.addTemplate({ label: 'Mine', template: 'M' });
    const merged = lib.mergedTemplates.value;
    expect(merged).toHaveLength(2);
    expect(merged[0].source).toBe('preset');
    expect(merged[0].label).toBe('Preset One');
    expect(merged[1].source).toBe('user');
    expect(merged[1].label).toBe('Mine');
  });

  it('persists user templates to localStorage on add / update / delete', () => {
    const lib = usePromptTemplateLibrary({ storageKey: KEY });
    const tpl = lib.addTemplate({ label: 'T1', template: 'body' });
    let raw = localStorage.getItem(KEY);
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw!)).toHaveLength(1);

    lib.updateTemplate(tpl.id, { label: 'T1b' });
    raw = localStorage.getItem(KEY);
    expect(JSON.parse(raw!)[0].label).toBe('T1b');

    lib.deleteTemplate(tpl.id);
    raw = localStorage.getItem(KEY);
    expect(JSON.parse(raw!)).toHaveLength(0);
  });

  it('reloads user templates from localStorage on init', () => {
    const lib1 = usePromptTemplateLibrary({ storageKey: KEY });
    lib1.addTemplate({ label: 'Persisted', template: 'X' });
    const lib2 = usePromptTemplateLibrary({ storageKey: KEY });
    expect(lib2.userTemplates.value).toHaveLength(1);
    expect(lib2.userTemplates.value[0].label).toBe('Persisted');
    expect(lib2.userTemplates.value[0].source).toBe('user');
  });

  it('gives a fallback label when the user supplied empty/whitespace', () => {
    const lib = usePromptTemplateLibrary({ storageKey: KEY });
    const tpl = lib.addTemplate({ label: '  ', template: 'x' });
    expect(tpl.label).toMatch(/^模板 \d+$/);
  });

  it('silently ignores localStorage write failures', () => {
    const lib = usePromptTemplateLibrary({ storageKey: KEY });
    const setSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    expect(() => lib.addTemplate({ label: 'T', template: 'x' })).not.toThrow();
    expect(setSpy).toHaveBeenCalled();
  });
});
