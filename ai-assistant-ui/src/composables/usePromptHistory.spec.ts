import { describe, it, expect, beforeEach } from 'vitest';
import { usePromptHistory } from './usePromptHistory';

describe('usePromptHistory', () => {
  beforeEach(() => {
    try {
      localStorage.clear();
    } catch {
      /* ignore in test env */
    }
  });

  it('records and recalls prompts in LIFO order', () => {
    const h = usePromptHistory();
    h.record('hello');
    h.record('world');
    h.record('again');
    expect(h.recallOlder()).toBe('again');
    expect(h.recallOlder()).toBe('world');
    expect(h.recallOlder()).toBe('hello');
    expect(h.recallOlder()).toBe('hello'); /* clamped at oldest */
  });

  it('recallNewer walks back toward the most-recent entry then returns null', () => {
    const h = usePromptHistory();
    h.record('a');
    h.record('b');
    h.record('c');
    h.recallOlder(); /* c */
    h.recallOlder(); /* b */
    h.recallOlder(); /* a */
    expect(h.recallNewer()).toBe('b');
    expect(h.recallNewer()).toBe('c');
    expect(h.recallNewer()).toBeNull(); /* past newest -> caller clears field */
  });

  it('dedups consecutive duplicate records', () => {
    const h = usePromptHistory();
    h.record('same');
    h.record('same');
    h.record('same');
    expect(h.entries.value).toEqual(['same']);
  });

  it('record("") and record(whitespace) are no-ops', () => {
    const h = usePromptHistory();
    h.record('');
    h.record('   ');
    h.record('\n\t');
    expect(h.entries.value).toEqual([]);
  });

  it('respects the max cap by evicting oldest entries', () => {
    const h = usePromptHistory({ max: 3 });
    h.record('a');
    h.record('b');
    h.record('c');
    h.record('d');
    expect(h.entries.value).toEqual(['b', 'c', 'd']);
  });

  it('reset() clears the recall cursor but keeps entries', () => {
    const h = usePromptHistory();
    h.record('one');
    h.record('two');
    h.recallOlder(); /* now at 'two' */
    h.recallOlder(); /* now at 'one' */
    h.reset();
    expect(h.recallOlder()).toBe('two'); /* cursor reset to top */
  });

  it('persists to localStorage when storageKey is provided', () => {
    const h1 = usePromptHistory({ storageKey: 'prompt-hist-test' });
    h1.record('persisted');
    /* second instance reads from storage */
    const h2 = usePromptHistory({ storageKey: 'prompt-hist-test' });
    expect(h2.entries.value).toEqual(['persisted']);
  });

  it('initial entries seed in-memory when no storage hit', () => {
    const h = usePromptHistory({ initial: ['seed1', 'seed2'] });
    expect(h.entries.value).toEqual(['seed1', 'seed2']);
    expect(h.recallOlder()).toBe('seed2');
  });

  it('clear() empties the buffer and persists the empty state', () => {
    const h = usePromptHistory({ storageKey: 'prompt-hist-clear' });
    h.record('x');
    h.record('y');
    h.clear();
    expect(h.entries.value).toEqual([]);
    const h2 = usePromptHistory({ storageKey: 'prompt-hist-clear' });
    expect(h2.entries.value).toEqual([]);
  });

  it('handles empty history gracefully on recall', () => {
    const h = usePromptHistory();
    expect(h.recallOlder()).toBeNull();
    expect(h.recallNewer()).toBeNull();
  });
});
