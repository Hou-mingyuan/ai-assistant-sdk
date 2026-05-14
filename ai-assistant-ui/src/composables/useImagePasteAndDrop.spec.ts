import { describe, expect, it } from 'vitest';

import { computeContainSize, shouldDownscaleImage } from './useImagePasteAndDrop';

describe('computeContainSize', () => {
  it('keeps images within the target long edge while preserving aspect ratio', () => {
    expect(computeContainSize(4096, 2048, 2048)).toEqual({ width: 2048, height: 1024 });
    expect(computeContainSize(1200, 2400, 1200)).toEqual({ width: 600, height: 1200 });
  });

  it('does not upscale small images', () => {
    expect(computeContainSize(800, 600, 2048)).toEqual({ width: 800, height: 600 });
  });
});

describe('shouldDownscaleImage', () => {
  it('downscales only large files whose dimensions exceed the target long edge', () => {
    expect(shouldDownscaleImage(4 * 1024 * 1024 + 1, 4096, 2160, 4 * 1024 * 1024, 2048)).toBe(true);
    expect(shouldDownscaleImage(4 * 1024 * 1024 - 1, 4096, 2160, 4 * 1024 * 1024, 2048)).toBe(
      false,
    );
    expect(shouldDownscaleImage(6 * 1024 * 1024, 1600, 1200, 4 * 1024 * 1024, 2048)).toBe(false);
  });
});
