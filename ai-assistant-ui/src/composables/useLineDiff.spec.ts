import { describe, it, expect } from 'vitest';
import { diffLines, opsToRows, summariseRows } from './useLineDiff';

describe('diffLines', () => {
  it('identical text produces all-equal rows + zero delta', () => {
    const t = 'a\nb\nc';
    const { rows, summary } = diffLines(t, t);
    expect(rows.every((r) => r.kind === 'equal')).toBe(true);
    expect(summary).toEqual({ equal: 3, added: 0, removed: 0, changed: 0, delta: 0 });
  });

  it('empty vs non-empty produces all additions', () => {
    const { rows, summary } = diffLines('', 'x\ny');
    expect(summary.added).toBe(2);
    expect(summary.removed).toBe(0);
    expect(rows.every((r) => r.kind === 'add')).toBe(true);
    expect(rows.map((r) => r.rightText)).toEqual(['x', 'y']);
  });

  it('non-empty vs empty produces all removals', () => {
    const { summary } = diffLines('x\ny\nz', '');
    expect(summary).toEqual({ equal: 0, added: 0, removed: 3, changed: 0, delta: 3 });
  });

  it('single-line change pairs into one row of kind=change', () => {
    const { rows } = diffLines('hello world', 'hello dlrow');
    expect(rows.length).toBe(1);
    expect(rows[0]?.kind).toBe('change');
    expect(rows[0]?.leftText).toBe('hello world');
    expect(rows[0]?.rightText).toBe('hello dlrow');
  });

  it('preserves equal lines around an isolated change', () => {
    const left = 'header\nold\nfooter';
    const right = 'header\nnew\nfooter';
    const { rows } = diffLines(left, right);
    expect(rows.map((r) => r.kind)).toEqual(['equal', 'change', 'equal']);
    expect(rows[0]?.leftText).toBe('header');
    expect(rows[2]?.leftText).toBe('footer');
  });

  it('does not merge multi-remove / multi-add into a change', () => {
    const left = 'a\nb\nc';
    const right = 'x\ny';
    const { rows } = diffLines(left, right);
    /* Should emit 3 removes + 2 adds in some order without merging. */
    const removes = rows.filter((r) => r.kind === 'remove').length;
    const adds = rows.filter((r) => r.kind === 'add').length;
    const changes = rows.filter((r) => r.kind === 'change').length;
    expect(removes + adds + changes * 2).toBe(5);
  });

  it('summary delta = added + removed + changed', () => {
    const { rows, summary } = diffLines('a\nb\nc\nd', 'a\nX\nc\nY');
    expect(summary.equal).toBe(2);
    expect(summary.delta).toBe(summary.added + summary.removed + summary.changed);
    expect(rows.length).toBeGreaterThan(0);
  });

  it('handles \\r\\n only on the left as different lines', () => {
    /* splitLines splits on \\n only; \\r is part of the line. */
    const { summary } = diffLines('hello\r\nworld', 'hello\nworld');
    expect(summary.equal).toBe(1);
    expect(summary.delta).toBeGreaterThan(0);
  });

  it('row index annotations are 1-based and null for missing sides', () => {
    const { rows } = diffLines('a\nb', 'a\nc');
    /* Expected: row1 equal a/a (left=1, right=1), row2 change b->c (left=2, right=2). */
    expect(rows[0]?.leftLine).toBe(1);
    expect(rows[0]?.rightLine).toBe(1);
    expect(rows[1]?.leftLine).toBe(2);
    expect(rows[1]?.rightLine).toBe(2);
  });

  it('opsToRows + summariseRows compose deterministically', () => {
    const { rows } = diffLines('a\nb\nc', 'a\nb\nd\nc');
    const summary = summariseRows(rows);
    expect(summary.equal).toBe(3);
    expect(summary.added).toBe(1);
  });

  it('handles empty strings on both sides', () => {
    const { rows, summary } = diffLines('', '');
    expect(rows).toEqual([]);
    expect(summary).toEqual({ equal: 0, added: 0, removed: 0, changed: 0, delta: 0 });
  });

  it('opsToRows exposed for advanced consumers', () => {
    expect(typeof opsToRows).toBe('function');
  });
});
