/**
 * useFabDropIngest
 * ----------------
 * 把 HTML5 文件拖拽事件挂到 AI 助手悬浮球 (FAB) 上，让用户能 drag-and-drop
 * 文件直接 ingest 到知识库 / 自定义后端，无需先打开主面板。
 *
 * 为什么独立成 composable：
 * - 与 useImagePasteAndDrop 解耦：那个是「面板打开后 body 上的图片粘贴 + 文件
 *   拖拽走 translate/summarize」流程，与 K38 关注的「闭合状态下 FAB 是 RAG
 *   入口」是两套 UX，不应该混在一个 composable 里。
 * - 纯回调驱动：本 composable 不知道也不关心 KB 的存在；调用方决定 dropped
 *   files 怎么处理（KB ingest / S3 上传 / 任意业务路由）。
 *
 * 用法（在父组件 setup 中）：
 *
 *   const drop = useFabDropIngest({
 *     enabled: computed(() => !isOpen.value),  // 只在 FAB 显示时启用
 *     rejectMimePrefix: ['image/'],            // 图片走另一条路（K38: Vision）
 *     onFiles: (files) => files.forEach(ingest),
 *   });
 *
 *   <button class="ai-fab"
 *     :class="{ 'ai-fab-drop-active': drop.dropActive.value }"
 *     @dragover.prevent="drop.onFabDragOver"
 *     @dragenter.prevent="drop.onFabDragEnter"
 *     @dragleave.prevent="drop.onFabDragLeave"
 *     @drop.prevent="drop.onFabDrop" />
 *
 * 进 / 离区检测使用 dragCounter 计数，避免子元素 enter/leave 抖动出现的「黑
 * 屏闪烁」 — 这是浏览器 DnD 的经典 gotcha。
 */
import { ref } from 'vue';
import type { Ref } from 'vue';

export interface UseFabDropIngestOptions {
  /**
   * Reactive 启用开关；false 时所有事件 no-op，dropActive 保持 false。
   * 典型用法：computed(() => !panelOpen.value)，只在 FAB 可见时启用。
   * 不传则永远启用。
   */
  enabled?: Ref<boolean>;
  /**
   * 触发 ingest 的回调。接收 dataTransfer 里的所有文件（已按 rejectMimePrefix
   * 过滤）。调用方按需做 KB 入库、上传、加密等。
   */
  onFiles: (files: File[]) => void;
  /**
   * 命中任一前缀的文件类型会被丢弃。常见值 `['image/']` 让图片走 Vision /
   * pendingImage 通道而不是 KB ingest。
   * 空 / 不传则全收。
   */
  rejectMimePrefix?: string[];
}

export interface UseFabDropIngestReturn {
  /** true 当文件被拖到 FAB 上方但还未释放；用于绑定视觉高亮 class。 */
  dropActive: Ref<boolean>;
  onFabDragEnter: (e: DragEvent) => void;
  onFabDragOver: (e: DragEvent) => void;
  onFabDragLeave: (e: DragEvent) => void;
  onFabDrop: (e: DragEvent) => void;
}

function hasFiles(dt: DataTransfer | null): boolean {
  if (!dt) return false;
  const types = dt.types;
  if (!types) return false;
  for (let i = 0; i < types.length; i++) {
    if (types[i] === 'Files') return true;
  }
  return false;
}

export function useFabDropIngest(opts: UseFabDropIngestOptions): UseFabDropIngestReturn {
  const dropActive = ref(false);
  let dragCounter = 0;

  function isEnabled(): boolean {
    return opts.enabled ? opts.enabled.value !== false : true;
  }

  function reject(file: File): boolean {
    if (!opts.rejectMimePrefix?.length) return false;
    for (const prefix of opts.rejectMimePrefix) {
      if (file.type && file.type.startsWith(prefix)) return true;
    }
    return false;
  }

  function onFabDragEnter(e: DragEvent) {
    if (!isEnabled()) return;
    if (!hasFiles(e.dataTransfer)) return;
    dragCounter++;
    dropActive.value = true;
  }

  function onFabDragOver(e: DragEvent) {
    if (!isEnabled()) return;
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
  }

  function onFabDragLeave(_e: DragEvent) {
    if (!isEnabled()) {
      dragCounter = 0;
      dropActive.value = false;
      return;
    }
    if (dragCounter > 0) dragCounter--;
    if (dragCounter <= 0) {
      dragCounter = 0;
      dropActive.value = false;
    }
  }

  function onFabDrop(e: DragEvent) {
    dragCounter = 0;
    dropActive.value = false;
    if (!isEnabled()) return;
    const list = e.dataTransfer?.files ?? null;
    if (!list || list.length === 0) return;
    const accepted: File[] = [];
    for (let i = 0; i < list.length; i++) {
      const f = list[i];
      if (f && !reject(f)) accepted.push(f);
    }
    if (accepted.length === 0) return;
    opts.onFiles(accepted);
  }

  return {
    dropActive,
    onFabDragEnter,
    onFabDragOver,
    onFabDragLeave,
    onFabDrop,
  };
}
