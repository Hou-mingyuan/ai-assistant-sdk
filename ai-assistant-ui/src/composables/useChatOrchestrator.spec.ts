import { describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';
import { useChatOrchestrator } from './useChatOrchestrator';
import type { Message } from '../types/message';

function setup(
  overrides: {
    messages?: Message[];
    loading?: boolean;
    controller?: AbortController | null;
    errorPrefixes?: readonly string[];
  } = {},
) {
  const messages = ref<Message[]>(overrides.messages ?? []);
  const loading = ref<boolean>(overrides.loading ?? false);
  const input = ref('');
  const editingMsgIdx = ref<number | null>(null);
  const editingText = ref('');
  const clearRenderCache = vi.fn();
  const send = vi.fn().mockResolvedValue(undefined);
  const emitFeedback = vi.fn();

  let controller: AbortController | null = overrides.controller ?? null;
  let stoppedByUser = false;

  const orchestrator = useChatOrchestrator({
    messages,
    loading,
    input,
    editingMsgIdx,
    editingText,
    clearRenderCache,
    send,
    getStreamAbortController: () => controller,
    setStreamAbortController: (c) => {
      controller = c;
    },
    setStreamStoppedByUser: (v) => {
      stoppedByUser = v;
    },
    emitFeedback,
    errorPrefixes: overrides.errorPrefixes,
  });

  return {
    orchestrator,
    state: { messages, loading, input, editingMsgIdx, editingText },
    spies: { clearRenderCache, send, emitFeedback },
    getController: () => controller,
    isStoppedByUser: () => stoppedByUser,
  };
}

describe('useChatOrchestrator', () => {
  describe('stopGenerate', () => {
    it('aborts the active controller and clears it', () => {
      const ctl = new AbortController();
      const abortSpy = vi.spyOn(ctl, 'abort');
      const harness = setup({ controller: ctl });

      harness.orchestrator.stopGenerate();

      expect(abortSpy).toHaveBeenCalledWith('user-stop');
      expect(harness.getController()).toBeNull();
      expect(harness.isStoppedByUser()).toBe(true);
    });

    it('is a no-op when no controller is active', () => {
      const harness = setup({ controller: null });
      harness.orchestrator.stopGenerate();
      expect(harness.isStoppedByUser()).toBe(false);
    });
  });

  describe('isErrorMessage', () => {
    it('matches default English / Chinese / Japanese / Korean prefixes', () => {
      const { orchestrator } = setup();
      expect(orchestrator.isErrorMessage({ role: 'assistant', content: 'Error: timeout' })).toBe(
        true,
      );
      expect(orchestrator.isErrorMessage({ role: 'assistant', content: '错误: 超时' })).toBe(true);
      expect(orchestrator.isErrorMessage({ role: 'assistant', content: 'エラー: timeout' })).toBe(
        true,
      );
      expect(orchestrator.isErrorMessage({ role: 'assistant', content: '오류: timeout' })).toBe(
        true,
      );
    });

    it('returns false for non-error assistant messages and any user message', () => {
      const { orchestrator } = setup();
      expect(orchestrator.isErrorMessage({ role: 'assistant', content: 'normal reply' })).toBe(
        false,
      );
      expect(orchestrator.isErrorMessage({ role: 'user', content: 'Error: looks like one' })).toBe(
        false,
      );
    });

    it('honors a custom error-prefix list', () => {
      const { orchestrator } = setup({ errorPrefixes: ['Boom!'] });
      expect(orchestrator.isErrorMessage({ role: 'assistant', content: 'Boom! something' })).toBe(
        true,
      );
      expect(orchestrator.isErrorMessage({ role: 'assistant', content: 'Error: x' })).toBe(false);
    });
  });

  describe('regenerateAt', () => {
    it('removes the assistant message, restores the user prompt to input, and triggers send', async () => {
      const harness = setup({
        messages: [
          { role: 'user', content: 'hello world' },
          { role: 'assistant', content: 'old reply' },
        ],
      });

      harness.orchestrator.regenerateAt(1);

      expect(harness.state.messages.value).toHaveLength(1);
      expect(harness.state.messages.value[0]).toEqual({ role: 'user', content: 'hello world' });
      expect(harness.state.input.value).toBe('hello world');
      expect(harness.spies.clearRenderCache).toHaveBeenCalledTimes(1);
      await Promise.resolve();
      expect(harness.spies.send).toHaveBeenCalledTimes(1);
    });

    it('uses contentArchive when present and strips the image marker', async () => {
      const harness = setup({
        messages: [
          { role: 'user', content: '🖼️ short text', contentArchive: '🖼️ full archive text' },
          { role: 'assistant', content: 'reply' },
        ],
      });

      harness.orchestrator.regenerateAt(1);
      expect(harness.state.input.value).toBe('full archive text');
    });

    it('does nothing when loading or when target is not assistant', async () => {
      const harness = setup({
        messages: [{ role: 'user', content: 'x' }],
        loading: true,
      });
      harness.orchestrator.regenerateAt(0);
      expect(harness.spies.send).not.toHaveBeenCalled();

      const harness2 = setup({ messages: [{ role: 'user', content: 'x' }] });
      harness2.orchestrator.regenerateAt(0);
      expect(harness2.spies.send).not.toHaveBeenCalled();
    });
  });

  describe('retryLastError', () => {
    it('only triggers regenerate when the message looks like an error', async () => {
      const harness = setup({
        messages: [
          { role: 'user', content: 'hi' },
          { role: 'assistant', content: 'Error: oops' },
        ],
      });

      harness.orchestrator.retryLastError(1);
      await Promise.resolve();
      expect(harness.spies.send).toHaveBeenCalledTimes(1);
    });

    it('skips when the assistant content is a normal reply', async () => {
      const harness = setup({
        messages: [
          { role: 'user', content: 'hi' },
          { role: 'assistant', content: 'normal reply' },
        ],
      });

      harness.orchestrator.retryLastError(1);
      expect(harness.spies.send).not.toHaveBeenCalled();
    });
  });

  describe('startEdit / cancelEdit / confirmEditAndResend', () => {
    it('startEdit populates editingMsgIdx and strips the image marker from the seed text', () => {
      const harness = setup({
        messages: [{ role: 'user', content: '🖼️ keep typing here' }],
      });

      harness.orchestrator.startEdit(0);
      expect(harness.state.editingMsgIdx.value).toBe(0);
      expect(harness.state.editingText.value).toBe('keep typing here');
    });

    it('cancelEdit clears editing state', () => {
      const harness = setup();
      harness.state.editingMsgIdx.value = 5;
      harness.state.editingText.value = 'mid edit';
      harness.orchestrator.cancelEdit();
      expect(harness.state.editingMsgIdx.value).toBeNull();
      expect(harness.state.editingText.value).toBe('');
    });

    it('confirmEditAndResend replaces history starting at the edited turn and triggers send', async () => {
      const harness = setup({
        messages: [
          { role: 'user', content: 'old' },
          { role: 'assistant', content: 'old reply' },
        ],
      });
      harness.state.editingMsgIdx.value = 0;
      harness.state.editingText.value = '  new edited text  ';

      harness.orchestrator.confirmEditAndResend(0);

      expect(harness.state.messages.value).toHaveLength(0);
      expect(harness.state.input.value).toBe('new edited text');
      expect(harness.state.editingMsgIdx.value).toBeNull();
      expect(harness.state.editingText.value).toBe('');
      await Promise.resolve();
      expect(harness.spies.send).toHaveBeenCalledTimes(1);
    });
  });

  describe('setFeedback', () => {
    it('sets a fresh feedback value and emits it', () => {
      const harness = setup({
        messages: [{ role: 'assistant', content: 'reply' }],
      });

      harness.orchestrator.setFeedback(0, 'up');

      expect(harness.state.messages.value[0].feedback).toBe('up');
      expect(harness.spies.emitFeedback).toHaveBeenCalledWith({ index: 0, value: 'up' });
    });

    it('toggles feedback off and emits null when the same value is selected twice', () => {
      const harness = setup({
        messages: [{ role: 'assistant', content: 'reply', feedback: 'up' }],
      });

      harness.orchestrator.setFeedback(0, 'up');

      expect(harness.state.messages.value[0].feedback).toBeUndefined();
      expect(harness.spies.emitFeedback).toHaveBeenCalledWith({ index: 0, value: null });
    });

    it('ignores user-role messages', () => {
      const harness = setup({
        messages: [{ role: 'user', content: 'hello' }],
      });

      harness.orchestrator.setFeedback(0, 'down');
      expect(harness.spies.emitFeedback).not.toHaveBeenCalled();
    });
  });
});
