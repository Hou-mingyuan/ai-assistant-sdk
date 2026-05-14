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
  /** 超过该文件大小时尝试压缩，默认 4 MiB。 */
  downscaleThresholdBytes?: number;
  /** 压缩大图时的最长边像素值，默认 2048。 */
  downscaleMaxDim?: number;
  /** 可等待发送的最大图片数量，默认 8。 */
  maxPendingImages?: number;
  /** 用于生成缩略图时的最长边像素值，默认 80。 */
  thumbnailMaxDim?: number;
}

export function computeContainSize(width: number, height: number, maxDim: number) {
  const longEdge = Math.max(width, height);
  if (longEdge <= maxDim) return { width, height };
  const scale = maxDim / longEdge;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export function shouldDownscaleImage(
  fileSize: number,
  width: number,
  height: number,
  thresholdBytes: number,
  maxDim: number,
) {
  return fileSize > thresholdBytes && Math.max(width, height) > maxDim;
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

  const pendingImageDataList = ref<string[]>([]);
  const pendingImageThumbs = ref<string[]>([]);

  const maxImageBytes = deps.maxImageBytes ?? 5 * 1024 * 1024;
  const downscaleThresholdBytes = deps.downscaleThresholdBytes ?? 4 * 1024 * 1024;
  const downscaleMaxDim = deps.downscaleMaxDim ?? 2048;
  const maxPendingImages = deps.maxPendingImages ?? 8;
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
    const files = Array.from(e.dataTransfer?.files ?? []);
    if (!files.length) return;
    for (const file of files) {
      if (file.type.startsWith('image/')) {
        readFileAsDataUrl(file);
      } else {
        void deps.processFileUpload(file);
      }
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
    const reader = new FileReader();
    reader.onload = () => {
      void setPendingImageDataUrl(reader.result as string, file.size).catch(() => {
        deps.messages.value.push({
          role: 'assistant',
          content: `${deps.errorPrefix.value}: Failed to read image`,
          timestamp: Date.now(),
        } as TMessage);
      });
    };
    reader.readAsDataURL(file);
  }

  async function setPendingImageDataUrl(
    dataUrl: string,
    sourceSize = estimateDataUrlBytes(dataUrl),
  ) {
    const prepared = await preparePendingImage(dataUrl, sourceSize);
    if (!prepared) return;
    pendingImageDataList.value = [...pendingImageDataList.value, prepared.dataUrl].slice(
      -maxPendingImages,
    );
    pendingImageThumbs.value = [...pendingImageThumbs.value, prepared.thumb].slice(
      -maxPendingImages,
    );
  }

  async function replacePendingImageDataUrl(
    index: number,
    dataUrl: string,
    sourceSize = estimateDataUrlBytes(dataUrl),
  ) {
    if (index < 0 || index >= pendingImageDataList.value.length) return;
    const prepared = await preparePendingImage(dataUrl, sourceSize);
    if (!prepared) return;
    pendingImageDataList.value = pendingImageDataList.value.map((item, i) =>
      i === index ? prepared.dataUrl : item,
    );
    pendingImageThumbs.value = pendingImageThumbs.value.map((item, i) =>
      i === index ? prepared.thumb : item,
    );
  }

  async function preparePendingImage(dataUrl: string, sourceSize: number) {
    const img = await loadImage(dataUrl);
    let normalizedDataUrl = dataUrl;
    if (
      shouldDownscaleImage(
        sourceSize,
        img.width,
        img.height,
        downscaleThresholdBytes,
        downscaleMaxDim,
      )
    ) {
      const size = computeContainSize(img.width, img.height, downscaleMaxDim);
      normalizedDataUrl = renderImageDataUrl(img, size.width, size.height, 'image/jpeg', 0.85);
    }
    if (estimateDataUrlBytes(normalizedDataUrl) > maxImageBytes) {
      deps.messages.value.push({
        role: 'assistant',
        content: `${deps.errorPrefix.value}: Image exceeds 5MB limit`,
        timestamp: Date.now(),
      } as TMessage);
      return null;
    }
    const thumbSize = computeContainSize(img.width, img.height, thumbnailMaxDim);
    const thumb = renderImageDataUrl(img, thumbSize.width, thumbSize.height, 'image/png', 0.7);
    return { dataUrl: normalizedDataUrl, thumb };
  }

  function loadImage(dataUrl: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = dataUrl;
    });
  }

  function renderImageDataUrl(
    img: CanvasImageSource,
    width: number,
    height: number,
    type: string,
    quality: number,
  ) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
    return canvas.toDataURL(type, quality);
  }

  function estimateDataUrlBytes(dataUrl: string) {
    const comma = dataUrl.indexOf(',');
    const payload = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
    return Math.ceil((payload.length * 3) / 4);
  }

  function clearPendingImage() {
    pendingImageDataList.value = [];
    pendingImageThumbs.value = [];
  }

  function removePendingImage(index: number) {
    if (index < 0 || index >= pendingImageDataList.value.length) return;
    pendingImageDataList.value = pendingImageDataList.value.filter((_, i) => i !== index);
    pendingImageThumbs.value = pendingImageThumbs.value.filter((_, i) => i !== index);
  }

  return {
    dragActive,
    pendingImageDataList,
    pendingImageThumbs,
    onBodyDragOver,
    onBodyDragEnter,
    onBodyDragLeave,
    onBodyDrop,
    onPasteImage,
    readFileAsDataUrl,
    setPendingImageDataUrl,
    replacePendingImageDataUrl,
    clearPendingImage,
    removePendingImage,
  };
}
