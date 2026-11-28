import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import ChatInputArea from './ChatInputArea.vue';
import { getMessages, type I18nMessages } from '../utils/i18n';

const stubI18n = getMessages('en') as I18nMessages;

function mountInput(props: Record<string, unknown> = {}) {
  return mount(ChatInputArea, {
    props: {
      modelValue: '',
      loading: false,
      ctrlEnterToSend: false,
      color: '#2457d6',
      placeholder: 'Ask something',
      charCountLabel: '',
      charCountNearLimit: false,
      charLimitWarningText: '',
      pendingFile: null,
      pendingImageThumbs: [],
      acceptTypes: '.txt,.pdf,.docx',
      hasBaseUrl: true,
      showModelPicker: false,
      selectedModel: 'gpt-4o-mini',
      modelChoices: ['gpt-4o-mini'],
      formAutoFillEnabled: true,
      t: stubI18n,
      slashVisible: false,
      slashCommands: [],
      slashSelectedIndex: 0,
      historyEnabled: true,
      ...props,
    },
  });
}

async function triggerKeydown(
  wrapper: ReturnType<typeof mountInput>,
  init: KeyboardEventInit,
): Promise<void> {
  await wrapper.find('textarea.ai-footer-textarea').trigger('keydown', init);
}

describe('ChatInputArea', () => {
  it('emits send on Enter without Shift when ctrlEnterToSend=false', async () => {
    const w = mountInput({ modelValue: 'hello' });
    await w
      .find('textarea.ai-footer-textarea')
      .trigger('keydown', { key: 'Enter', shiftKey: false });
    expect(w.emitted('send')).toHaveLength(1);
    w.unmount();
  });

  it('does not emit send on Shift+Enter', async () => {
    const w = mountInput({ modelValue: 'hello' });
    await w
      .find('textarea.ai-footer-textarea')
      .trigger('keydown', { key: 'Enter', shiftKey: true });
    expect(w.emitted('send')).toBeFalsy();
    w.unmount();
  });

  it('renders pending file pill for File Upload Q&A and allows sending without typed text', async () => {
    const file = new File(['hello'], 'report.pdf', { type: 'application/pdf' });
    const w = mountInput({ modelValue: '', pendingFile: file });

    expect(w.find('.ai-pending-file').text()).toContain('report.pdf');
    expect(w.find('.ai-send').attributes('disabled')).toBeUndefined();

    await w.find('.ai-pending-file-remove').trigger('click');
    expect(w.emitted('clearPendingFile')).toHaveLength(1);
    w.unmount();
  });

  it('emits fileSelect and chatImage when files are selected', async () => {
    const w = mountInput();
    const pdf = new File(['doc'], 'notes.txt', { type: 'text/plain' });
    const inputs = w.findAll('input[type="file"]');
    Object.defineProperty(inputs[0]!.element, 'files', { value: [pdf], configurable: true });
    await inputs[0]!.trigger('change');
    expect(w.emitted('fileSelect')?.[0]).toEqual([pdf]);

    const img = new File(['png'], 'shot.png', { type: 'image/png' });
    Object.defineProperty(inputs[1]!.element, 'files', { value: [img], configurable: true });
    await inputs[1]!.trigger('change');
    expect(w.emitted('chatImage')?.[0]).toEqual([img]);
    w.unmount();
  });

  it('emits triggerFormFill when form-fill toolbar button is clicked', async () => {
    const w = mountInput({ formAutoFillEnabled: true });
    await w.find('.ai-form-fill-trigger').trigger('click');
    expect(w.emitted('triggerFormFill')).toHaveLength(1);
    w.unmount();
  });

  it('shows compact model selector only when multiple models are available', async () => {
    const single = mountInput({ showModelPicker: true, modelChoices: ['gpt-4o-mini'] });
    expect(single.find('.ai-model-mini-select').exists()).toBe(false);
    single.unmount();

    const multi = mountInput({
      showModelPicker: true,
      selectedModel: 'gpt-4o-mini',
      modelChoices: ['gpt-4o-mini', 'deepseek-chat'],
    });
    const select = multi.find('select.ai-model-mini-select');
    expect(select.exists()).toBe(true);
    await select.setValue('deepseek-chat');
    expect(multi.emitted('update:selectedModel')?.[0]).toEqual(['deepseek-chat']);
    multi.unmount();
  });

  it('emits pasteText on plain-text paste for clipboard form auto-fill detection', async () => {
    const w = mountInput();
    const ta = w.find('textarea.ai-footer-textarea').element as HTMLTextAreaElement;
    const pasteEv = new Event('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(pasteEv, 'clipboardData', {
      value: {
        items: [],
        getData: (type: string) => (type === 'text/plain' ? '姓名: 张三\n电话: 13800000000' : ''),
      },
    });
    ta.dispatchEvent(pasteEv);
    await nextTick();
    const emitted = w.emitted('pasteText')?.[0]?.[0] as { text: string } | undefined;
    expect(emitted?.text).toContain('张三');
    w.unmount();
  });

  it('handles prompt history recall with ArrowUp/ArrowDown/Escape', async () => {
    const w = mountInput({ modelValue: '' });
    await triggerKeydown(w, { key: 'ArrowUp' });
    expect(w.emitted('historyOlder')).toHaveLength(1);
    await triggerKeydown(w, { key: 'ArrowDown' });
    expect(w.emitted('historyNewer')).toHaveLength(1);
    await triggerKeydown(w, { key: 'Escape' });
    expect(w.emitted('historyReset')).toHaveLength(1);
    w.unmount();
  });

  it('gives slash command popup keyboard priority over prompt history', async () => {
    const w = mountInput({
      modelValue: '/f',
      slashVisible: true,
      slashCommands: [{ name: '/fill', description: 'fill', icon: 'M0 0', run: () => {} }],
      slashSelectedIndex: 0,
    });
    await w.find('textarea.ai-footer-textarea').trigger('keydown', { key: 'ArrowUp' });
    expect(w.emitted('slashKeydown')).toHaveLength(1);
    expect(w.emitted('historyOlder')).toBeFalsy();
    w.unmount();
  });

  it('resets textarea height when modelValue is cleared', async () => {
    const w = mountInput({ modelValue: 'draft' });
    const ta = w.find('textarea.ai-footer-textarea').element as HTMLTextAreaElement;
    ta.style.height = '140px';
    await w.setProps({ modelValue: '' });
    await nextTick();
    expect(ta.style.height).toBe('34px');
    w.unmount();
  });
});
