import { describe, it, expect, vi } from 'vitest';
import { useRafBatch, createReadWriteBatch } from './useRafBatch';

describe('useRafBatch', () => {
  it('coalesces multiple calls within a single rAF tick', () => {
    vi.useFakeTimers();
    try {
      const cb = vi.fn();
      const wrapped = useRafBatch(cb);
      wrapped('a');
      wrapped('b');
      wrapped('c');
      expect(cb).not.toHaveBeenCalled();
      vi.runAllTimers();
      expect(cb).toHaveBeenCalledTimes(1);
      expect(cb).toHaveBeenCalledWith('c');
    } finally {
      vi.useRealTimers();
    }
  });

  it('flush() runs the pending callback synchronously', () => {
    vi.useFakeTimers();
    try {
      const cb = vi.fn();
      const wrapped = useRafBatch(cb);
      wrapped(1);
      wrapped(2);
      wrapped.flush();
      expect(cb).toHaveBeenCalledTimes(1);
      expect(cb).toHaveBeenCalledWith(2);
      vi.runAllTimers();
      expect(cb).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('cancel() drops pending args without invoking the callback', () => {
    vi.useFakeTimers();
    try {
      const cb = vi.fn();
      const wrapped = useRafBatch(cb);
      wrapped('x');
      wrapped.cancel();
      vi.runAllTimers();
      expect(cb).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('dispose() prevents subsequent calls', () => {
    vi.useFakeTimers();
    try {
      const cb = vi.fn();
      const wrapped = useRafBatch(cb);
      wrapped.dispose();
      wrapped('after-dispose');
      vi.runAllTimers();
      expect(cb).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('safe to call dispose multiple times', () => {
    const wrapped = useRafBatch(() => undefined);
    wrapped.dispose();
    wrapped.dispose();
    expect(true).toBe(true);
  });

  it('callback errors are caught and logged', () => {
    vi.useFakeTimers();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      const wrapped = useRafBatch(() => {
        throw new Error('boom');
      });
      wrapped();
      vi.runAllTimers();
      expect(warn).toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
      warn.mockRestore();
    }
  });
});

describe('createReadWriteBatch', () => {
  it('runs all reads before any writes', () => {
    vi.useFakeTimers();
    try {
      const batch = createReadWriteBatch();
      const calls: string[] = [];
      batch.write(() => calls.push('w1'));
      batch.read(() => calls.push('r1'));
      batch.write(() => calls.push('w2'));
      batch.read(() => calls.push('r2'));
      vi.runAllTimers();
      expect(calls).toEqual(['r1', 'r2', 'w1', 'w2']);
    } finally {
      vi.useRealTimers();
    }
  });

  it('multiple schedules within a tick coalesce into one rAF', () => {
    vi.useFakeTimers();
    try {
      const batch = createReadWriteBatch();
      const fn = vi.fn();
      batch.read(fn);
      batch.read(fn);
      batch.write(fn);
      vi.runAllTimers();
      expect(fn).toHaveBeenCalledTimes(3);
    } finally {
      vi.useRealTimers();
    }
  });
});
