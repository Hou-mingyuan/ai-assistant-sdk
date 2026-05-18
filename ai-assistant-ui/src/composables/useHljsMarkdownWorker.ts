/**
 * useHljsMarkdownWorker
 * ----------------------
 * Convenience wrapper around {@link useMarkdownWorker} that installs the
 * bundled {@link ../workers/markdownHljs.worker.ts} as the worker source.
 *
 * Why a separate composable:
 *   The base {@link useMarkdownWorker} ships a minimal Blob-URL worker that
 *   only knows about CommonMark + escape. To get real syntax highlighting in
 *   the worker (marked + marked-highlight + hljs) without forcing every
 *   consumer to wire it up, K22 adds this opt-in composable.
 *
 *   The bundled worker (`workers/markdownHljs.worker.ts`) ships ~30 KB of
 *   marked + 6 hljs languages. It's pulled in via Vite's `?worker` import
 *   pattern so it lives in its own split chunk and only loads when the host
 *   actually calls `useHljsMarkdownWorker()`.
 *
 * Usage:
 *
 * ```ts
 * import { useHljsMarkdownWorker } from '@ai-assistant/vue';
 * import { Marked } from 'marked';
 *
 * const sync = (md: string) => new Marked({ gfm: true, breaks: true }).parse(md, { async: false }) as string;
 * const worker = useHljsMarkdownWorker({ syncRenderer: sync });
 *
 * const html = await worker.render(longMarkdown);
 * ```
 *
 * Testing:
 *   Pass `workerFactory` to inject a stub Worker (mirrors the test pattern of
 *   {@link useMarkdownWorker.spec.ts}).
 */

import { useMarkdownWorker, type UseMarkdownWorkerOptions } from './useMarkdownWorker';
/* The ?worker query tells Vite to compile this module as a Worker entry and
 * produce a constructor that returns a real Worker. The default cast keeps the
 * type checker happy when Vite types are not loaded (e.g. when ts-checking the
 * library outside of a Vite build). */
import MarkdownHljsWorker from '../workers/markdownHljs.worker.ts?worker';

export type UseHljsMarkdownWorkerOptions = Omit<UseMarkdownWorkerOptions, 'workerFactory'> & {
  /** Override the bundled worker (defaults to the K22 hljs worker). */
  workerFactory?: () => Worker;
};

/**
 * Construct a {@link useMarkdownWorker} instance whose worker bundles
 * marked + marked-highlight + hljs (6 core languages: js/ts/json/py/bash/xml).
 *
 * @param opts - same as {@link UseMarkdownWorkerOptions}; the `workerFactory`
 *   defaults to the bundled hljs worker.
 */
export function useHljsMarkdownWorker(opts: UseHljsMarkdownWorkerOptions) {
  const factory =
    opts.workerFactory ??
    (() => {
      try {
        return new (MarkdownHljsWorker as new () => Worker)();
      } catch (e) {
        throw new Error(
          'Failed to construct hljs Markdown worker: ' +
            (e instanceof Error ? e.message : String(e)),
        );
      }
    });
  return useMarkdownWorker({ ...opts, workerFactory: factory });
}
