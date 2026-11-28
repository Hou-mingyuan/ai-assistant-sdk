import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import AiAssistant from './AiAssistant.vue';

function createFetchMock() {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes('/models')) {
      return new Response(
        JSON.stringify({
          models: ['gpt-4o-mini'],
          defaultModel: 'gpt-4o-mini',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }
    if (url.includes('/file/summarize')) {
      const form = init?.body as FormData | undefined;
      const question = form?.get('question');
      return new Response(
        JSON.stringify({
          success: true,
          result: question ? `Answer for "${String(question)}"` : 'File summary',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }
    return new Response(JSON.stringify({ success: true, status: 'running' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  });
}

function firePointer(target: EventTarget, type: string, clientX: number, clientY: number) {
  const ev = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperties(ev, {
    button: { value: 0 },
    pointerId: { value: 1 },
    clientX: { value: clientX },
    clientY: { value: clientY },
  });
  target.dispatchEvent(ev);
}

describe('AiAssistant streamlined widget', () => {
  const fetchSpy = createFetchMock();

  beforeEach(() => {
    localStorage.clear();
    fetchSpy.mockClear();
    vi.stubGlobal('fetch', fetchSpy);
    vi.stubGlobal('matchMedia', () => ({
      matches: false,
      media: '',
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    if (!HTMLElement.prototype.scrollIntoView) {
      HTMLElement.prototype.scrollIntoView = vi.fn();
    }
    if (!HTMLElement.prototype.setPointerCapture) {
      HTMLElement.prototype.setPointerCapture = vi.fn();
    }
    if (!HTMLElement.prototype.releasePointerCapture) {
      HTMLElement.prototype.releasePointerCapture = vi.fn();
    }
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('opens streamlined panel with 6 edge-dock style settings and collapses on outside mousedown', async () => {
    const wrapper = mount(AiAssistant, {
      attachTo: document.body,
      global: {
        provide: {
          'ai-assistant-options': {
            baseUrl: '/ai-assistant',
            locale: 'zh',
            formAutoFill: true,
          },
        },
      },
    });

    firePointer(wrapper.find('.ai-fab').element, 'pointerdown', 20, 20);
    firePointer(window, 'pointerup', 20, 20);
    await flushPromises();

    expect(wrapper.find('.ai-panel').exists()).toBe(true);
    expect(wrapper.find('.ai-header-settings').exists()).toBe(true);
    expect(wrapper.findAll('.ai-empty-starter')).toHaveLength(3);

    await wrapper.find('.ai-header-settings').trigger('click');
    await flushPromises();

    const tabs = wrapper.findAll('.ai-settings-tab');
    expect(tabs).toHaveLength(2);
    await tabs[1].trigger('click');
    await flushPromises();

    const styleCards = wrapper.findAll('.ai-dock-style-card');
    expect(styleCards).toHaveLength(6);

    await styleCards[3].trigger('click');
    await flushPromises();
    expect(wrapper.find('.ai-assistant-wrapper').classes()).toContain('dock-style-eye-strip');

    await wrapper.findAll('.ai-dock-quick-btn')[1].trigger('click');
    await flushPromises();
    expect(wrapper.find('.ai-panel').exists()).toBe(false);
    expect(wrapper.find('.ai-assistant-wrapper').classes()).toContain('edge-dock-right');
    expect(wrapper.find('.ai-assistant-wrapper').classes()).toContain('dock-style-eye-strip');

    // Re-open panel and collapse cleanly on outside mousedown
    firePointer(wrapper.find('.ai-fab').element, 'pointerdown', 20, 20);
    firePointer(window, 'pointerup', 20, 20);
    await flushPromises();
    firePointer(wrapper.find('.ai-fab').element, 'pointerdown', 20, 20);
    firePointer(window, 'pointerup', 20, 20);
    await flushPromises();
    expect(wrapper.find('.ai-panel').exists()).toBe(true);

    const outside = document.createElement('div');
    document.body.appendChild(outside);
    outside.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    await flushPromises();

    expect(wrapper.find('.ai-panel').exists()).toBe(false);

    outside.remove();
    wrapper.unmount();
  });

  it('uploads pending file with user question to /file/summarize', async () => {
    const wrapper = mount(AiAssistant, {
      attachTo: document.body,
      global: {
        provide: {
          'ai-assistant-options': {
            baseUrl: '/ai-assistant',
            locale: 'en',
          },
        },
      },
    });

    firePointer(wrapper.find('.ai-fab').element, 'pointerdown', 10, 10);
    firePointer(window, 'pointerup', 10, 10);
    await flushPromises();

    const doc = new File(['hello contract'], 'contract.txt', { type: 'text/plain' });
    const fileInput = wrapper.find('.ai-footer input[type="file"]');
    Object.defineProperty(fileInput.element, 'files', { value: [doc], configurable: true });
    await fileInput.trigger('change');
    await flushPromises();

    expect(wrapper.find('.ai-pending-file').text()).toContain('contract.txt');

    await wrapper.find('textarea.ai-footer-textarea').setValue('What is the termination clause?');
    await wrapper.find('.ai-send').trigger('click');
    await flushPromises();

    const summarizeCall = fetchSpy.mock.calls.find(([u]) => String(u).includes('/file/summarize'));
    expect(summarizeCall).toBeTruthy();
    const sentForm = summarizeCall![1]?.body as FormData;
    expect(sentForm.get('question')).toBe('What is the termination clause?');

    expect(wrapper.find('.ai-panel').text()).toContain('What is the termination clause?');
    expect(wrapper.find('.ai-panel').text()).toContain(
      'Answer for "What is the termination clause?"',
    );
    expect(wrapper.find('.ai-pending-file').exists()).toBe(false);

    wrapper.unmount();
  });

  it('configures direct OpenAI-compatible model/API key and streams chat & text-file Q&A', async () => {
    localStorage.clear();
    const encoder = new TextEncoder();
    const fetchSpy = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === 'https://api.deepseek.com/v1/models') {
        return new Response(
          JSON.stringify({ data: [{ id: 'deepseek-chat' }, { id: 'deepseek-reasoner' }] }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      if (url === 'https://api.deepseek.com/v1/chat/completions') {
        const body = JSON.parse(String(init?.body || '{}')) as {
          model?: string;
          messages?: Array<{ role: string; content: string }>;
        };
        const lastUser = body.messages?.[body.messages.length - 1]?.content || '';
        const reply = lastUser.includes('notes.txt') ? 'TXT总结完成' : '直连回复成功';
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ choices: [{ delta: { content: reply } }] })}\n\n`,
              ),
            );
            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
            controller.close();
          },
        });
        return new Response(stream, {
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' },
        });
      }
      if (url.includes('/models')) {
        return new Response(JSON.stringify({ success: true, models: ['server-model'] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchSpy);

    const wrapper = mount(AiAssistant, {
      attachTo: document.body,
      global: {
        provide: {
          'ai-assistant-options': {
            baseUrl: '/ai-assistant',
            locale: 'zh',
          },
        },
      },
    });

    try {
      firePointer(wrapper.find('.ai-fab').element, 'pointerdown', 20, 20);
      firePointer(window, 'pointerup', 20, 20);
      await flushPromises();

      await wrapper.find('.ai-header-settings').trigger('click');
      await flushPromises();

      const modeButtons = wrapper.findAll('.ai-conn-mode-btn');
      expect(modeButtons).toHaveLength(2);
      await modeButtons[1].trigger('click');

      expect(wrapper.findAll('.ai-prov-item')).toHaveLength(1);
      await wrapper.find('.ai-prov-add-btn').trigger('click');

      const deepseekPreset = wrapper
        .findAll('.ai-conn-preset-pill')
        .find((el) => el.text().includes('DeepSeek'));
      expect(deepseekPreset).toBeTruthy();
      await deepseekPreset!.trigger('click');

      expect(wrapper.findAll('.ai-prov-item')).toHaveLength(2);

      await wrapper.find('.ai-conn-secret-wrap input.ai-conn-input').setValue('sk-direct-test');
      await wrapper.find('.ai-conn-mini-btn').trigger('click');
      await flushPromises();

      expect(wrapper.find('.ai-conn-status').text()).toContain('2 个模型');
      expect(wrapper.findAll('.ai-conn-chip')).toHaveLength(2);

      await wrapper.find('input.ai-prov-model-input').setValue('deepseek-coder');
      await wrapper.find('.ai-prov-add-model-btn').trigger('click');
      expect(wrapper.findAll('.ai-conn-chip')).toHaveLength(3);

      const chatChip = wrapper
        .findAll('.ai-conn-chip')
        .find((el) => el.text().trim() === 'deepseek-chat');
      await chatChip!.trigger('click');

      await wrapper.find('.ai-conn-btn-primary').trigger('click');
      await flushPromises();
      await wrapper.find('.ai-settings-close').trigger('click');
      await flushPromises();

      const saved = JSON.parse(
        localStorage.getItem('ai-assistant-connection-config-v1') || '{}',
      ) as {
        mode?: string;
        activeProviderId?: string;
        providers?: Array<{ id: string; models: string[]; apiKey: string }>;
        directBaseUrl?: string;
        directModel?: string;
        directApiKey?: string;
      };
      expect(saved.mode).toBe('direct');
      expect(saved.activeProviderId).toBe('deepseek');
      expect(saved.providers).toHaveLength(2);
      expect(saved.providers![1].models).toEqual([
        'deepseek-coder',
        'deepseek-chat',
        'deepseek-reasoner',
      ]);
      expect(saved.directBaseUrl).toBe('https://api.deepseek.com/v1');
      expect(saved.directModel).toBe('deepseek-chat');
      expect(saved.directApiKey).toBe('sk-direct-test');
      expect(wrapper.find('.ai-title-subtitle').text()).toBe('deepseek-chat');

      await wrapper.find('textarea.ai-footer-textarea').setValue('你好，测试直连');
      await wrapper.find('.ai-send').trigger('click');
      await flushPromises();

      const directChatCall = fetchSpy.mock.calls.find(
        ([u]) => String(u) === 'https://api.deepseek.com/v1/chat/completions',
      );
      expect(directChatCall).toBeTruthy();
      expect((directChatCall![1]?.headers as Record<string, string>).Authorization).toBe(
        'Bearer sk-direct-test',
      );
      expect(wrapper.find('.ai-panel').text()).toContain('直连回复成功');

      const txtFile = new File(['第一行关键内容\n第二行待办'], 'notes.txt', {
        type: 'text/plain',
      });
      const fileInput = wrapper.find('input[type="file"]');
      Object.defineProperty(fileInput.element, 'files', { value: [txtFile], configurable: true });
      await fileInput.trigger('change');
      await wrapper.find('textarea.ai-footer-textarea').setValue('总结重点');
      await wrapper.find('.ai-send').trigger('click');
      await flushPromises();

      expect(fetchSpy.mock.calls.some(([u]) => String(u).includes('/file/summarize'))).toBe(false);
      expect(wrapper.find('.ai-panel').text()).toContain('TXT总结完成');
    } finally {
      wrapper.unmount();
      localStorage.clear();
    }
  });
});
