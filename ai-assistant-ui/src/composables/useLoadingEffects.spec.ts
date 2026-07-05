import { nextTick, ref } from 'vue';
import { describe, expect, it, vi } from 'vitest';
import type { Message } from '../types/message';
import { useLoadingEffects } from './useLoadingEffects';

function setup(opts: { autoRead?: boolean; messages?: Message[] } = {}) {
  const loading = ref(false);
  const messages = ref<Message[]>(
    opts.messages ?? [{ role: 'assistant', content: 'hello **world**' }],
  );
  const audioPreferences = { autoRead: ref(!!opts.autoRead), voice: ref(''), rate: ref(1) };
  const voiceConversationActive = ref(false);
  const tts = { supported: ref(true), speak: vi.fn() };
  const artifactsController = { registerArtifacts: vi.fn() };
  const removeTransientAssistantMessages = vi.fn();
  const r = useLoadingEffects({
    loading,
    messages,
    audioPreferences,
    voiceConversationActive,
    tts,
    artifactsController,
    removeTransientAssistantMessages,
  });
  return {
    loading,
    messages,
    audioPreferences,
    tts,
    artifactsController,
    removeTransientAssistantMessages,
    ...r,
  };
}

async function finish(loading: { value: boolean }) {
  loading.value = true;
  await nextTick();
  loading.value = false;
  await nextTick();
}

describe('useLoadingEffects', () => {
  it('registers artifacts and prunes transient messages when streaming finishes', async () => {
    const ctx = setup();
    await finish(ctx.loading);
    expect(ctx.artifactsController.registerArtifacts).toHaveBeenCalledTimes(1);
    expect(ctx.removeTransientAssistantMessages).toHaveBeenCalledTimes(1);
  });

  it('does not run finish effects when loading turns on', async () => {
    const ctx = setup();
    ctx.loading.value = true;
    await nextTick();
    expect(ctx.removeTransientAssistantMessages).not.toHaveBeenCalled();
    expect(ctx.artifactsController.registerArtifacts).not.toHaveBeenCalled();
  });

  it('speaks the reply via TTS only when auto-read is enabled', async () => {
    const off = setup({ autoRead: false });
    await finish(off.loading);
    expect(off.tts.speak).not.toHaveBeenCalled();

    const on = setup({ autoRead: true });
    await finish(on.loading);
    expect(on.tts.speak).toHaveBeenCalledTimes(1);
  });

  it('announces a markdown-stripped reply for screen readers when TTS is silent', async () => {
    const ctx = setup({ autoRead: false });
    await finish(ctx.loading);
    await nextTick();
    expect(ctx.a11yReplyAnnouncement.value).toBe('hello world');
  });

  it('skips the live-region announcement when auto-read TTS will speak', async () => {
    const ctx = setup({ autoRead: true });
    await finish(ctx.loading);
    await nextTick();
    expect(ctx.a11yReplyAnnouncement.value).toBe('');
  });
});
