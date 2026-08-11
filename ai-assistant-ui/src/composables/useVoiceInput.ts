import { ref, onUnmounted } from 'vue';

type SpeechRecognitionEvent = Event & {
  results: SpeechRecognitionResultList;
  resultIndex?: number;
};
type SpeechRecognitionErrorEvent = Event & { error: string };

interface SpeechRecognitionInstance extends EventTarget {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((ev: SpeechRecognitionEvent) => void) | null;
  onerror: ((ev: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
}

export interface VoiceInputStartOptions {
  lang?: string;
  continuous?: boolean;
  interimResults?: boolean;
}

export function collectSpeechTranscript(
  results: SpeechRecognitionResultList,
  resultIndex = 0,
): { finalText: string; interimText: string } {
  const finalParts: string[] = [];
  const interimParts: string[] = [];
  for (let i = resultIndex; i < results.length; i++) {
    const result = results[i];
    const text = result?.[0]?.transcript?.trim();
    if (!text) continue;
    if (result.isFinal) finalParts.push(text);
    else interimParts.push(text);
  }
  return {
    finalText: finalParts.join(' ').trim(),
    interimText: interimParts.join(' ').trim(),
  };
}

function getSpeechRecognition(): (new () => SpeechRecognitionInstance) | null {
  const w = window as unknown as Record<string, unknown>;
  return (w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null) as
    (new () => SpeechRecognitionInstance) | null;
}

export function useVoiceInput(onTranscript: (text: string) => void) {
  const recording = ref(false);
  const supported = ref(!!getSpeechRecognition());
  const interimTranscript = ref('');
  const lastError = ref<string | null>(null);
  let recognition: SpeechRecognitionInstance | null = null;

  function start(options: string | VoiceInputStartOptions = 'zh-CN') {
    const Ctor = getSpeechRecognition();
    if (!Ctor) return;
    const opts = typeof options === 'string' ? { lang: options } : options;

    stop();
    recognition = new Ctor();
    recognition.lang = opts.lang ?? 'zh-CN';
    recognition.interimResults = opts.interimResults ?? false;
    recognition.continuous = opts.continuous ?? false;
    lastError.value = null;
    interimTranscript.value = '';

    recognition.onresult = (ev) => {
      const collected = collectSpeechTranscript(ev.results, ev.resultIndex ?? 0);
      interimTranscript.value = collected.interimText;
      if (collected.finalText) onTranscript(collected.finalText);
    };
    recognition.onerror = () => {
      lastError.value = 'recognition-error';
      recording.value = false;
    };
    recognition.onend = () => {
      interimTranscript.value = '';
      recording.value = false;
    };

    recognition.start();
    recording.value = true;
  }

  function stop() {
    if (recognition) {
      recognition.abort();
      recognition = null;
    }
    interimTranscript.value = '';
    recording.value = false;
  }

  function toggle(options?: string | VoiceInputStartOptions) {
    if (recording.value) stop();
    else start(options);
  }

  onUnmounted(stop);

  return { recording, supported, interimTranscript, lastError, start, stop, toggle };
}
