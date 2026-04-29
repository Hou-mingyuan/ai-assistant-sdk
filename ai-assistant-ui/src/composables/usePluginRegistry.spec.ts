import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createApp, h } from 'vue';
import { usePluginRegistry, type AiPlugin } from './usePluginRegistry';

function makePlug(id: string, pos: AiPlugin['position'] = 'header'): AiPlugin {
  return { id, label: id, position: pos, action: vi.fn() };
}

describe('usePluginRegistry', () => {
  let app: ReturnType<typeof createApp>;
  let host: HTMLDivElement;

  beforeEach(() => {
    app = createApp({ render: () => h('div') });
    host = document.createElement('div');
    document.body.appendChild(host);
    app.mount(host);
  });

  afterEach(() => {
    app.unmount();
    host.remove();
  });

  it('registers and retrieves plugins', () => {
    app.runWithContext(() => {
      const { registerPlugin, getPlugins } = usePluginRegistry();
      registerPlugin(makePlug('a', 'header'));
      registerPlugin(makePlug('b', 'footer'));
      expect(getPlugins('header').map((p) => p.id)).toContain('a');
      expect(getPlugins('footer').map((p) => p.id)).toContain('b');
    });
  });

  it('replaces plugin with same id', () => {
    app.runWithContext(() => {
      const { registerPlugin, plugins } = usePluginRegistry();
      registerPlugin(makePlug('x'));
      const before = plugins.value.length;
      registerPlugin({ ...makePlug('x'), label: 'updated' });
      expect(plugins.value.length).toBe(before);
      expect(plugins.value.find((p) => p.id === 'x')!.label).toBe('updated');
    });
  });

  it('unregisters plugin', () => {
    app.runWithContext(() => {
      const { registerPlugin, unregisterPlugin, plugins } = usePluginRegistry();
      registerPlugin(makePlug('del'));
      unregisterPlugin('del');
      expect(plugins.value.find((p) => p.id === 'del')).toBeUndefined();
    });
  });
});
