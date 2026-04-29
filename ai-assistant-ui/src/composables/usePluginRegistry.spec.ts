/* eslint-disable vue/one-component-per-file */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createApp, h } from 'vue';
import { providePluginRegistry, usePluginRegistry, type AiPlugin } from './usePluginRegistry';

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
      registerPlugin(makePlug('c', 'context'));
      expect(getPlugins('header').map((p) => p.id)).toContain('a');
      expect(getPlugins('footer').map((p) => p.id)).toContain('b');
      expect(getPlugins('context').map((p) => p.id)).toContain('c');
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

  it('uses provided registry when available', () => {
    app.unmount();
    host.remove();
    host = document.createElement('div');
    document.body.appendChild(host);

    let providedPlugins: ReturnType<typeof providePluginRegistry> | undefined;
    let registry: ReturnType<typeof usePluginRegistry> | undefined;
    const Child = {
      setup() {
        registry = usePluginRegistry();
        registry.registerPlugin(makePlug('provided'));
        return () => h('span');
      },
    };
    app = createApp({
      setup() {
        providedPlugins = providePluginRegistry();
        return () => h(Child);
      },
    });
    app.mount(host);

    expect(registry!.plugins).toBe(providedPlugins);
    expect(providedPlugins!.value.map((p) => p.id)).toEqual(['provided']);
  });

  it('rejects plugins without an action function', () => {
    app.runWithContext(() => {
      const { registerPlugin } = usePluginRegistry();
      const invalidPlugin = { ...makePlug('invalid'), action: undefined } as unknown as AiPlugin;

      expect(() => registerPlugin(invalidPlugin)).toThrow(
        'Plugin "invalid" must have an action function',
      );
    });
  });

  it('keeps unregistering unknown plugin as a no-op', () => {
    app.runWithContext(() => {
      const { registerPlugin, unregisterPlugin, plugins } = usePluginRegistry();
      registerPlugin(makePlug('keep'));

      unregisterPlugin('missing');

      expect(plugins.value.map((p) => p.id)).toEqual(['keep']);
    });
  });
});
