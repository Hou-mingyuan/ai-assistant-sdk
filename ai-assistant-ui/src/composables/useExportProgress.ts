import type { ComputedRef, Ref } from 'vue';
import type { ExportProgressPhase } from '../utils/api';
import type { I18nMessages } from '../utils/i18n';

interface ProgressDeps {
  exportServerBusy: Ref<boolean>;
  setExportToast: (text: string, ms: number) => void;
  reportError: (source: string, msg: string) => void;
  t: ComputedRef<I18nMessages>;
}

export interface ExportRunOptions {
  /** Error-reporting source tag forwarded to `reportError`. */
  errorSource: string;
  /**
   * Async work that performs the server export. The callback should call
   * `onPhase('response')` once the HTTP response arrives and `onPhase('download')`
   * when the browser download begins. Return `{ ok: true }` on success or
   * `{ ok: false, error }` on a typed failure; thrown errors are also caught.
   */
  run: (
    onPhase: (phase: ExportProgressPhase) => void,
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
}

/**
 * Centralised loading + toast state machine for server-side exports.
 *
 * K53.2: extracted from useExportActions. The previous implementation duplicated
 * the same 12-line `try { setToast(preparing); ... } catch { reportError } finally { busy=false }`
 * envelope in both `exportAssistantMessageServer` and `batchExportAllServer`.
 * Concentrating the lifecycle here lets `useExportActions` focus on payload
 * construction, and lets a future loading-overlay component subscribe to a
 * single source of truth for "an export is in flight".
 *
 * Phase mapping (matches historical UX 1:1):
 *  - on call:           toast = exportPreparing,        busy = true
 *  - onPhase('response')   toast = exportReceiving
 *  - onPhase('download')   toast = exportStartingDownload
 *  - success ({ok: true})   toast = exportDownloadStarted (auto-clear 3.2s)
 *  - failure / throw        toast cleared, reportError(source, msg)
 *  - finally                busy = false
 */
export function useExportProgress(deps: ProgressDeps) {
  function isBusy(): boolean {
    return deps.exportServerBusy.value;
  }

  async function runExport(opts: ExportRunOptions): Promise<void> {
    if (deps.exportServerBusy.value) return;
    deps.exportServerBusy.value = true;
    deps.setExportToast(deps.t.value.exportPreparing, 0);
    try {
      const onPhase = (phase: ExportProgressPhase) => {
        if (phase === 'response') {
          deps.setExportToast(deps.t.value.exportReceiving, 0);
        } else if (phase === 'download') {
          deps.setExportToast(deps.t.value.exportStartingDownload, 0);
        }
      };
      const result = await opts.run(onPhase);
      if (!result.ok) {
        deps.setExportToast('', 0);
        deps.reportError(opts.errorSource, result.error);
      } else {
        deps.setExportToast(deps.t.value.exportDownloadStarted, 3200);
      }
    } catch (e: unknown) {
      deps.setExportToast('', 0);
      deps.reportError(opts.errorSource, String((e as Error)?.message ?? e));
    } finally {
      deps.exportServerBusy.value = false;
    }
  }

  return { runExport, isBusy };
}
