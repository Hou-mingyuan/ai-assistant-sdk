/**
 * K44: ChatInputArea component-level integration tests.
 *
 * Focus: the keydown branch matrix that K36 added (prompt-history recall)
 * + the pre-existing Enter / Ctrl+Enter send semantics + slash-command
 * priority. We mount the real ChatInputArea via @vue/test-utils so the
 * Vue template binding / emit machinery is exercised end-to-end.
 */
import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import ChatInputArea from './ChatInputArea.vue';
import type { I18nMessages } from '../utils/i18n';

const stubI18n = {
  pendingImage: 'Pending image',
  removeImage: 'Remove image',
  uploadFile: 'Upload',
  send: 'Send',
  chat: 'Chat',
  translate: 'Translate',
  summarize: 'Summarize',
  newline: 'Newline',
  modelLabel: 'Model',
  modelSearchPlaceholder: 'Search models',
  modelDefaultBadge: 'Default',
  modelNoMatches: 'No matching models',
  modelGroupOther: 'Other',
  modelCapabilityText: 'Text',
  modelCapabilityVision: 'Vision',
  modelCapabilityTools: 'Tools',
  modelCapabilityLongContext: 'Long context',
  modelImageRiskWarning: 'This model may not support image understanding.',
  modelSwitchToVision: 'Switch to vision model',
  inputNearLimitWarning: 'Input is close to the configured limit.',
  inputOverLimitWarning: 'Input exceeds the configured limit and will be truncated when sent.',
  sendUnavailableNoBackend: 'Configure backend before sending.',
  micStart: 'Start mic',
  micStop: 'Stop mic',
} as unknown as I18nMessages;

function mountInput(overrides: Partial<Record<string, unknown>> = {}) {
  return mount(ChatInputArea, {
    props: {
      modelValue: '',
      mode: 'chat' as const,
      loading: false,
      ctrlEnterToSend: false,
      soundEnabled: false,
      color: '#3b82f6',
      placeholder: 'Type a message',
      charCountLabel: '',
      charCountNearLimit: false,
      pendingImageThumbs: [],
      acceptTypes: '.txt',
      hasBaseUrl: false,
      showModelPicker: false,
      selectedModel: '',
      modelChoices: [] as string[],
      modelListMessage: '',
      modelStatusText: '',
      modelStatusKind: 'offline' as const,
      defaultModel: '',
      charLimitWarningText: '',
      sendBlockedReason: '',
      sendBlockedActionLabel: '',
      targetLang: 'en',
      voiceSupported: false,
      voiceRecording: false,
      voiceConversationActive: false,
      t: stubI18n,
      ...overrides,
    },
    attachTo: document.body,
  });
}

async function triggerKeydown(
  wrapper: ReturnType<typeof mountInput>,
  init: Partial<KeyboardEventInit> & { key: string },
) {
  /* Use @vue/test-utils trigger which goes through Vue's event system,
   * not raw dispatchEvent (which Vue 3 + jsdom sometimes silently swallows
   * for synthetic KeyboardEvents). */
  const ta = wrapper.find('textarea.ai-footer-textarea');
  await ta.trigger('keydown', { ...init });
  return ta;
}

