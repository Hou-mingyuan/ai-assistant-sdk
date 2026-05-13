import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createApp, defineComponent, h } from 'vue';
import { useTextToSpeech } from './useTextToSpeech';

type TtsApi = ReturnType<typeof useTextToSpeech>;

function mountWithTts(): { api: TtsApi; unmount: () => void } {
  let captured: TtsApi | null = null;
  const Comp = defineComponent({
    setup() {
      captured = useTextToSpeech();
      return () => h('div');
    },
  });
  const host = document.createElement('div');
  const app = createApp(Comp);
  app.mount(host);
  if (!captured) throw new Error('Failed to capture TTS instance');
  return {
    api: captured,
    unmount: () => app.unmount(),
  };
}

interface UtterancePayload {
  text: string;
  lang?: string;
  rate?: number;
  voice?: SpeechSynthesisVoice | null;
  onstart?: () => void;
  onend?: () => void;
  onerror?: () => void;
}

class FakeUtterance implements UtterancePayload {
  text: string;
  lang?: string;
  rate?: number;
  voice?: SpeechSynthesisVoice | null;
  pitch?: number;
  volume?: number;
  onstart?: () => void;
  onend?: () => void;
  onerror?: () => void;
  constructor(text: string) {
    this.text = text;
  }
}

describe('useTextToSpeech', () => {
  const originalSynth = (window as unknown as Record<string, unknown>).speechSynthesis;
  const originalCtor = (window as unknown as Record<string, unknown>).SpeechSynthesisUtterance;
  const utterances: FakeUtterance[] = [];
  let speakSpy: ReturnType<typeof vi.fn>;
  let cancelSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    utterances.length = 0;
    speakSpy = vi.fn((u: FakeUtterance) => {
      utterances.push(u);
      queueMicrotask(() => u.onstart?.());
    });
    cancelSpy = vi.fn();
    const fakeSynth = {
      speak: speakSpy,
      cancel: cancelSpy,
      pause: vi.fn(),
      resume: vi.fn(),
      getVoices: vi.fn(() => [
        { name: 'Z', lang: 'zh-CN', default: true } as SpeechSynthesisVoice,
        { name: 'E', lang: 'en-US', default: false } as SpeechSynthesisVoice,
      ]),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    (window as unknown as Record<string, unknown>).speechSynthesis = fakeSynth;
    (window as unknown as Record<string, unknown>).SpeechSynthesisUtterance = FakeUtterance;
  });

  afterEach(() => {
    (window as unknown as Record<string, unknown>).speechSynthesis = originalSynth;
    (window as unknown as Record<string, unknown>).SpeechSynthesisUtterance = originalCtor;
  });

  it('reports supported when the browser exposes SpeechSynthesis', () => {
    const { api, unmount } = mountWithTts();
    expect(api.supported.value).toBe(true);
    unmount();
  });

  it('reports unsupported when SpeechSynthesis is missing', () => {
    (window as unknown as Record<string, unknown>).speechSynthesis = undefined;
    const { api, unmount } = mountWithTts();
    expect(api.supported.value).toBe(false);
    unmount();
  });

  it('strips markdown / code fences before speaking', async () => {
    const { api, unmount } = mountWithTts();
    await api.speak('Hello **bold** ```code\nx\n``` _italic_ [link](https://x)');
    expect(speakSpy).toHaveBeenCalledTimes(1);
    const u = utterances[0]!;
    expect(u.text).not.toMatch(/```|\*\*|\[link\]/);
    expect(u.text).toContain('Hello');
    expect(u.text).toContain('link');
    unmount();
  });

  it('picks zh-CN voice for CJK heavy text', async () => {
    const { api, unmount } = mountWithTts();
    await api.speak('你好，今天天气很好');
    expect(utterances[0]?.lang).toBe('zh-CN');
    unmount();
  });

  it('toggleMessage stops when called twice on the same index', async () => {
    const { api, unmount } = mountWithTts();
    api.toggleMessage('hello world', 3);
    await Promise.resolve();
    await Promise.resolve();
    expect(speakSpy).toHaveBeenCalledTimes(1);
    expect(api.currentMessageIndex.value).toBe(3);
    api.toggleMessage('hello world', 3);
    expect(cancelSpy).toHaveBeenCalled();
    expect(api.currentMessageIndex.value).toBeNull();
    unmount();
  });

  it('switching to a different index cancels the previous utterance', async () => {
    const { api, unmount } = mountWithTts();
    await api.speak('alpha', { messageIndex: 1 });
    expect(api.currentMessageIndex.value).toBe(1);
    await api.speak('beta', { messageIndex: 2 });
    expect(cancelSpy).toHaveBeenCalled();
    expect(api.currentMessageIndex.value).toBe(2);
    unmount();
  });

  it('stop() is a no-op when SpeechSynthesis is missing', () => {
    (window as unknown as Record<string, unknown>).speechSynthesis = undefined;
    const { api, unmount } = mountWithTts();
    expect(() => api.stop()).not.toThrow();
    unmount();
  });
});
