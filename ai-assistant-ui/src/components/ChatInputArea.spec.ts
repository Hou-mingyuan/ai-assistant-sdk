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
      pendingImageThumb: null,
      acceptTypes: '.txt',
      hasBaseUrl: false,
      showModelPicker: false,
      selectedModel: '',
      modelChoices: [] as string[],
      modelListMessage: '',
      targetLang: 'en',
      voiceSupported: false,
      voiceRecording: false,
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
});
