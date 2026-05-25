import { describe, expect, it, vi } from 'vitest';

import { useMessageCopy } from './useMessageCopy';

describe('useMessageCopy', () => {
  it('copies a message and clears the copied index after the feedback delay', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const reportError = vi.fn();
    const pendingTimers: number[] = [];
    const timerCallbacks: Array<() => void> = [];
    const copy = useMessageCopy({
      writeText,
      reportError,
      pendingTimers,
      setTimeoutFn: (cb) => {
        timerCallbacks.push(cb);
        return 21;
      },
    });

    await copy.copyMessage('hello', 3);

    expect(writeText).toHaveBeenCalledWith('hello');
    expect(copy.copiedIndex.value).toBe(3);
    expect(pendingTimers).toEqual([21]);
    expect(reportError).not.toHaveBeenCalled();

    timerCallbacks[0]?.();
    expect(copy.copiedIndex.value).toBe(-1);
  });

  it('reports clipboard failures without setting the copied index', async () => {
    const reportError = vi.fn();
    const copy = useMessageCopy({
      writeText: vi.fn().mockRejectedValue(new Error('denied')),
      reportError,
    });

    await copy.copyMessage('hello', 2);

    expect(copy.copiedIndex.value).toBe(-1);
    expect(reportError).toHaveBeenCalledWith('clipboard', 'Copy failed');
  });
});
