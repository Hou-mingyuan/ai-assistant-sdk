import { ref } from 'vue';
import type { Ref, ComputedRef } from 'vue';

export interface UseImagePasteAndDropMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: number;
}

export interface UseImagePasteAndDropDeps<TMessage extends UseImagePasteAndDropMessage> {
  /** 当前是否正在加载（流式生成中），加载时禁用拖拽与粘贴。 */
  loading: Ref<boolean>;
  /** 主消息列表，超大图错误会以 assistant 消息形式追加到此处。 */
  messages: Ref<TMessage[]>;
  /** i18n 中错误信息前缀（如 `Error` / `错误`），用于"超过 5MB 限制"提示。 */
  errorPrefix: ComputedRef<string> | Ref<string>;
  /** 收到非图片文件时的处理函数（通常是上传到 /file/summarize 或 /file/translate）。 */
  processFileUpload: (file: File) => Promise<void> | void;
  /** 单张图片字节上限，默认 5 MiB；超过会被拒绝并提示。 */
  maxImageBytes?: number;
  /** 用于生成缩略图时的最长边像素值，默认 80。 */
  thumbnailMaxDim?: number;
}

/**
 * 把"图片粘贴 + 文件拖拽 + 待发送图片缩略图"这一组逻辑从主组件抽离，便于单测与后续优化。
 *
 * 责任范围：
 *   - 维护 `dragActive` / `pendingImageData` / `pendingImageThumb` 三个 UI 状态
 *   - 处理 dragover / dragenter / dragleave / drop 事件并按文件类型分流（图片走本地 dataURL，其它走 deps.processFileUpload）
 *   - 处理粘贴板中的图片（Vision 用例）
 *   - 把图片转换为 dataURL 与最长边 ≤ 80px 的 PNG 缩略图
 *
 * 不负责：
 *   - 真正发送图片到服务端（仍由调用方在 send() 流程中读 pendingImageData 拼到请求体）
 *   - 处理多文件批量上传（仅取 dataTransfer.files[0]）
 *
 * 行为与拆分前完全一致，包括 5 MiB 上限、缩略图压缩参数 (0.7) 和错误消息文案。
 */
export function useImagePasteAndDrop<TMessage extends UseImagePasteAndDropMessage>(
  deps: UseImagePasteAndDropDeps<TMessage>,
) {
  const dragActive = ref(false);
  let dragCounter = 0;

  const pendingImageData = ref<string | null>(null);
  const pendingImageThumb = ref<string | null>(null);

  const maxImageBytes = deps.maxImageBytes ?? 5 * 1024 * 1024;
  const thumbnailMaxDim = deps.thumbnailMaxDim ?? 80;

  function onBodyDragOver(e: DragEvent) {
    if (deps.loading.value) return;
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
  }

  function onBodyDragEnter(_e: DragEvent) {
    if (deps.loading.value) return;
    dragCounter++;
    dragActive.value = true;
  }

  function onBodyDragLeave(_e: DragEvent) {
    dragCounter--;
    if (dragCounter <= 0) {
      dragCounter = 0;
      dragActive.value = false;
    }
  }

  function onBodyDrop(e: DragEvent) {
    dragCounter = 0;
    dragActive.value = false;
    if (deps.loading.value) return;
    const file = e.dataTransfer?.files?.[0];
    if (!file) return;
    if (file.type.startsWith('image/')) {
      readFileAsDataUrl(file);
    } else {
      void deps.processFileUpload(file);
    }
  }

  function onPasteImage(e: ClipboardEvent) {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) readFileAsDataUrl(file);
        return;
      }
    }
  }

  function readFileAsDataUrl(file: File) {
    if (file.size > maxImageBytes) {
      deps.messages.value.push({
        role: 'assistant',
        content: `${deps.errorPrefix.value}: Image exceeds 5MB limit`,
        timestamp: Date.now(),
      } as TMessage);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      pendingImageData.value = dataUrl;
      const canvas = document.createElement('canvas');
      const img = new Image();
      img.onload = () => {
        let w = img.width;
        let h = img.height;
        if (w > thumbnailMaxDim || h > thumbnailMaxDim) {
          const scale = thumbnailMaxDim / Math.max(w, h);
          w = Math.round(w * scale);
          h = Math.round(h * scale);
        }
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
        pendingImageThumb.value = canvas.toDataURL('image/png', 0.7);
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  }

  function clearPendingImage() {
    pendingImageData.value = null;
    pendingImageThumb.value = null;
  }

  return {
    dragActive,
    pendingImageData,
    pendingImageThumb,
    onBodyDragOver,
    onBodyDragEnter,
    onBodyDragLeave,
    onBodyDrop,
    onPasteImage,
    readFileAsDataUrl,
    clearPendingImage,
  };
}
