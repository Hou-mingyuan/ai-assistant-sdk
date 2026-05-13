/**
 * useIdleScheduler
 * -----------------
 * \u8c03\u5ea6\u540e\u53f0\u4efb\u52a1\u5728\u6d4f\u89c8\u5668\u7a7a\u95f2\u65f6\u8fd0\u884c\uff0c\u907f\u514d\u5360\u7528\u4ea4\u4e92\u5e27\u9884\u7b97\u3002
 *
 * Use cases for the AI assistant widget:
 *
 *   - \u63a8\u8fdf\u793e\u4ea4\u63d2\u4ef6 / Web Component \u521d\u59cb\u5316
 *   - \u63a8\u8fdf\u5386\u53f2\u4f1a\u8bdd\u7d22\u5f15\u8fd0\u7b97
 *   - \u63a8\u8fdf\u4e0d\u53ef\u89c1\u6d88\u606f\u7684 Markdown \u9884\u6e32\u67d3
 *   - \u63a8\u8fdf token usage / latency \u7edf\u8ba1\u4e0a\u62a5
 *
 * \u4f7f\u7528\u539f\u751f `requestIdleCallback`\uff08\u53ef\u7528\u65f6\uff09\u6216\u964d\u7ea7\u4e3a `setTimeout(0)`\u3002
 * \u8d85\u65f6 `timeout` \u540e\u5f3a\u5236\u8fd0\u884c\uff0c\u9632\u6b62\u4efb\u52a1\u88ab\u6c38\u4e45\u63a8\u8fdf\u3002
 *
 * \u4e3e\u4f8b\uff1a
 *
 * ```ts
 * const scheduler = useIdleScheduler();
 *
 * scheduler.schedule(() => {
 *   indexHistorySessions();
 * }, { timeout: 2000, priority: 'low' });
 *
 * \uff0f\uff0f \u70b9\u51fb\u5907\u4efd\u542f\u52a8\uff1a
 * scheduler.flush(); \uff0f\uff0f \u7acb\u5373\u6e05\u7406\u5e76\u8fd0\u884c\u6240\u6709\u6302\u8d77\u7684\u4efb\u52a1
 *
 * onUnmounted(scheduler.dispose);
 * ```
 */

export interface IdleTask {
  id: number;
  fn: (deadline: IdleDeadline) => void;
  timeout: number;
  priority: 'low' | 'normal';
  scheduledAt: number;
  handle: number | null;
}

export interface IdleScheduleOptions {
  /** Max time to wait before forcing execution (ms). Default 5000. */
  timeout?: number;
  /** 'low' tasks are deferred more aggressively. Default 'normal'. */
  priority?: 'low' | 'normal';
}

interface IdleDeadline {
  didTimeout: boolean;
  timeRemaining(): number;
}

type RIC = (cb: (d: IdleDeadline) => void, opts?: { timeout?: number }) => number;
type CIC = (handle: number) => void;

const requestIdle: RIC =
  (globalThis as unknown as { requestIdleCallback?: RIC }).requestIdleCallback ??
  ((cb) => {
    return globalThis.setTimeout(() => {
      const start = performance.now();
      cb({
        didTimeout: false,
        timeRemaining: () => Math.max(0, 16 - (performance.now() - start)),
      });
    }, 0) as unknown as number;
  });

const cancelIdle: CIC =
  (globalThis as unknown as { cancelIdleCallback?: CIC }).cancelIdleCallback ??
  ((id) => globalThis.clearTimeout(id as unknown as ReturnType<typeof setTimeout>));

export function useIdleScheduler() {
  let nextId = 1;
  const pending = new Map<number, IdleTask>();

  function schedule(
    fn: (deadline: IdleDeadline) => void,
    opts: IdleScheduleOptions = {},
  ): number {
    const id = nextId++;
    const task: IdleTask = {
      id,
      fn,
      timeout: opts.timeout ?? 5000,
      priority: opts.priority ?? 'normal',
      scheduledAt: performance.now(),
      handle: null,
    };
    const handle = requestIdle(
      (deadline) => {
        pending.delete(id);
        try {
          fn(deadline);
        } catch (e) {
          console.warn('[useIdleScheduler] task threw', e);
        }
      },
      { timeout: task.timeout },
    );
    task.handle = handle;
    pending.set(id, task);
    return id;
  }

  function cancel(id: number): boolean {
    const task = pending.get(id);
    if (!task) return false;
    if (task.handle != null) cancelIdle(task.handle);
    pending.delete(id);
    return true;
  }

  function cancelAll(): number {
    let cancelled = 0;
    for (const t of pending.values()) {
      if (t.handle != null) cancelIdle(t.handle);
      cancelled += 1;
    }
    pending.clear();
    return cancelled;
  }

  /**
   * Run every pending task immediately (synchronous). Use when the page is about
   * to unload or when the user explicitly requests "do everything now".
   */
  function flush(): number {
    let ran = 0;
    const snapshot = Array.from(pending.values());
    pending.clear();
    for (const task of snapshot) {
      if (task.handle != null) cancelIdle(task.handle);
      ran += 1;
      try {
        task.fn({ didTimeout: true, timeRemaining: () => 0 });
      } catch (e) {
        console.warn('[useIdleScheduler] flush task threw', e);
      }
    }
    return ran;
  }

  function dispose(): void {
    cancelAll();
  }

  function pendingCount(): number {
    return pending.size;
  }

  return {
    schedule,
    cancel,
    cancelAll,
    flush,
    dispose,
    pendingCount,
  };
}

/**
 * Convenience wrapper: chunk a long-running synchronous computation into
 * small slices that yield to the browser whenever the deadline is up.
 *
 * ```ts
 * const scheduler = useIdleScheduler();
 * await runInChunks(scheduler, items, (item) => doExpensiveThing(item));
 * ```
 */
export function runInChunks<T>(
  scheduler: ReturnType<typeof useIdleScheduler>,
  items: readonly T[],
  fn: (item: T, index: number) => void,
  options: { chunkSize?: number; timeout?: number } = {},
): Promise<void> {
  const chunkSize = Math.max(1, options.chunkSize ?? 16);
  let i = 0;
  return new Promise((resolve, reject) => {
    function runChunk() {
      scheduler.schedule(
        (deadline) => {
          try {
            const end = Math.min(items.length, i + chunkSize);
            while (i < end && deadline.timeRemaining() > 1) {
              fn(items[i]!, i);
              i++;
            }
            if (i < items.length) {
              runChunk();
            } else {
              resolve();
            }
          } catch (e) {
            reject(e);
          }
        },
        { timeout: options.timeout ?? 1000 },
      );
    }
    runChunk();
  });
}
