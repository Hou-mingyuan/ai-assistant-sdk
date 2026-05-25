import { ref } from 'vue';
import { describe, expect, it, vi } from 'vitest';

import { useImageAnnotationState } from './useImageAnnotationState';

describe('useImageAnnotationState', () => {
  it('opens a pending image for annotation by index', () => {
    const annotation = useImageAnnotationState({
      pendingImageDataList: ref(['data:image/png;base64,one']),
      setPendingImageDataUrl: vi.fn(),
      replacePendingImageDataUrl: vi.fn(),
    });

    annotation.openAnnotationForPendingImage(0);

    expect(annotation.annotationOpen.value).toBe(true);
    expect(annotation.annotationImageSrc.value).toBe('data:image/png;base64,one');
    expect(annotation.annotationReplaceIndex.value).toBe(0);
  });

  it('ignores empty annotation sources', () => {
    const annotation = useImageAnnotationState({
      pendingImageDataList: ref([]),
      setPendingImageDataUrl: vi.fn(),
      replacePendingImageDataUrl: vi.fn(),
    });

    annotation.openAnnotationDialog('', null);

    expect(annotation.annotationOpen.value).toBe(false);
    expect(annotation.annotationImageSrc.value).toBe('');
    expect(annotation.annotationReplaceIndex.value).toBeNull();
  });

  it('saves a new annotated image and closes the dialog', async () => {
    const setPendingImageDataUrl = vi.fn().mockResolvedValue(undefined);
    const replacePendingImageDataUrl = vi.fn();
    const annotation = useImageAnnotationState({
      pendingImageDataList: ref([]),
      setPendingImageDataUrl,
      replacePendingImageDataUrl,
    });
    annotation.openAnnotationDialog('screen-data-url', null);

    await annotation.onAnnotationSave('annotated-data-url');

    expect(setPendingImageDataUrl).toHaveBeenCalledWith('annotated-data-url');
    expect(replacePendingImageDataUrl).not.toHaveBeenCalled();
    expect(annotation.annotationOpen.value).toBe(false);
    expect(annotation.annotationImageSrc.value).toBe('');
    expect(annotation.annotationReplaceIndex.value).toBeNull();
  });

  it('replaces an existing pending image when a replace index is active', async () => {
    const setPendingImageDataUrl = vi.fn();
    const replacePendingImageDataUrl = vi.fn().mockResolvedValue(undefined);
    const annotation = useImageAnnotationState({
      pendingImageDataList: ref(['old']),
      setPendingImageDataUrl,
      replacePendingImageDataUrl,
    });
    annotation.openAnnotationDialog('old', 0);

    await annotation.onAnnotationSave('new');

    expect(replacePendingImageDataUrl).toHaveBeenCalledWith(0, 'new');
    expect(setPendingImageDataUrl).not.toHaveBeenCalled();
    expect(annotation.annotationOpen.value).toBe(false);
  });
});
