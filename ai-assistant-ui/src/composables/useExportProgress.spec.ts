import { computed, ref } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useExportProgress } from './useExportProgress';
import type { I18nMessages } from '../utils/i18n';

function tStub(): I18nMessages {
  return {
    exportPreparing: 'Preparing export…',
    exportReceiving: 'Receiving file…',
    exportStartingDownload: 'Starting download…',
    exportDownloadStarted: 'Download started',
  } as unknown as I18nMessages;
}

function harness() {
  const busy = ref(false);
  const setExportToast = vi.fn();
  const reportError = vi.fn();
  const t = computed(() => tStub());
  const { runExport, isBusy } = useExportProgress({
    exportServerBusy: busy,
    setExportToast,
    reportError,
    t,
  });
  return { busy, setExportToast, reportError, runExport, isBusy };
}

describe('useExportProgress', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('flips busy true → false around a successful run and emits the four-phase toast lifecycle', async () => {
    const h = harness();
    let busyDuringRun = false;
    await h.runExport({
      errorSource: 'unit',
      run: (onPhase) => {
        busyDuringRun = h.isBusy();
        onPhase('response');
        onPhase('download');
        return Promise.resolve({ ok: true });
      },
    });
    expect(busyDuringRun).toBe(true);
    expect(h.busy.value).toBe(false);
    expect(h.setExportToast.mock.calls).toEqual([
      ['Preparing export…', 0],
      ['Receiving file…', 0],
      ['Starting download…', 0],
      ['Download started', 3200],
    ]);
    expect(h.reportError).not.toHaveBeenCalled();
  });

  it('reports typed failure and clears toast without throwing', async () => {
    const h = harness();
    await h.runExport({
      errorSource: 'export-server',
      run: () => Promise.resolve({ ok: false, error: 'HTTP 503 busy' }),
    });
    expect(h.busy.value).toBe(false);
    expect(h.reportError).toHaveBeenCalledWith('export-server', 'HTTP 503 busy');
    const lastToast = h.setExportToast.mock.calls.at(-1);
    expect(lastToast).toEqual(['', 0]);
  });

  it('catches thrown errors, reports them and releases busy', async () => {
    const h = harness();
    await h.runExport({
      errorSource: 'batch-export-server',
      run: () => Promise.reject(new Error('network down')),
    });
    expect(h.busy.value).toBe(false);
    expect(h.reportError).toHaveBeenCalledWith('batch-export-server', 'network down');
    expect(h.setExportToast.mock.calls.at(-1)).toEqual(['', 0]);
  });

  it('short-circuits when already busy — does not invoke run nor toggle toast', async () => {
    const h = harness();
    h.busy.value = true;
    const run = vi.fn();
    await h.runExport({ errorSource: 'unit', run });
    expect(run).not.toHaveBeenCalled();
    expect(h.setExportToast).not.toHaveBeenCalled();
    expect(h.busy.value).toBe(true);
  });

  it('ignores unknown phases passed by run() (forward compatible)', async () => {
    const h = harness();
    await h.runExport({
      errorSource: 'unit',
      run: (onPhase) => {
        // @ts-expect-error - intentionally pushing an unsupported phase
        onPhase('mystery-phase');
        return Promise.resolve({ ok: true });
      },
    });
    expect(h.setExportToast.mock.calls).toEqual([
      ['Preparing export…', 0],
      ['Download started', 3200],
    ]);
  });

  it('keeps busy=false after a non-Error throw (string)', async () => {
    const h = harness();
    await h.runExport({
      errorSource: 'unit',
      run: () => Promise.reject('boom-string'),
    });
    expect(h.busy.value).toBe(false);
    expect(h.reportError).toHaveBeenCalledWith('unit', 'boom-string');
  });
});
