// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  fillField,
  undoFills,
  highlightFilledField,
  clearFillHighlights,
} from './filler';
import type { FormField } from './scanner';

function makeField(partial: Partial<FormField> & { el: HTMLElement }): FormField {
  return {
    el: partial.el,
    els: partial.els ?? [partial.el],
    type: partial.type ?? 'text',
    labels: partial.labels ?? ['x'],
    currentValue: partial.currentValue ?? '',
    options: partial.options ?? [],
    id: partial.id ?? 'id',
    visible: partial.visible ?? true,
  };
}

describe('fillField - text input', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('writes value via native setter and dispatches events', () => {
    const input = document.createElement('input');
    input.type = 'text';
    document.body.appendChild(input);
    const inputEvt = vi.fn();
    const changeEvt = vi.fn();
    input.addEventListener('input', inputEvt);
    input.addEventListener('change', changeEvt);

    const field = makeField({ el: input });
    const r = fillField(field, 'hello');

    expect(input.value).toBe('hello');
    expect(r.success).toBe(true);
    expect(r.oldValue).toBe('');
    expect(r.newValue).toBe('hello');
    expect(inputEvt).toHaveBeenCalled();
    expect(changeEvt).toHaveBeenCalled();
    expect(field.currentValue).toBe('hello');
  });

  it('snapshots old value before write', () => {
    const input = document.createElement('input');
    input.value = 'old';
    document.body.appendChild(input);
    const field = makeField({ el: input, currentValue: 'old' });
    const r = fillField(field, 'new');
    expect(r.oldValue).toBe('old');
    expect(input.value).toBe('new');
  });

  it('strips non-numeric chars for type=number', () => {
    const input = document.createElement('input');
    input.type = 'number';
    document.body.appendChild(input);
    const field = makeField({ el: input, type: 'number' });
    const r = fillField(field, '$1,234.56');
    expect(input.value).toBe('1234.56');
    expect(r.success).toBe(true);
  });

  it('writes textarea via native setter', () => {
    const ta = document.createElement('textarea');
    document.body.appendChild(ta);
    const field = makeField({ el: ta, type: 'textarea' });
    fillField(field, 'multi\nline');
    expect(ta.value).toBe('multi\nline');
  });

  it('coerces date input to YYYY-MM-DD', () => {
    const input = document.createElement('input');
    input.type = 'date';
    document.body.appendChild(input);
    const field = makeField({ el: input, type: 'date' });
    const r = fillField(field, '2024年5月16日');
    expect(r.newValue).toBe('2024-05-16');
    expect(input.value).toBe('2024-05-16');
  });
});

