import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Note on mocking:
 * `useMermaidRenderer` uses `import(/* @vite-ignore *\/ 'mermaid' as string)` to
 * dynamically load the optional peer. Vitest's `vi.mock` works on bare specifiers
 * even when wrapped by the @vite-ignore comment, so each test can swap the
 * mermaid module behaviour to drive the success / fallback paths.
 */

vi.mock('mermaid', () => {
  return {
    default: {
      initialize: vi.fn(),
      render: vi.fn(async (_id: string, src: string) => ({
        svg: `<svg data-src="${src.length}">rendered</svg>`,
      })),
    },
  };
});

import { useMermaidRenderer } from './useMermaidRenderer';

function placeholderEl(src: string): HTMLElement {
  const el = document.createElement('div');
  el.className = 'ai-mermaid-placeholder';
  el.setAttribute('data-mermaid-src', btoa(unescape(encodeURIComponent(src))));
  el.textContent = src;
  return el;
}

describe('useMermaidRenderer', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  it('replaces each placeholder with the rendered SVG and tags rendered=true', async () => {
    const root = document.createElement('div');
    root.appendChild(placeholderEl('flowchart TD\n  A --> B'));
    root.appendChild(placeholderEl('graph LR\n  X --> Y'));
    document.body.appendChild(root);
    const r = useMermaidRenderer();
    await r.renderInside(root);
    const placeholders = root.querySelectorAll('.ai-mermaid-placeholder');
    expect(placeholders).toHaveLength(2);
    for (const el of Array.from(placeholders)) {
      expect((el as HTMLElement).dataset.mermaidRendered).toBe('true');
      expect(el.innerHTML).toContain('<svg');
    }
  });

  it('skips already-rendered placeholders unless force is true', async () => {
    const root = document.createElement('div');
    const el = placeholderEl('graph TD\n  A --> B');
    el.dataset.mermaidRendered = 'true';
    el.innerHTML = '<svg data-marker="prev"></svg>';
    root.appendChild(el);
    document.body.appendChild(root);
    const r = useMermaidRenderer();
    await r.renderInside(root);
    expect(el.innerHTML).toContain('data-marker="prev"');
    await r.renderInside(root, { force: true });
    expect(el.innerHTML).not.toContain('prev');
    expect(el.innerHTML).toContain('rendered');
  });

  it('no-ops gracefully when the root has no placeholders', async () => {
    const root = document.createElement('div');
    root.innerHTML = '<p>just text</p>';
    const r = useMermaidRenderer();
    await expect(r.renderInside(root)).resolves.toBeUndefined();
    expect(root.innerHTML).toBe('<p>just text</p>');
  });

  it('no-ops when root is null / undefined', async () => {
    const r = useMermaidRenderer();
    await expect(r.renderInside(null)).resolves.toBeUndefined();
    await expect(r.renderInside(undefined)).resolves.toBeUndefined();
  });
});

describe('useMermaidRenderer fallback when mermaid throws on render', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.resetModules();
    vi.doMock('mermaid', () => ({
      default: {
        initialize: vi.fn(),
        render: vi.fn(async () => {
          throw new Error('mermaid parse failure');
        }),
      },
    }));
  });

  it('marks placeholder as rendered=error and shows the source + message', async () => {
    /* @vitest-environment jsdom */
    const { useMermaidRenderer: useRendererFresh } = await import('./useMermaidRenderer');
    const root = document.createElement('div');
    root.appendChild(placeholderEl('bad syntax !@#'));
    document.body.appendChild(root);
    const r = useRendererFresh();
    await r.renderInside(root);
    const el = root.querySelector('.ai-mermaid-placeholder') as HTMLElement;
    expect(el.dataset.mermaidRendered).toBe('error');
    expect(el.innerHTML).toContain('Mermaid render error');
    expect(el.innerHTML).toContain('bad syntax');
  });
});
