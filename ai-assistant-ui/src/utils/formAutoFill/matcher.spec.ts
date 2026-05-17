import { describe, it, expect } from 'vitest';
import {
  matchFields,
  normalize,
  levenshteinDistance,
  levenshteinSimilarity,
  longestCommonSubstring,
} from './matcher';
import type { ParsedPair } from './parser';
import type { FormField } from './scanner';

function fakeField(labels: string[], id = labels.join('|')): FormField {
  return {
    el: {} as HTMLElement,
    els: [],
    type: 'text',
    labels,
    currentValue: '',
    options: [],
    id,
    visible: true,
  };
}

function pair(key: string, value = String(key)): ParsedPair {
  return { key, value, raw: `${key}:${value}` };
}

describe('normalize', () => {
  it('lowercases and trims whitespace', () => {
    expect(normalize('  Customer Name  ')).toBe('customer name');
  });

  it('strips ASCII punctuation', () => {
    expect(normalize('Customer-Name:')).toBe('customername');
  });

  it('strips CJK full-width and ASCII parentheses', () => {
    expect(normalize('姓名（必填）')).toBe('姓名必填');
  });

  it('removes "请输入" prefix', () => {
    expect(normalize('请输入姓名')).toBe('姓名');
  });

  it('removes "please enter" prefix', () => {
    expect(normalize('please enter age')).toBe('age');
  });

  it('handles empty / null gracefully', () => {
    expect(normalize('')).toBe('');
  });
});

describe('matchFields', () => {
  it('produces exact match with score 100', () => {
    const pairs = [pair('Name', 'Alice')];
    const fields = [fakeField(['Name'])];
    const r = matchFields(pairs, fields);
    expect(r[0]!.field).toBe(fields[0]);
    expect(r[0]!.confidence).toBe(100);
    expect(r[0]!.strategy).toBe('exact');
  });

  it('detects case-insensitive exact via normalize', () => {
    const r = matchFields([pair('NAME')], [fakeField(['name'])]);
    expect(r[0]!.confidence).toBe(100);
  });

  it('matches contains relationship at 80', () => {
    const r = matchFields([pair('客户姓名')], [fakeField(['姓名'])]);
    expect(r[0]!.strategy).toBe('contains');
    expect(r[0]!.confidence).toBe(80);
  });

  it('uses built-in synonyms (60)', () => {
    const r = matchFields([pair('电话')], [fakeField(['phone'])]);
    expect(r[0]!.strategy).toBe('synonym');
    expect(r[0]!.confidence).toBe(60);
  });

  it('honors custom synonyms', () => {
    const r = matchFields([pair('foo')], [fakeField(['bar'])], {
      synonyms: { aliasGroup: ['foo', 'bar'] },
    });
    expect(r[0]!.strategy).toBe('synonym');
  });

  it('disables built-in synonyms when configured', () => {
    const r = matchFields([pair('电话')], [fakeField(['phone'])], {
      disableBuiltinSynonyms: true,
    });
    expect(r[0]!.strategy).not.toBe('synonym');
  });

  it('detects substring relationship', () => {
    const r = matchFields([pair('订单编码')], [fakeField(['订单编号_2024'])]);
    expect(['contains', 'substring']).toContain(r[0]!.strategy);
    expect(r[0]!.confidence).toBeGreaterThanOrEqual(50);
  });

  it('uses Levenshtein for typos at 30~45', () => {
    const r = matchFields([pair('username')], [fakeField(['usrename'])]);
    expect(r[0]!.strategy).toBe('levenshtein');
    expect(r[0]!.confidence).toBeGreaterThanOrEqual(30);
    expect(r[0]!.confidence).toBeLessThanOrEqual(45);
  });

  it('returns null field when nothing meets minConfidence', () => {
    const r = matchFields([pair('totally different')], [fakeField(['x'])], {
      minConfidence: 30,
    });
    expect(r[0]!.field).toBeNull();
    expect(r[0]!.confidence).toBe(0);
  });

  it('respects minConfidence override', () => {
    const r = matchFields([pair('username')], [fakeField(['usrename'])], {
      minConfidence: 50,
    });
    expect(r[0]!.field).toBeNull();
  });

  it('greedy 1-1 assignment picks higher score first', () => {
    const pairs = [pair('email'), pair('e-mail')];
    const fields = [fakeField(['email'])];
    const r = matchFields(pairs, fields);
    expect(r[0]!.field).toBe(fields[0]);
    expect(r[1]!.field).toBeNull();
  });

  it('two pairs get two different fields if both exist', () => {
    const pairs = [pair('name'), pair('email')];
    const fields = [fakeField(['name']), fakeField(['email'])];
    const r = matchFields(pairs, fields);
    expect(r[0]!.field).toBe(fields[0]);
    expect(r[1]!.field).toBe(fields[1]);
  });

  it('handles empty pairs or empty fields', () => {
    expect(matchFields([], [fakeField(['x'])])).toEqual([]);
    const r = matchFields([pair('x')], []);
    expect(r[0]!.field).toBeNull();
  });

  it('preserves pair order in results', () => {
    const pairs = [pair('email'), pair('name'), pair('phone')];
    const fields = [fakeField(['name']), fakeField(['email']), fakeField(['phone'])];
    const r = matchFields(pairs, fields);
    expect(r.map((m) => m.pair.key)).toEqual(['email', 'name', 'phone']);
  });

  it('exposes matchedLabel for UI explanation', () => {
    const r = matchFields([pair('客户名')], [fakeField(['username', '客户名称', '姓名'])]);
    expect(r[0]!.matchedLabel).toBe('客户名称');
  });
});

describe('levenshteinDistance', () => {
  it('returns 0 for identical strings', () => {
    expect(levenshteinDistance('abc', 'abc')).toBe(0);
  });
  it('returns length when one is empty', () => {
    expect(levenshteinDistance('', 'abc')).toBe(3);
    expect(levenshteinDistance('abc', '')).toBe(3);
  });
  it('computes classic edit distance', () => {
    expect(levenshteinDistance('kitten', 'sitting')).toBe(3);
  });
});

describe('levenshteinSimilarity', () => {
  it('returns 1 for identical', () => {
    expect(levenshteinSimilarity('abc', 'abc')).toBe(1);
  });
  it('returns 0 for fully different equal-length strings', () => {
    expect(levenshteinSimilarity('abc', 'xyz')).toBe(0);
  });
});

describe('longestCommonSubstring', () => {
  it('returns 0 for no overlap', () => {
    expect(longestCommonSubstring('abc', 'xyz')).toBe(0);
  });
  it('finds the longest contiguous match', () => {
    expect(longestCommonSubstring('abcdefg', 'xcdefz')).toBe(4);
  });
});