describe('fillField - select', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('matches by option value exactly', () => {
    const sel = document.createElement('select');
    sel.innerHTML = `<option value="bj">Beijing</option><option value="sh">Shanghai</option>`;
    document.body.appendChild(sel);
    const field = makeField({
      el: sel,
      type: 'select',
      options: [
        { value: 'bj', label: 'Beijing' },
        { value: 'sh', label: 'Shanghai' },
      ],
    });
    const r = fillField(field, 'sh');
    expect(sel.value).toBe('sh');
    expect(r.success).toBe(true);
    expect(r.matchedOption?.value).toBe('sh');
  });

  it('matches by visible label text', () => {
    const sel = document.createElement('select');
    sel.innerHTML = `<option value="bj">北京</option><option value="sh">上海</option>`;
    document.body.appendChild(sel);
    const field = makeField({
      el: sel,
      type: 'select',
      options: [
        { value: 'bj', label: '北京' },
        { value: 'sh', label: '上海' },
      ],
    });
    fillField(field, '上海');
    expect(sel.value).toBe('sh');
  });

  it('returns success=false when no option matches', () => {
    const sel = document.createElement('select');
    sel.innerHTML = `<option value="a">A</option>`;
    document.body.appendChild(sel);
    const field = makeField({
      el: sel,
      type: 'select',
      options: [{ value: 'a', label: 'A' }],
    });
    const r = fillField(field, 'zzzz');
    expect(r.success).toBe(false);
  });

  it('does NOT match a placeholder option with empty value', () => {
    // Regression: `'guangzhou'.includes('')` is true; the empty-value
    // placeholder option used to be picked as a containsValue fallback.
    const sel = document.createElement('select');
    sel.innerHTML = `
      <option value="">-- choose --</option>
      <option value="gz">广州</option>
    `;
    document.body.appendChild(sel);
    const field = makeField({
      el: sel,
      type: 'select',
      options: [
        { value: '', label: '-- choose --' },
        { value: 'gz', label: '广州' },
      ],
    });
    const r = fillField(field, 'guangzhou');
    expect(sel.value).toBe('gz');
    expect(r.matchedOption?.value).toBe('gz');
  });

  it('matches by built-in alias (pinyin → 中文 label)', () => {
    const sel = document.createElement('select');
    sel.innerHTML = `<option value="gz">广州</option><option value="sh">上海</option>`;
    document.body.appendChild(sel);
    const field = makeField({
      el: sel,
      type: 'select',
      options: [
        { value: 'gz', label: '广州' },
        { value: 'sh', label: '上海' },
      ],
    });
    const r = fillField(field, 'guangzhou');
    expect(sel.value).toBe('gz');
    expect(r.success).toBe(true);
    expect(r.matchedOption?.value).toBe('gz');
  });

  it('matches by built-in alias (Canton → 广州)', () => {
    const sel = document.createElement('select');
    sel.innerHTML = `<option value="gz">广州</option><option value="bj">北京</option>`;
    document.body.appendChild(sel);
    const field = makeField({
      el: sel,
      type: 'select',
      options: [
        { value: 'gz', label: '广州' },
        { value: 'bj', label: '北京' },
      ],
    });
    fillField(field, 'Canton');
    expect(sel.value).toBe('gz');
  });

  it('honors host-provided optionAliases', () => {
    const sel = document.createElement('select');
    sel.innerHTML = `<option value="admin">管理员</option><option value="user">普通用户</option>`;
    document.body.appendChild(sel);
    const field = makeField({
      el: sel,
      type: 'select',
      options: [
        { value: 'admin', label: '管理员' },
        { value: 'user', label: '普通用户' },
      ],
    });
    fillField(field, 'root', {
      optionAliases: { admin: ['root', 'superuser'] },
    });
    expect(sel.value).toBe('admin');
  });
});

describe('fillField - radio', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('checks the matching radio and unchecks others', () => {
    const wrap = document.createElement('div');
    wrap.innerHTML = `
      <input type="radio" name="g" value="m" />
      <input type="radio" name="g" value="f" />
    `;
    document.body.appendChild(wrap);
    const radios = Array.from(wrap.querySelectorAll<HTMLInputElement>('input'));
    const field = makeField({
      el: radios[0]!,
      els: radios,
      type: 'radio',
      options: [
        { value: 'm', label: 'Male' },
        { value: 'f', label: 'Female' },
      ],
    });
    const r = fillField(field, 'f');
    expect(radios[0]!.checked).toBe(false);
    expect(radios[1]!.checked).toBe(true);
    expect(r.success).toBe(true);
  });

  it('falls back to label match', () => {
    const wrap = document.createElement('div');
    wrap.innerHTML = `
      <input type="radio" name="g" value="m" />
      <input type="radio" name="g" value="f" />
    `;
    document.body.appendChild(wrap);
    const radios = Array.from(wrap.querySelectorAll<HTMLInputElement>('input'));
    const field = makeField({
      el: radios[0]!,
      els: radios,
      type: 'radio',
      options: [
        { value: 'm', label: 'Male' },
        { value: 'f', label: 'Female' },
      ],
    });
    fillField(field, 'Female');
    expect(radios[1]!.checked).toBe(true);
  });
});

