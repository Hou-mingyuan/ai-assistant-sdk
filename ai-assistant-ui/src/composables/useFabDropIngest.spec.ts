import { describe, it, expect, vi } from 'vitest';
import { ref } from 'vue';
import { useFabDropIngest } from './useFabDropIngest';

function makeDragEvent(opts: { types?: string[]; files?: File[] }): DragEvent {
  const types = opts.types ?? (opts.files ? ['Files'] : []);
  const files = opts.files ?? [];
  const dt = {
    types,
    files,
    dropEffect: '',
  } as unknown as DataTransfer;
  return { dataTransfer: dt, preventDefault: () => {} } as unknown as DragEvent;
}

function makeFile(name: string, type = 'text/plain'): File {
  return new File(['x'], name, { type });
}

describe('useFabDropIngest', () => {
  it('toggles dropActive on dragEnter/Leave with file payload', () => {
    const onFiles = vi.fn();
    const d = useFabDropIngest({ onFiles });
    d.onFabDragEnter(makeDragEvent({ files: [makeFile('a.txt')] }));
    expect(d.dropActive.value).toBe(true);
    d.onFabDragLeave(makeDragEvent({}));
    expect(d.dropActive.value).toBe(false);
  });

  it('counter resets on drop and forwards files', () => {
    const onFiles = vi.fn();
    const d = useFabDropIngest({ onFiles });
    const f = makeFile('a.txt');
    d.onFabDragEnter(makeDragEvent({ files: [f] }));
    d.onFabDragEnter(makeDragEvent({ files: [f] }));
    expect(d.dropActive.value).toBe(true);
    d.onFabDrop(makeDragEvent({ files: [f] }));
    expect(d.dropActive.value).toBe(false);
    expect(onFiles).toHaveBeenCalledTimes(1);
    expect(onFiles.mock.calls[0]![0]).toEqual([f]);
  });

  it('respects rejectMimePrefix (filters out image/* files)', () => {
    const onFiles = vi.fn();
    const d = useFabDropIngest({ onFiles, rejectMimePrefix: ['image/'] });
    const img = makeFile('a.png', 'image/png');
    const pdf = makeFile('b.pdf', 'application/pdf');
    d.onFabDrop(makeDragEvent({ files: [img, pdf] }));
    expect(onFiles).toHaveBeenCalledTimes(1);
    expect(onFiles.mock.calls[0]![0]).toEqual([pdf]);
  });

  it('does not call onFiles when all files are rejected', () => {
    const onFiles = vi.fn();
    const d = useFabDropIngest({ onFiles, rejectMimePrefix: ['image/'] });
    d.onFabDrop(makeDragEvent({ files: [makeFile('a.png', 'image/png')] }));
    expect(onFiles).not.toHaveBeenCalled();
  });

  it('ignores non-file drags (text-only / URL)', () => {
    const onFiles = vi.fn();
    const d = useFabDropIngest({ onFiles });
    d.onFabDragEnter(makeDragEvent({ types: ['text/plain'] }));
    expect(d.dropActive.value).toBe(false);
  });

  it('enabled=false acts as a master switch', () => {
    const enabled = ref(false);
    const onFiles = vi.fn();
    const d = useFabDropIngest({ enabled, onFiles });
    d.onFabDragEnter(makeDragEvent({ files: [makeFile('a.txt')] }));
    expect(d.dropActive.value).toBe(false);
    d.onFabDrop(makeDragEvent({ files: [makeFile('a.txt')] }));
    expect(onFiles).not.toHaveBeenCalled();
    enabled.value = true;
    d.onFabDrop(makeDragEvent({ files: [makeFile('a.txt')] }));
    expect(onFiles).toHaveBeenCalledTimes(1);
  });

  it('sets dropEffect to copy on dragOver', () => {
    const d = useFabDropIngest({ onFiles: () => {} });
    const e = makeDragEvent({ files: [makeFile('a.txt')] });
    d.onFabDragOver(e);
    expect(e.dataTransfer?.dropEffect).toBe('copy');
  });

  it('handles empty drop without onFiles call', () => {
    const onFiles = vi.fn();
    const d = useFabDropIngest({ onFiles });
    d.onFabDrop(makeDragEvent({}));
    expect(onFiles).not.toHaveBeenCalled();
  });
});
