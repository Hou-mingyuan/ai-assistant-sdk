// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { computed, ref } from 'vue';
import { useFormAutoFill, type FormAutoFillOptions } from './useFormAutoFill';

function makeDeps(opts: FormAutoFillOptions = {}) {
  const optionsRef = ref<FormAutoFillOptions>(opts);
  return {
    deps: { options: computed(() => optionsRef.value) },
    setOptions(next: FormAutoFillOptions) {
      optionsRef.value = next;
    },
  };
}

function mountForm(html: string) {
  document.body.innerHTML = '';
  const root = document.createElement('div');
  root.innerHTML = html;
  document.body.appendChild(root);
  return root;
}

describe('useFormAutoFill - inspectPasteText (auto detect)', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('opens dialog when paste contains ≥ autoDetectMinPairs', () => {
    mountForm(`
      <input name="name" />
      <input name="age" />
      <input name="email" />
    `);
    const { deps } = makeDeps();
    const f = useFormAutoFill(deps);
    const opened = f.inspectPasteText('name: Alice\nage: 30\nemail: a@x.com');
    expect(opened).toBe(true);
    expect(f.dialogOpen.value).toBe(true);
    expect(f.matches.value).toHaveLength(3);
  });

  it('skips when fewer than minPairs', () => {
    const { deps } = makeDeps({ autoDetectMinPairs: 3 });
    const f = useFormAutoFill(deps);
    expect(f.inspectPasteText('name: Alice\nage: 30')).toBe(false);
    expect(f.dialogOpen.value).toBe(false);
  });

  it('is disabled when autoDetectPaste=false', () => {
    const { deps } = makeDeps({ autoDetectPaste: false });
    const f = useFormAutoFill(deps);
    expect(f.inspectPasteText('a: 1\nb: 2\nc: 3')).toBe(false);
  });

  it('returns false on empty/non-pair input', () => {
    const { deps } = makeDeps();
    const f = useFormAutoFill(deps);
    expect(f.inspectPasteText('')).toBe(false);
    expect(f.inspectPasteText('just some prose')).toBe(false);
  });
});

describe('useFormAutoFill - triggerFromText (slash command)', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('opens dialog even when only 1 pair (no minPairs gate)', async () => {
    mountForm(`<input name="name" />`);
    const { deps } = makeDeps({ autoDetectMinPairs: 5 });
    const f = useFormAutoFill(deps);
    const ok = await f.triggerFromText('name: Alice');
    expect(ok).toBe(true);
    expect(f.dialogOpen.value).toBe(true);
  });

  it('returns false when input has no pairs', async () => {
    const { deps } = makeDeps();
    const f = useFormAutoFill(deps);
    const ok = await f.triggerFromText('this is not key-value');
    expect(ok).toBe(false);
    expect(f.dialogOpen.value).toBe(false);
  });
});

describe('useFormAutoFill - default selection (decision 4-C)', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('pre-selects empty fields above defaultPickConfidence', () => {
    mountForm(`
      <input name="name" />
      <input name="age" value="20" />
    `);
    const { deps } = makeDeps();
    const f = useFormAutoFill(deps);
    f.inspectPasteText('name: Alice\nage: 30');
    expect(f.selectedIndices.value.has(0)).toBe(true);
    expect(f.selectedIndices.value.has(1)).toBe(false);
  });

  it('does not pre-select when confidence below defaultPickConfidence', () => {
    mountForm(`<input name="totallyDifferentName" />`);
    const { deps } = makeDeps({ defaultPickConfidence: 90 });
    const f = useFormAutoFill(deps);
    f.inspectPasteText('totalldfferentName: foo\nb: 2');
    expect(f.selectedIndices.value.size).toBeLessThanOrEqual(1);
  });
});

