import { mount, flushPromises } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App.vue';

const ColorThemeSwitcherStub = {
  template: '<div class="theme-stub" />',
  props: ['modelValue'],
  emits: ['update:modelValue'],
};

const AdminDemoPanelStub = {
  template: '<div class="admin-stub">Admin Console stub</div>',
};

const CommandPaletteStub = {
  template: '<div class="cmdk-stub" />',
  props: ['open', 'commands'],
  emits: ['update:open'],
};

function mockFetchSequence(responses: Array<{ ok?: boolean; status?: number; body: unknown }>) {
  let i = 0;
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      const r = responses[i++] ?? responses[responses.length - 1]!;
      return {
        ok: r.ok ?? true,
        status: r.status ?? 200,
        json: async () => r.body,
      };
    }),
  );
}

describe('Playground App', () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.pushState({}, '', '/');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('renders demo page with SSE stream phase chips', async () => {
    mockFetchSequence([{ body: { success: true, status: 'running' } }]);
    const wrapper = mount(App, {
      global: {
        stubs: {
          ColorThemeSwitcher: ColorThemeSwitcherStub,
          AdminDemoPanel: AdminDemoPanelStub,
          CommandPalette: CommandPaletteStub,
        },
      },
    });

    expect(wrapper.text()).toContain('AI Assistant 悬浮球演示');
    expect(wrapper.text()).toContain('SSE 流式体验路径');
    expect(wrapper.findAll('.stream-phase-chip')).toHaveLength(5);
    await flushPromises();
    expect(wrapper.find('.stream-status-row').exists()).toBe(true);
  });

  it('navigates to Admin Console tab', async () => {
    mockFetchSequence([{ body: { success: true, status: 'running' } }]);
    const wrapper = mount(App, {
      global: {
        stubs: {
          ColorThemeSwitcher: ColorThemeSwitcherStub,
          AdminDemoPanel: AdminDemoPanelStub,
          CommandPalette: CommandPaletteStub,
        },
      },
    });

    const adminBtn = wrapper.findAll('.page-nav-tab').find((b) => b.text().includes('Admin'));
    await adminBtn!.trigger('click');
    expect(wrapper.find('.admin-stub').exists()).toBe(true);
  });

  it('records ai-assistant-reaction custom events in the reaction log', async () => {
    mockFetchSequence([{ body: { success: true, status: 'running' } }]);
    const wrapper = mount(App, {
      global: {
        stubs: {
          ColorThemeSwitcher: ColorThemeSwitcherStub,
          AdminDemoPanel: AdminDemoPanelStub,
          CommandPalette: CommandPaletteStub,
        },
      },
    });

    window.dispatchEvent(
      new CustomEvent('ai-assistant-reaction', {
        detail: { messageIndex: 2, emoji: '👍', toggled: false },
      }),
    );
    await flushPromises();

    expect(wrapper.find('.reaction-log').exists()).toBe(true);
    expect(wrapper.text()).toContain('👍');
    expect(wrapper.text()).toContain('#2');
  });

  it('navigates to Form Auto-Fill tab and shows sample snippets', async () => {
    mockFetchSequence([{ body: { success: true, status: 'running' } }]);
    const wrapper = mount(App, {
      global: {
        stubs: {
          ColorThemeSwitcher: ColorThemeSwitcherStub,
          AdminDemoPanel: AdminDemoPanelStub,
          CommandPalette: CommandPaletteStub,
        },
      },
    });

    const formBtn = wrapper.findAll('.page-nav-tab').find((b) => b.text().includes('Form'));
    await formBtn!.trigger('click');
    expect(wrapper.text()).toContain('表单自动填充');
    expect(wrapper.findAll('.formfill-snippet').length).toBeGreaterThanOrEqual(3);
    expect(wrapper.find('[data-ai-fillable]').exists()).toBe(true);
  });

  it('clears reaction log when clear button is clicked', async () => {
    mockFetchSequence([{ body: { success: true, status: 'running' } }]);
    const wrapper = mount(App, {
      global: {
        stubs: {
          ColorThemeSwitcher: ColorThemeSwitcherStub,
          AdminDemoPanel: AdminDemoPanelStub,
          CommandPalette: CommandPaletteStub,
        },
      },
    });

    window.dispatchEvent(
      new CustomEvent('ai-assistant-reaction', {
        detail: { messageIndex: 0, emoji: '❤️', toggled: false },
      }),
    );
    await flushPromises();
    expect(wrapper.find('.reaction-log').exists()).toBe(true);

    await wrapper.find('.reaction-log-clear').trigger('click');
    expect(wrapper.find('.reaction-log').exists()).toBe(false);
  });

  it('resolves admin route from location hash', async () => {
    window.location.hash = '#/admin';
    mockFetchSequence([{ body: { success: true, status: 'running' } }]);
    const wrapper = mount(App, {
      global: {
        stubs: {
          ColorThemeSwitcher: ColorThemeSwitcherStub,
          AdminDemoPanel: AdminDemoPanelStub,
          CommandPalette: CommandPaletteStub,
        },
      },
    });

    await flushPromises();
    expect(wrapper.find('.admin-stub').exists()).toBe(true);
  });

  it('runs zero-key smoke checks and marks provider chip ready when UP', async () => {
    const healthOk = { success: true, status: 'running' };
    const livenessOk = { status: 'UP' };
    const statsOk = { calls: 0 };
    const runtimeOk = {
      success: true,
      service: { contextPath: '/ai-assistant' },
      security: { accessTokenConfigured: false },
      features: {},
      limits: {},
    };
    const providerUp = { status: 'UP' };
    const chat503 = { success: false };

    mockFetchSequence([
      { body: healthOk },
      { body: livenessOk },
      { body: statsOk },
      { body: runtimeOk },
      { body: providerUp },
      { ok: false, status: 503, body: chat503 },
    ]);

    const wrapper = mount(App, {
      global: {
        stubs: {
          ColorThemeSwitcher: ColorThemeSwitcherStub,
          AdminDemoPanel: AdminDemoPanelStub,
          CommandPalette: CommandPaletteStub,
        },
      },
    });

    await flushPromises();
    await vi.waitFor(() => expect(wrapper.findAll('.smoke-check')).toHaveLength(6));

    const readyChips = wrapper.findAll('.stream-phase-chip.ready');
    expect(readyChips.length).toBeGreaterThanOrEqual(2);
    expect(wrapper.text()).toContain('零密钥 smoke');
  });
});
