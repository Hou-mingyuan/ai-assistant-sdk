/**
 * useTextToSpeech
 * ---------------
 * 浏览器原生 SpeechSynthesis 朗读 composable。
 *
 * 设计要点：
 * - 完全基于 `window.speechSynthesis`，无第三方依赖、零网络流量；
 *   不支持的环境（如 jsdom 单测）`supported.value === false`，所有动作变成
 *   no-op，避免组件层加大量 if 判断。
 * - 同一时刻只朗读一条消息：再次调用 `speak()` 会先 `cancel()` 当前
 *   utterance，保证用户体验「点击 = 切换」而不是排队。
 * - `currentMessageIndex` 暴露给 UI 用来高亮当前朗读的消息气泡。
 * - 朗读前会剥离 Markdown 语法字符（`*` `_` `` ` `` `#` 等）和代码块，
 *   避免 TTS 把 markdown 标记一字一句念出来。
 * - 自动按文本主要字符集选择语言（zh-CN / ja-JP / ko-KR / en-US），
 *   覆盖宿主用户没显式选配音的常见场景。
 * - voice 选择优先匹配 lang 前缀，匹配不到则交由浏览器选择默认音色。
 */
import { computed, onBeforeUnmount, ref } from 'vue';

export interface TtsSpeakOptions {
  /** 用于 UI 高亮的消息序号；不传则不会写入 currentMessageIndex */
  messageIndex?: number;
  /** 强制覆盖语言（BCP47），如 'zh-CN'。不传则按文本启发式判断 */
  lang?: string;
  /** 语速 0.1 - 10，默认 1 */
  rate?: number;
  /** 音调 0 - 2，默认 1 */
  pitch?: number;
  /** 音量 0 - 1，默认 1 */
  volume?: number;
}

const MAX_TTS_CHARS = 4000;

function stripMarkdownForSpeech(text: string): string {
  if (!text) return '';
  return text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/(\*{1,3}|_{1,3})(.+?)\1/g, '$2')
    .replace(/~~(.+?)~~/g, '$1')
    .replace(/^\s*>\s?/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/<\/?[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function detectLang(text: string): string {
  const sample = text.slice(0, 400);
  const cjk = (sample.match(/[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/g) || []).length;
  const hira = (sample.match(/[\u3040-\u309f]/g) || []).length;
  const kata = (sample.match(/[\u30a0-\u30ff]/g) || []).length;
  const hangul = (sample.match(/[\uac00-\ud7af]/g) || []).length;
  const latin = (sample.match(/[a-zA-Z]/g) || []).length;

  if (hangul > 0 && hangul >= cjk) return 'ko-KR';
  if (hira + kata > 0 && hira + kata >= cjk / 2) return 'ja-JP';
  if (cjk > 0 && cjk >= latin) return 'zh-CN';
  return 'en-US';
}

function pickVoice(synth: SpeechSynthesis, lang: string): SpeechSynthesisVoice | null {
  const voices = synth.getVoices();
  if (!voices?.length) return null;
  const prefix = lang.split('-')[0].toLowerCase();
  const exact = voices.find((v) => v.lang?.toLowerCase() === lang.toLowerCase());
  if (exact) return exact;
  const partial = voices.find((v) => v.lang?.toLowerCase().startsWith(prefix));
  return partial ?? null;
}

export function useTextToSpeech() {
  const supported = computed(() => {
    if (typeof window === 'undefined') return false;
    const synth = (window as unknown as { speechSynthesis?: unknown }).speechSynthesis;
    const ctor = (window as unknown as { SpeechSynthesisUtterance?: unknown }).SpeechSynthesisUtterance;
    return synth != null && typeof ctor === 'function';
  });
  const speaking = ref(false);
  const paused = ref(false);
  const currentMessageIndex = ref<number | null>(null);
  let voicesReadyTimer: number | null = null;

  function ensureVoicesLoaded(synth: SpeechSynthesis): Promise<void> {
    if (synth.getVoices().length > 0) return Promise.resolve();
    return new Promise((resolve) => {
      const cleanup = () => {
        synth.removeEventListener('voiceschanged', onChange);
        if (voicesReadyTimer != null) {
          clearTimeout(voicesReadyTimer);
          voicesReadyTimer = null;
        }
      };
      const onChange = () => {
        cleanup();
        resolve();
      };
      synth.addEventListener('voiceschanged', onChange);
      voicesReadyTimer = window.setTimeout(() => {
        cleanup();
        resolve();
      }, 800);
    });
  }

  async function speak(rawText: string, opts: TtsSpeakOptions = {}) {
    if (!supported.value) return;
    const text = stripMarkdownForSpeech(rawText).slice(0, MAX_TTS_CHARS);
    if (!text) return;
    stop();
    const synth = window.speechSynthesis;
    await ensureVoicesLoaded(synth);
    const lang = opts.lang ?? detectLang(text);
    const utt = new SpeechSynthesisUtterance(text);
    utt.lang = lang;
    utt.rate = opts.rate ?? 1;
    utt.pitch = opts.pitch ?? 1;
    utt.volume = opts.volume ?? 1;
    const voice = pickVoice(synth, lang);
    if (voice) utt.voice = voice;
    utt.onstart = () => {
      speaking.value = true;
      paused.value = false;
    };
    utt.onend = () => {
      speaking.value = false;
      paused.value = false;
      currentMessageIndex.value = null;
    };
    utt.onerror = () => {
      speaking.value = false;
      paused.value = false;
      currentMessageIndex.value = null;
    };
    if (opts.messageIndex != null) currentMessageIndex.value = opts.messageIndex;
    speaking.value = true;
    synth.speak(utt);
  }

  function stop() {
    if (!supported.value) return;
    try {
      window.speechSynthesis.cancel();
    } catch {
      /* ignore */
    }
    speaking.value = false;
    paused.value = false;
    currentMessageIndex.value = null;
  }

  function pause() {
    if (!supported.value || !speaking.value) return;
    try {
      window.speechSynthesis.pause();
      paused.value = true;
    } catch {
      /* ignore */
    }
  }

  function resume() {
    if (!supported.value || !paused.value) return;
    try {
      window.speechSynthesis.resume();
      paused.value = false;
    } catch {
      /* ignore */
    }
  }

  /**
   * 同一条消息上点击行为：
   * - 未在朗读 / 朗读其它条 → 朗读这条
   * - 正在朗读这条        → 停止
   */
  function toggleMessage(text: string, messageIndex: number, opts: Omit<TtsSpeakOptions, 'messageIndex'> = {}) {
    if (speaking.value && currentMessageIndex.value === messageIndex) {
      stop();
    } else {
      void speak(text, { ...opts, messageIndex });
    }
  }

  onBeforeUnmount(() => {
    stop();
  });

  return {
    supported,
    speaking,
    paused,
    currentMessageIndex,
    speak,
    stop,
    pause,
    resume,
    toggleMessage,
  };
}