describe('useFormAutoFill - confirmFill + undo', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('fills selected fields and records FillRecord for undo', () => {
    mountForm(`
      <input name="name" />
      <input name="age" />
    `);
    const { deps } = makeDeps();
    const f = useFormAutoFill(deps);
    f.inspectPasteText('name: Alice\nage: 30');
    expect(f.selectedIndices.value.size).toBe(2);
    const r = f.confirmFill();
    expect(r.filled).toBe(2);
    expect(r.failed).toBe(0);
    expect(document.querySelector<HTMLInputElement>('input[name=name]')!.value).toBe('Alice');
    expect(document.querySelector<HTMLInputElement>('input[name=age]')!.value).toBe('30');
    expect(f.lastFillRecords.value).toHaveLength(2);
    expect(f.toastVisible.value).toBe(true);
  });

  it('undoLastFill restores original values', () => {
    mountForm(`
      <input name="name" value="Original" />
    `);
    const { deps } = makeDeps();
    const f = useFormAutoFill(deps);
    f.inspectPasteText('name: NewName\nx: y');
    // 默认不勾选已有值的字段；手动勾上
    f.toggleSelection(0);
    expect(f.selectedIndices.value.has(0)).toBe(true);
    f.confirmFill();
    const input = document.querySelector<HTMLInputElement>('input[name=name]')!;
    expect(input.value).toBe('NewName');
    f.undoLastFill();
    expect(input.value).toBe('Original');
    expect(f.lastFillRecords.value).toHaveLength(0);
    expect(f.toastVisible.value).toBe(false);
  });

  it('confirmFill is a no-op when no selection', () => {
    mountForm(`<input name="name" />`);
    const { deps } = makeDeps();
    const f = useFormAutoFill(deps);
    f.inspectPasteText('name: Alice\nx: y');
    f.setAllSelections(false);
    const r = f.confirmFill();
    expect(r.filled).toBe(0);
    expect(document.querySelector<HTMLInputElement>('input[name=name]')!.value).toBe('');
  });

  it('closeDialog clears matches and selection', () => {
    mountForm(`<input name="x" /><input name="y" />`);
    const { deps } = makeDeps();
    const f = useFormAutoFill(deps);
    f.inspectPasteText('x: 1\ny: 2');
    expect(f.dialogOpen.value).toBe(true);
    f.closeDialog();
    expect(f.dialogOpen.value).toBe(false);
    expect(f.matches.value).toHaveLength(0);
    expect(f.selectedIndices.value.size).toBe(0);
  });
});

describe('useFormAutoFill - overrideMatch', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('manually re-assigns pair to a different field', () => {
    mountForm(`
      <input name="first_name" />
      <input name="city" />
    `);
    const { deps } = makeDeps();
    const f = useFormAutoFill(deps);
    f.inspectPasteText('totallyUnknown: Alice\nx: y');
    expect(f.matches.value[0]!.field).toBeNull();
    const cityField = f.availableFields.value.find(
      (fl) => (fl.el as HTMLInputElement).name === 'city',
    );
    f.overrideMatch(0, cityField!.id);
    expect(f.matches.value[0]!.field?.id).toBe(cityField!.id);
  });

  it('clears assignment when fieldId is null', () => {
    mountForm(`<input name="name" /><input name="age" />`);
    const { deps } = makeDeps();
    const f = useFormAutoFill(deps);
    f.inspectPasteText('name: Alice\nage: 30');
    expect(f.matches.value[0]!.field).not.toBeNull();
    f.overrideMatch(0, null);
    expect(f.matches.value[0]!.field).toBeNull();
  });
});

describe('useFormAutoFill - synonyms', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('uses host-provided synonyms', () => {
    mountForm(`<input name="cust" />`);
    const { deps } = makeDeps({
      synonyms: { customerAlias: ['cust', '客户'] },
    });
    const f = useFormAutoFill(deps);
    f.inspectPasteText('客户: Alice\nfoo: bar');
    expect(f.matches.value[0]!.field).not.toBeNull();
  });

  it('respects disableBuiltinSynonyms', () => {
    mountForm(`<input name="phone" />`);
    const { deps } = makeDeps({ disableBuiltinSynonyms: true });
    const f = useFormAutoFill(deps);
    f.inspectPasteText('电话: 138\nfoo: bar');
    expect(f.matches.value[0]!.strategy).not.toBe('synonym');
  });
});

describe('useFormAutoFill - LLM fallback hint', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('sets llmFallbackHinted when allowLlmFallback and any unmatched', () => {
    mountForm(`<input name="name" />`);
    const { deps } = makeDeps({ allowLlmFallback: true });
    const f = useFormAutoFill(deps);
    f.inspectPasteText('zzz: 1\nyyy: 2');
    expect(f.llmFallbackHinted.value).toBe(true);
  });

  it('does not set hint when allowLlmFallback=false', () => {
    mountForm(`<input name="name" />`);
    const { deps } = makeDeps({ allowLlmFallback: false });
    const f = useFormAutoFill(deps);
    f.inspectPasteText('zzz: 1\nyyy: 2');
    expect(f.llmFallbackHinted.value).toBe(false);
  });
});

