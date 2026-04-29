import { ref } from 'vue';

/** 服务端导出：忙状态 + 简短 Toast */
export function useExportUi() {
  const exportServerBusy = ref(false);
  const exportToastText = ref('');
  let exportToastClearTimer: ReturnType<typeof setTimeout> | null = null;

  function setExportToast(msg: string, clearAfterMs: number) {
    if (exportToastClearTimer != null) {
      clearTimeout(exportToastClearTimer);
      exportToastClearTimer = null;
    }
    exportToastText.value = msg;
    if (clearAfterMs > 0) {
      exportToastClearTimer = setTimeout(() => {
        exportToastText.value = '';
        exportToastClearTimer = null;
      }, clearAfterMs);
    }
  }

  function disposeExportToast() {
    if (exportToastClearTimer != null) {
      clearTimeout(exportToastClearTimer);
      exportToastClearTimer = null;
    }
  }

  return {
    exportServerBusy,
    exportToastText,
    setExportToast,
    disposeExportToast,
  };
}
