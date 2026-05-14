import { describe, expect, it } from 'vitest';

import { isScreenCaptureSupported, matchesScreenCaptureShortcut } from './useScreenCapture';

describe('matchesScreenCaptureShortcut', () => {
  it('matches Ctrl/Meta + Shift + I without Alt', () => {
    expect(
      matchesScreenCaptureShortcut(keyEvent({ key: 'i', ctrlKey: true, shiftKey: true })),
    ).toBe(true);
    expect(
      matchesScreenCaptureShortcut(keyEvent({ key: 'I', metaKey: true, shiftKey: true })),
    ).toBe(true);
  });

  it('rejects conflicting or incomplete keyboard chords', () => {
    expect(
      matchesScreenCaptureShortcut(keyEvent({ key: 's', ctrlKey: true, shiftKey: true })),
    ).toBe(false);
    expect(matchesScreenCaptureShortcut(keyEvent({ key: 'i', ctrlKey: true }))).toBe(false);
    expect(
      matchesScreenCaptureShortcut(
        keyEvent({ key: 'i', ctrlKey: true, shiftKey: true, altKey: true }),
      ),
    ).toBe(false);
  });
});

describe('isScreenCaptureSupported', () => {
  it('checks for getDisplayMedia support', () => {
    expect(isScreenCaptureSupported({ getDisplayMedia: async () => ({}) as MediaStream })).toBe(
      true,
    );
    expect(isScreenCaptureSupported({})).toBe(false);
    expect(isScreenCaptureSupported(undefined)).toBe(false);
  });
});

function keyEvent(init: Partial<KeyboardEvent>): KeyboardEvent {
  return init as KeyboardEvent;
}
