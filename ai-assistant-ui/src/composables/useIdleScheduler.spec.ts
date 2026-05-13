import { describe, it, expect, vi } from 'vitest';
import { useIdleScheduler, runInChunks } from './useIdleScheduler';

describe('useIdleScheduler', () => {
  it('runs scheduled tasks via requestIdleCallback fallback', async () => {
    vi.useFakeTimers();
    try {
      const scheduler = useIdleScheduler();
      const calls: number[] = [];
      scheduler.schedule(() => calls.push(1));
      scheduler.schedule(() => calls.push(2));
      expect(scheduler.pendingCount()).toBe(2);
      vi.runAllTimers();
      expect(calls).toEqual([1, 2]);
      expect(scheduler.pendingCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('cancel() removes a pending task', () => {
    vi.useFakeTimers();
    try {
      const scheduler = useIdleScheduler();
      const fn = vi.fn();
      const id = scheduler.schedule(fn);
      expect(scheduler.cancel(id)).toBe(true);
      vi.runAllTimers();
      expect(fn).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('cancel() returns false for unknown id', () => {
    const scheduler = useIdleScheduler();
    expect(scheduler.cancel(999)).toBe(false);
  });

  it('cancelAll() drops everything', () => {
    vi.useFakeTimers();
    try {
      const scheduler = useIdleScheduler();
      const fn = vi.fn();
      scheduler.schedule(fn);
      scheduler.schedule(fn);
      scheduler.schedule(fn);
      const cancelled = scheduler.cancelAll();
      expect(cancelled).toBe(3);
      vi.runAllTimers();
      expect(fn).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('flush() runs all pending tasks synchronously', () => {
    vi.useFakeTimers();
    try {
      const scheduler = useIdleScheduler();
      const calls: number[] = [];
      scheduler.schedule(() => calls.push(1));
      scheduler.schedule(() => calls.push(2));
      const ran = scheduler.flush();
      expect(ran).toBe(2);
      expect(calls).toEqual([1, 2]);
      expect(scheduler.pendingCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('flush() catches errors from individual tasks', () => {
    const scheduler = useIdleScheduler();
    const goodFn = vi.fn();
    scheduler.schedule(() => {
      throw new Error('boom');
    });
    scheduler.schedule(goodFn);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      const ran = scheduler.flush();
      expect(ran).toBe(2);
      expect(goodFn).toHaveBeenCalled();
      expect(warn).toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });

  it('dispose() is a no-op-safe cancelAll', () => {
    const scheduler = useIdleScheduler();
    scheduler.schedule(() => undefined);
    scheduler.dispose();
    scheduler.dispose();
    expect(scheduler.pendingCount()).toBe(0);
  });

  it('runInChunks slices work across multiple frames', async () => {
    vi.useFakeTimers();
    const scheduler = useIdleScheduler();
    const items = Array.from({ length: 50 }, (_, i) => i);
    const seen: number[] = [];
    const promise = runInChunks(scheduler, items, (item) => seen.push(item), {
      chunkSize: 10,
    });
    await vi.runAllTimersAsync();
    await promise;
    vi.useRealTimers();
    expect(seen).toEqual(items);
  });
});