describe('useFormAutoFill - table mode (Phase 2)', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  function mountTableForm() {
    document.body.innerHTML = '';
    const root = document.createElement('div');
    root.innerHTML = `
      <div data-ai-fillable-row="r0">
        <input name="name" />
        <input name="phone" />
        <input name="email" />
      </div>
      <div data-ai-fillable-row="r1">
        <input name="name" />
        <input name="phone" />
        <input name="email" />
      </div>
    `;
    document.body.appendChild(root);
  }

  it('enters table mode for a TSV paste with [data-ai-fillable-row]', () => {
    mountTableForm();
    const { deps } = makeDeps({ tableMode: true });
    const f = useFormAutoFill(deps);
    const opened = f.inspectPasteText('姓名\t电话\t邮箱\n张三\t138\ta@x.com\n李四\t139\tb@x.com');
    expect(opened).toBe(true);
    expect(f.mode.value).toBe('table');
    expect(f.tableInfo.value).toEqual({
      headers: ['姓名', '电话', '邮箱'],
      dataRowCount: 2,
      formRowCount: 2,
      truncatedRows: 0,
    });
    // 2 rows × 3 cols = 6 synthetic pairs
    expect(f.matches.value).toHaveLength(6);
  });

  it('falls back to pair mode when no row containers present', () => {
    document.body.innerHTML = '';
    const root = document.createElement('div');
    root.innerHTML = `<input name="name" /><input name="age" />`;
    document.body.appendChild(root);
    const { deps } = makeDeps({ tableMode: true });
    const f = useFormAutoFill(deps);
    const opened = f.inspectPasteText('name: A\nage: 1');
    expect(opened).toBe(true);
    expect(f.mode.value).toBe('pair');
    expect(f.tableInfo.value).toBeNull();
  });

  it('truncates extra data rows and reports truncatedRows', () => {
    mountTableForm();
    const { deps } = makeDeps({ tableMode: true });
    const f = useFormAutoFill(deps);
    f.inspectPasteText('姓名\t电话\n张三\t1\n李四\t2\n王五\t3\n赵六\t4');
    expect(f.mode.value).toBe('table');
    expect(f.tableInfo.value?.dataRowCount).toBe(4);
    expect(f.tableInfo.value?.formRowCount).toBe(2);
    expect(f.tableInfo.value?.truncatedRows).toBe(2);
    expect(f.matches.value).toHaveLength(4); // only fits 2 rows × 2 cols
  });

  it('calls onAddRow to grow the form until rows are enough', async () => {
    document.body.innerHTML = '';
    const root = document.createElement('div');
    root.innerHTML = `
      <div data-ai-fillable-row="r0">
        <input name="name" />
        <input name="phone" />
      </div>
    `;
    document.body.appendChild(root);
    let addCount = 0;
    const onAddRow = () => {
      addCount++;
      const r = document.createElement('div');
      r.setAttribute('data-ai-fillable-row', `r${addCount}`);
      r.innerHTML = `<input name="name" /><input name="phone" />`;
      root.appendChild(r);
    };
    const { deps } = makeDeps({ tableMode: { onAddRow } });
    const f = useFormAutoFill(deps);
    await f.triggerFromText('姓名\t电话\n张三\t1\n李四\t2\n王五\t3');
    expect(addCount).toBe(2);
    expect(f.tableInfo.value?.formRowCount).toBe(3);
    expect(f.tableInfo.value?.truncatedRows).toBe(0);
    expect(f.matches.value).toHaveLength(6); // 3 rows × 2 cols
  });

  it('fills all rows correctly when user confirms', () => {
    mountTableForm();
    const { deps } = makeDeps({ tableMode: true });
    const f = useFormAutoFill(deps);
    f.inspectPasteText('姓名\t电话\t邮箱\n张三\t138\ta@x.com\n李四\t139\tb@x.com');
    f.confirmFill();
    const inputs = Array.from(
      document.querySelectorAll<HTMLInputElement>('[data-ai-fillable-row] input'),
    );
    const values = inputs.map((i) => i.value);
    expect(values).toEqual(['张三', '138', 'a@x.com', '李四', '139', 'b@x.com']);
  });

  it('tableMode disabled by default — TSV paste goes to pair mode', () => {
    mountTableForm();
    const { deps } = makeDeps({}); // no tableMode option
    const f = useFormAutoFill(deps);
    f.inspectPasteText('姓名\t电话\n张三\t1\n李四\t2');
    expect(f.mode.value).toBe('pair');
    expect(f.tableInfo.value).toBeNull();
  });
});

describe('useFormAutoFill - clipboard fallback', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('reads navigator.clipboard when text is empty', async () => {
    mountForm(`<input name="name" />`);
    const readText = vi.fn().mockResolvedValue('name: FromClipboard');
    const original = (globalThis.navigator as Navigator).clipboard;
    Object.defineProperty(globalThis.navigator, 'clipboard', {
      value: { readText },
      configurable: true,
    });
    try {
      const { deps } = makeDeps();
      const f = useFormAutoFill(deps);
      const ok = await f.triggerFromText('');
      expect(ok).toBe(true);
      expect(readText).toHaveBeenCalled();
    } finally {
      Object.defineProperty(globalThis.navigator, 'clipboard', {
        value: original,
        configurable: true,
      });
    }
  });

  it('returns false when clipboard fails AND text is empty', async () => {
    const original = (globalThis.navigator as Navigator).clipboard;
    Object.defineProperty(globalThis.navigator, 'clipboard', {
      value: {
        readText: vi.fn().mockRejectedValue(new Error('not allowed')),
      },
      configurable: true,
    });
    try {
      const { deps } = makeDeps();
      const f = useFormAutoFill(deps);
      const ok = await f.triggerFromText('');
      expect(ok).toBe(false);
    } finally {
      Object.defineProperty(globalThis.navigator, 'clipboard', {
        value: original,
        configurable: true,
      });
    }
  });
});
