import { describe, expect, it } from 'vitest';
import { defaultPanelHeightForViewport } from './usePanelGeometry';

describe('defaultPanelHeightForViewport', () => {
  it('keeps the compact desktop default', () => {
    expect(defaultPanelHeightForViewport(1440, 900)).toBe(520);
    expect(defaultPanelHeightForViewport(821, 1024)).toBe(520);
  });

  it('gives tablet layouts enough room for touch controls and messages', () => {
    expect(defaultPanelHeightForViewport(768, 1024)).toBe(680);
    expect(defaultPanelHeightForViewport(601, 900)).toBe(680);
    expect(defaultPanelHeightForViewport(820, 900)).toBe(680);
  });

  it('still clamps to the available viewport height', () => {
    expect(defaultPanelHeightForViewport(768, 640)).toBe(560);
  });
});