describe('ChatInputArea (K44)', () => {
  describe('Enter / Ctrl+Enter send semantics', () => {
    it('Enter sends when ctrlEnterToSend=false (default)', async () => {
      const w = mountInput({ modelValue: 'hi' });
      await triggerKeydown(w, { key: 'Enter' });
      expect(w.emitted('send')).toBeTruthy();
      expect(w.emitted('send')!.length).toBe(1);
      w.unmount();
    });

    it('Enter inserts newline (NOT send) when ctrlEnterToSend=true', async () => {
      const w = mountInput({ modelValue: 'hi', ctrlEnterToSend: true });
      await triggerKeydown(w, { key: 'Enter' });
      expect(w.emitted('send')).toBeFalsy();
      w.unmount();
    });

    it('Ctrl+Enter sends when ctrlEnterToSend=true', async () => {
      const w = mountInput({ modelValue: 'hi', ctrlEnterToSend: true });
      await triggerKeydown(w, { key: 'Enter', ctrlKey: true });
      expect(w.emitted('send')).toBeTruthy();
      expect(w.emitted('send')!.length).toBe(1);
      w.unmount();
    });

    it('Shift+Enter does not send in either mode (allows newline)', async () => {
      const w = mountInput({ modelValue: 'hi' });
      await triggerKeydown(w, { key: 'Enter', shiftKey: true });
      expect(w.emitted('send')).toBeFalsy();
      w.unmount();
    });
  });

  describe('K36 prompt-history recall', () => {
    it('ArrowUp on empty input emits historyOlder', async () => {
      const w = mountInput({ modelValue: '' });
      await triggerKeydown(w, { key: 'ArrowUp' });
      expect(w.emitted('historyOlder')).toBeTruthy();
      expect(w.emitted('historyOlder')!.length).toBe(1);
      w.unmount();
    });

    it('ArrowUp on whitespace-only input also triggers recall', async () => {
      const w = mountInput({ modelValue: '    ' });
      await triggerKeydown(w, { key: 'ArrowUp' });
      expect(w.emitted('historyOlder')).toBeTruthy();
      expect(w.emitted('historyOlder')!.length).toBe(1);
      w.unmount();
    });

    it('ArrowUp on non-empty input is a no-op (cursor stays)', async () => {
      const w = mountInput({ modelValue: 'in progress' });
      await triggerKeydown(w, { key: 'ArrowUp' });
      expect(w.emitted('historyOlder')).toBeFalsy();
      w.unmount();
    });

    it('ArrowDown is a no-op until ArrowUp activates recall', async () => {
      const w = mountInput({ modelValue: '' });
      await triggerKeydown(w, { key: 'ArrowDown' });
      expect(w.emitted('historyNewer')).toBeFalsy();
      w.unmount();
    });

    it('after recall is active, ArrowDown emits historyNewer', async () => {
      const w = mountInput({ modelValue: '' });
      await triggerKeydown(w, { key: 'ArrowUp' });
      expect(w.emitted('historyOlder')).toBeTruthy();
      await triggerKeydown(w, { key: 'ArrowDown' });
      expect(w.emitted('historyNewer')).toBeTruthy();
      expect(w.emitted('historyNewer')!.length).toBe(1);
      w.unmount();
    });

    it('Escape during recall emits historyReset and exits recall', async () => {
      const w = mountInput({ modelValue: '' });
      await triggerKeydown(w, { key: 'ArrowUp' });
      await triggerKeydown(w, { key: 'Escape' });
      expect(w.emitted('historyReset')).toBeTruthy();
      expect(w.emitted('historyReset')!.length).toBe(1);
      /* After Escape exits recall, subsequent ArrowDown is a no-op (does
       * NOT emit historyNewer) — proves recallActive was actually cleared. */
      await triggerKeydown(w, { key: 'ArrowDown' });
      expect(w.emitted('historyNewer')).toBeFalsy();
      w.unmount();
    });

    it('historyEnabled=false disables all 3 recall handlers', async () => {
      const w = mountInput({ modelValue: '', historyEnabled: false });
      await triggerKeydown(w, { key: 'ArrowUp' });
      await triggerKeydown(w, { key: 'ArrowDown' });
      await triggerKeydown(w, { key: 'Escape' });
      expect(w.emitted('historyOlder')).toBeFalsy();
      expect(w.emitted('historyNewer')).toBeFalsy();
      expect(w.emitted('historyReset')).toBeFalsy();
      w.unmount();
    });
  });

  describe('Slash command priority', () => {
    it('Slash popup visible: ArrowUp is captured by slash (not history)', async () => {
      const w = mountInput({
        modelValue: '/h',
        slashVisible: true,
        slashCommands: [
          { name: '/help', description: 'help', icon: 'M0 0', run: () => {} },
        ] as unknown[],
        slashSelectedIndex: 0,
      });
      await triggerKeydown(w, { key: 'ArrowUp' });
      expect(w.emitted('slashKeydown')).toBeTruthy();
      expect(w.emitted('slashKeydown')!.length).toBe(1);
      expect(w.emitted('historyOlder')).toBeFalsy();
      w.unmount();
    });
  });

  describe('Markdown shortcuts', () => {
    it('Ctrl+B emits update:modelValue wrapping the textarea content', async () => {
      const w = mountInput({ modelValue: 'foo' });
      const ta = w.find('textarea.ai-footer-textarea').element as HTMLTextAreaElement;
      ta.value = 'foo';
      ta.setSelectionRange(0, 3);
      ta.focus();
      await triggerKeydown(w, { key: 'b', ctrlKey: true });
      const updates = w.emitted('update:modelValue') ?? [];
      expect(updates.length).toBeGreaterThan(0);
      expect(updates[updates.length - 1]![0]).toContain('**foo**');
      w.unmount();
    });
  });

  describe('Model picker', () => {
    it('filters model choices and emits the selected model', async () => {
      const w = mountInput({
        hasBaseUrl: true,
        showModelPicker: true,
        selectedModel: 'gpt-4o-mini',
        modelChoices: ['gpt-4o-mini', 'deepseek-chat', 'qwen-max'],
        defaultModel: 'gpt-4o-mini',
      });

      await w.find('.ai-model-picker-trigger').trigger('click');
      await w.find('.ai-model-search-input').setValue('deep');
      expect(w.text()).toContain('deepseek-chat');
      expect(w.text()).not.toContain('qwen-max');

      await w
        .findAll('.ai-model-option')
        .find((btn) => btn.text().includes('deepseek-chat'))!
        .trigger('click');
      expect(w.emitted('update:selectedModel')?.at(-1)?.[0]).toBe('deepseek-chat');
      w.unmount();
    });

    it('marks the default model in the picker', async () => {
      const w = mountInput({
        hasBaseUrl: true,
        showModelPicker: true,
        selectedModel: 'qwen-max',
        modelChoices: ['qwen-max', 'deepseek-chat'],
        defaultModel: 'qwen-max',
      });

      await w.find('.ai-model-picker-trigger').trigger('click');
      expect(w.find('.ai-model-default-badge').text()).toBe('Default');
      w.unmount();
    });
  });

  describe('Model capabilities and image risk', () => {
    it('shows an image risk warning when pending images target a text model', () => {
      const w = mountInput({
        selectedModel: 'deepseek-chat',
        pendingImageThumbs: ['data:image/png;base64,thumb'],
      });

      expect(w.find('.ai-model-risk').text()).toContain('may not support image');
      w.unmount();
    });

    it('switches to the first likely vision model from the image risk action', async () => {
      const w = mountInput({
        selectedModel: 'deepseek-chat',
        modelChoices: ['deepseek-chat', 'qwen-vl-max', 'gpt-4o-mini'],
        pendingImageThumbs: ['data:image/png;base64,thumb'],
      });

      await w.find('.ai-model-risk-action').trigger('click');
      expect(w.emitted('update:selectedModel')?.at(-1)?.[0]).toBe('qwen-vl-max');
      w.unmount();
    });

    it('shows a vision capability tag for likely vision models without image risk', () => {
      const w = mountInput({
        selectedModel: 'qwen-vl-max',
        pendingImageThumbs: ['data:image/png;base64,thumb'],
      });

      expect(w.text()).toContain('Vision');
      expect(w.find('.ai-model-risk').exists()).toBe(false);
      w.unmount();
    });

    it('treats MiniMax-M2.7 as vision-capable for image prompts', () => {
      const w = mountInput({
        selectedModel: 'MiniMax-M2.7',
        pendingImageThumbs: ['data:image/png;base64,thumb'],
      });

      expect(w.text()).toContain('Vision');
      expect(w.find('.ai-model-risk').exists()).toBe(false);
      w.unmount();
    });

    it('trusts server-provided model capability details for opaque router names', () => {
      const w = mountInput({
        selectedModel: 'company-router',
        modelCapabilities: { 'company-router': ['text', 'vision', 'tools'] },
        pendingImageThumbs: ['data:image/png;base64,thumb'],
      });

      expect(w.text()).toContain('Vision');
      expect(w.find('.ai-model-risk').exists()).toBe(false);
      w.unmount();
    });
  });

  describe('Input length risk', () => {
    it('shows a pre-send length warning when provided by the host', () => {
      const w = mountInput({
        modelValue: 'x'.repeat(12),
        charCountLabel: '12/10',
        charCountNearLimit: true,
        charLimitWarningText: 'Input exceeds the configured limit and will be truncated when sent.',
      });

      expect(w.find('.ai-input-risk').text()).toContain('will be truncated');
      w.unmount();
    });

    it('resets textarea height when the host clears the input', async () => {
      const w = mountInput({ modelValue: 'long draft' });
      const ta = w.find('textarea.ai-footer-textarea').element as HTMLTextAreaElement;
      ta.style.height = '180px';

      await w.setProps({ modelValue: '' });
      await nextTick();

      expect(ta.style.height).toBe('34px');
      w.unmount();
    });
  });

  describe('Send availability', () => {
    it('disables send and shows a reason when sending is blocked', () => {
      const w = mountInput({
        modelValue: 'hello',
        sendBlockedReason: 'Configure backend before sending.',
      });

      expect(w.find('.ai-send').attributes('disabled')).toBeDefined();
      expect(w.find('.ai-send-risk').text()).toContain('Configure backend');
      w.unmount();
    });

    it('emits a configuration action from the send blocked hint', async () => {
      const w = mountInput({
        modelValue: 'hello',
        sendBlockedReason: 'Configure backend before sending.',
        sendBlockedActionLabel: 'Use /ai-assistant',
      });

      await w.find('.ai-send-risk-action').trigger('click');
      expect(w.emitted('sendBlockedAction')).toBeTruthy();
      w.unmount();
    });
  });
});