describe('fillField - checkbox', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('checks the listed tokens, unchecks others', async () => {
    const wrap = document.createElement('div');
    wrap.innerHTML = `
      <input type="checkbox" name="h" value="a" checked />
      <input type="checkbox" name="h" value="b" />
      <input type="checkbox" name="h" value="c" />
    `;
    document.body.appendChild(wrap);
    const boxes = Array.from(wrap.querySelectorAll<HTMLInputElement>('input'));
    const field = makeField({
      el: boxes[0]!,
      els: boxes,
      type: 'checkbox',
      options: [
        { value: 'a', label: 'A' },
        { value: 'b', label: 'B' },
        { value: 'c', label: 'C' },
      ],
    });
    const r = fillField(field, 'b, c');
    // fillCheckbox 内部把 click() 串成微任务序列以解决 Vue v-model 数组的
    // stale `_modelValue` bug；测试需要 flush 几个微任务后再断言。
    await flushMicrotasks(boxes.length);
    expect(boxes[0]!.checked).toBe(false);
    expect(boxes[1]!.checked).toBe(true);
    expect(boxes[2]!.checked).toBe(true);
    expect(r.success).toBe(true);
  });

  async function flushMicrotasks(n: number): Promise<void> {
    for (let i = 0; i < n + 1; i++) {
      await Promise.resolve();
    }
  }

  it('returns success=false when no token matches', () => {
    const wrap = document.createElement('div');
    wrap.innerHTML = `<input type="checkbox" name="h" value="a" />`;
    document.body.appendChild(wrap);
    const cb = wrap.querySelector<HTMLInputElement>('input')!;
    const field = makeField({
      el: cb,
      els: [cb],
      type: 'checkbox',
      options: [{ value: 'a', label: 'A' }],
    });
    const r = fillField(field, 'zzz');
    expect(r.success).toBe(false);
  });
});

describe('undoFills', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('restores text input old value and re-dispatches events', () => {
    const input = document.createElement('input');
    input.value = 'original';
    document.body.appendChild(input);
    const field = makeField({ el: input, currentValue: 'original' });
    const r = fillField(field, 'new');
    expect(input.value).toBe('new');
    undoFills([r]);
    expect(input.value).toBe('original');
    expect(field.currentValue).toBe('original');
  });

  it('restores radio selection', () => {
    const wrap = document.createElement('div');
    wrap.innerHTML = `
      <input type="radio" name="g" value="m" checked />
      <input type="radio" name="g" value="f" />
    `;
    document.body.appendChild(wrap);
    const radios = Array.from(wrap.querySelectorAll<HTMLInputElement>('input'));
    const field = makeField({
      el: radios[0]!,
      els: radios,
      type: 'radio',
      currentValue: 'm',
      options: [
        { value: 'm', label: 'M' },
        { value: 'f', label: 'F' },
      ],
    });
    const r = fillField(field, 'f');
    expect(radios[1]!.checked).toBe(true);
    undoFills([r]);
    expect(radios[0]!.checked).toBe(true);
    expect(radios[1]!.checked).toBe(false);
  });

  it('skips failed records', () => {
    const input = document.createElement('input');
    document.body.appendChild(input);
    const field = makeField({ el: input });
    const failed = {
      field,
      oldValue: '',
      newValue: 'x',
      success: false,
    };
    undoFills([failed]);
    expect(input.value).toBe('');
  });
});

describe('highlightFilledField', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    clearFillHighlights();
  });

  it('adds highlight class to the field elements', () => {
    const input = document.createElement('input');
    document.body.appendChild(input);
    const field = makeField({ el: input });
    highlightFilledField(field, 1000);
    expect(input.classList.contains('ai-form-fill-highlight')).toBe(true);
  });

  it('clears highlight when clearFillHighlights() called', () => {
    const input = document.createElement('input');
    document.body.appendChild(input);
    const field = makeField({ el: input });
    highlightFilledField(field, 5000);
    clearFillHighlights();
    expect(input.classList.contains('ai-form-fill-highlight')).toBe(false);
  });
});
