import { nextTick, ref, watch, type Ref } from 'vue';
import type { Message } from '../types/message';

/**
 * Centralised "stream just finished" side effects extracted from AiAssistant.vue
 * (refactor batch 9).
 *
 * Previously four separate `watch(loading)` watchers each reacted to loading
 * going true -> false. They are merged into a single watcher that runs the four
 * effects in their original registration order (auto-read TTS, a11y live-region
 * announcement, artifact registration, transient-message pruning). Each effect
 * keeps its own guard so behaviour is identical; only the watcher count changes.
 */
interface AudioPreferencesLike {
  autoRead: Ref<boolean>;
  voice: Ref<string>;
  rate: Ref<number>;
}
interface TextToSpeechLike {
  supported: Ref<boolean>;
  speak: (text: string, opts: { messageIndex: number; voice?: string; rate: number }) => void;
}
interface ArtifactsControllerLike {
  registerArtifacts: (artifacts: Message['artifacts']) => void;
}

export interface UseLoadingEffectsOptions {
  loading: Ref<boolean>;
  messages: Ref<Message[]>;
  audioPreferences: AudioPreferencesLike;
  voiceConversationActive: Ref<boolean>;
  tts: TextToSpeechLike;
  artifactsController: ArtifactsControllerLike;
  removeTransientAssistantMessages: () => void;
}

export function useLoadingEffects(deps: UseLoadingEffectsOptions) {
  const {
    loading,
    messages,
    audioPreferences,
    voiceConversationActive,
    tts,
    artifactsController,
    removeTransientAssistantMessages,
  } = deps;

  const a11yReplyAnnouncement = ref('');

  function justFinished(now: boolean | undefined, prev: boolean | undefined): boolean {
    return prev === true && now === false;
  }

  function lastAssistantText(): { idx: number; text: string } | null {
    const idx = messages.value.length - 1;
    if (idx < 0) return null;
    const last = messages.value[idx];
    if (!last || last.role !== 'assistant') return null;
    const text = (last.contentArchive ?? last.content ?? '').trim();
    if (!text) return null;
    return { idx, text };
  }

  /** K37: speak the last assistant reply aloud when auto-read / voice conversation is on. */
  function autoReadLastReply(now: boolean | undefined, prev: boolean | undefined) {
    if (!audioPreferences.autoRead.value && !voiceConversationActive.value) return;
    if (!justFinished(now, prev)) return;
    if (!tts.supported.value) return;
    const last = lastAssistantText();
    if (!last) return;
    void tts.speak(last.text, {
      messageIndex: last.idx,
      voice: audioPreferences.voice.value || undefined,
      rate: audioPreferences.rate.value,
    });
  }

  /** A11y: update a polite live region (only when TTS is not already speaking). */
  function announceForScreenReader(now: boolean | undefined, prev: boolean | undefined) {
    if (!justFinished(now, prev)) return;
    if ((audioPreferences.autoRead.value || voiceConversationActive.value) && tts.supported.value) {
      return;
    }
    const last = lastAssistantText();
    if (!last) return;
    const plain = last.text
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .replace(/[#>*_~]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!plain) return;
    const capped = plain.length > 1500 ? plain.slice(0, 1500) + '…' : plain;
    a11yReplyAnnouncement.value = '';
    void nextTick(() => {
      a11yReplyAnnouncement.value = capped;
    });
  }

  /** Artifacts/Canvas: register any artifacts produced during the finished turn. */
  function registerArtifactsOnFinish(now: boolean | undefined, prev: boolean | undefined) {
    if (prev && !now) {
      for (const m of messages.value) artifactsController.registerArtifacts(m.artifacts);
    }
  }

  /** Drop the transient "aborted" assistant placeholder once streaming settles. */
  function pruneTransientOnFinish(now: boolean | undefined, prev: boolean | undefined) {
    if (!now && prev) removeTransientAssistantMessages();
  }

  watch(loading, (now, prev) => {
    autoReadLastReply(now, prev);
    announceForScreenReader(now, prev);
    registerArtifactsOnFinish(now, prev);
    pruneTransientOnFinish(now, prev);
  });

  return { a11yReplyAnnouncement };
}
