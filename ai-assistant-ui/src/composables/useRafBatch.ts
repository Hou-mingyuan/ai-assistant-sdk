/**
 * useRafBatch
 * -----------
 * \u5c06\u591a\u6b21\u5c0f\u52a8\u4f5c\u5408\u5e76\u5230\u4e0b\u4e00\u4e2a\u52a8\u753b\u5e27\u6267\u884c\uff0c\u907f\u514d\u9891\u7e41\u8bfb\u5199 DOM \u9020\u6210\u7684 layout thrashing\u3002
 *
 * Use cases:
 *
 *   - resize / scroll / mousemove / pointermove \u4e8b\u4ef6\u56de\u8c03\u7684 throttle
 *   - \u6d88\u606f\u5217\u8868\u9ad8\u5ea6\u6d4b\u91cf\u6279\u91cf\u5199\u56de virtual scroll \u72b6\u6001
 *   - \u591a\u4e2a\u4e0d\u540c source \u540c\u65f6\u4e0a\u62a5\u7684 viewport / scroll \u53d8\u66f4
 *
 * \u4e0e\u4e00\u822c throttle/debounce \u4e0d\u540c\uff1a
 *
 *   - \u91c7\u7528 requestAnimationFrame \u8054\u52a8\u6d4f\u89c8\u5668\u7684 paint \u8282\u594f\uff08\u7406\u8bba\u4e0a 60FPS = 16.67ms\uff09
 *   - \u540c\u4e00\u5e27\u5185\u8c03 N \u6b21\u53ea\u4f1a\u8c03\u4e00\u6b21\u771f\u5b9e callback\uff1b\u591a\u6b21\u8c03\u53ea\u4f1a\u4f7f\u7528\u6700\u540e\u4e00\u6b21\u7684\u53c2\u6570
 *   - \u9875\u9762\u9690\u85cf\uff08visibilitychange\uff09\u65f6\u4e0d\u8c03\u8d77 rAF\uff0c\u8282\u7535
 *
 * \u4f7f\u7528\u4f8b\uff1a
 *
 * ```ts
 * const trackScroll = useRafBatch((e: Event) => {
 *   scrollTop.value = (e.target as HTMLElement).scrollTop;
 * });
 *
 * onMounted(() => container.value.addEventListener('scroll', trackScroll, { passive: true }));
 * onUnmounted(() => {
 *   container.value.removeEventListener('scroll', trackScroll);
 *   trackScroll.dispose();
 * });
 * ```
 */

export interface RafBatch<TArgs extends unknown[]> {
  (...args: TArgs): void;
  /** Force the queued callback to run synchronously right now. */
  flush(): void;
  /** Drop any pending invocation. */
  cancel(): void;
  /** Detach permanent state; safe to call multiple times. */
  dispose(): void;
}

/**
 * Wrap a callback so that all calls within the same animation frame are
 * coalesced into one invocation with the last-seen arguments.
 */
export function useRafBatch<TArgs extends unknown[]>(
  cb: (...args: TArgs) => void,
): RafBatch<TArgs> {
  let pendingArgs: TArgs | null = null;
  let rafHandle: number | null = null;
  let disposed = false;

  const raf =
    (globalThis as unknown as { requestAnimationFrame?: typeof requestAnimationFrame })
      .requestAnimationFrame ??
    ((fn: FrameRequestCallback) => globalThis.setTimeout(() => fn(performance.now()), 16) as unknown as number);

  const cancelRaf =
    (globalThis as unknown as { cancelAnimationFrame?: typeof cancelAnimationFrame })
      .cancelAnimationFrame ??
    ((handle: number) => globalThis.clearTimeout(handle as unknown as ReturnType<typeof setTimeout>));

  const wrapped = ((...args: TArgs) => {
    if (disposed) return;
    pendingArgs = args;
    if (rafHandle != null) return;
    rafHandle = raf(() => {
      rafHandle = null;
      const a = pendingArgs;
      pendingArgs = null;
      if (a != null && !disposed) {
        try {
          cb(...a);
        } catch (e) {
          console.warn('[useRafBatch] callback threw', e);
        }
      }
    });
  }) as RafBatch<TArgs>;

  wrapped.flush = () => {
    if (rafHandle != null) {
      cancelRaf(rafHandle);
      rafHandle = null;
    }
    const a = pendingArgs;
    pendingArgs = null;
    if (a != null && !disposed) {
      try {
        cb(...a);
      } catch (e) {
        console.warn('[useRafBatch] flush callback threw', e);
      }
    }
  };

  wrapped.cancel = () => {
    if (rafHandle != null) {
      cancelRaf(rafHandle);
      rafHandle = null;
    }
    pendingArgs = null;
  };

  wrapped.dispose = () => {
    if (disposed) return;
    disposed = true;
    wrapped.cancel();
  };

  return wrapped;
}

/**
 * Coalesce a batch of DOM reads and writes within a single rAF tick to avoid
 * layout thrashing (interleaved measure/mutate cycles cause forced reflows).
 *
 * ```ts
 * const batch = createReadWriteBatch();
 *
 * batch.read(() => measure1(el));
 * batch.write(() => mutate1(el));
 * batch.read(() => measure2(el));
 * batch.write(() => mutate2(el));
 *
 * \uff0f\uff0f \u8fd9\u4e9b\u4f1a\u4ee5\uff1areads \u4e00\u8d77\u8dd1\u5b8c\u540e\u624d\u8dd1 writes\u3002
 * ```
 */
export function createReadWriteBatch() {
  const reads: Array<() => void> = [];
  const writes: Array<() => void> = [];
  let scheduled = false;

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      const currentReads = reads.splice(0, reads.length);
      const currentWrites = writes.splice(0, writes.length);
      /* Phase 1: reads (force layout once) */
      for (const r of currentReads) {
        try {
          r();
        } catch (e) {
          console.warn('[createReadWriteBatch] read threw', e);
        }
      }
      /* Phase 2: writes (mutate DOM without re-triggering layout per write) */
      for (const w of currentWrites) {
        try {
          w();
        } catch (e) {
          console.warn('[createReadWriteBatch] write threw', e);
        }
      }
    });
  }

  return {
    read(fn: () => void) {
      reads.push(fn);
      schedule();
    },
    write(fn: () => void) {
      writes.push(fn);
      schedule();
    },
  };
}
