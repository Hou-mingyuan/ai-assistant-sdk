import { ref, type Ref } from 'vue';

interface UseImageAnnotationStateDeps {
  pendingImageDataList: Ref<string[]>;
  setPendingImageDataUrl: (dataUrl: string) => Promise<void>;
  replacePendingImageDataUrl: (index: number, dataUrl: string) => Promise<void>;
}

export function useImageAnnotationState(deps: UseImageAnnotationStateDeps) {
  const annotationOpen = ref(false);
  const annotationImageSrc = ref('');
  const annotationReplaceIndex = ref<number | null>(null);

  function openAnnotationDialog(src: string | undefined, replaceIndex: number | null) {
    if (!src) return;
    annotationImageSrc.value = src;
    annotationReplaceIndex.value = replaceIndex;
    annotationOpen.value = true;
  }

  function openAnnotationForPendingImage(index: number) {
    openAnnotationDialog(deps.pendingImageDataList.value[index], index);
  }

  function closeAnnotationDialog() {
    annotationOpen.value = false;
    annotationImageSrc.value = '';
    annotationReplaceIndex.value = null;
  }

  async function onAnnotationSave(dataUrl: string) {
    const replaceIndex = annotationReplaceIndex.value;
    if (replaceIndex == null) await deps.setPendingImageDataUrl(dataUrl);
    else await deps.replacePendingImageDataUrl(replaceIndex, dataUrl);
    closeAnnotationDialog();
  }

  return {
    annotationOpen,
    annotationImageSrc,
    annotationReplaceIndex,
    openAnnotationDialog,
    openAnnotationForPendingImage,
    closeAnnotationDialog,
    onAnnotationSave,
  };
}
