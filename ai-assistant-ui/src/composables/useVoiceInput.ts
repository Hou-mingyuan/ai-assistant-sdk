import { ref, onUnmounted } from 'vue';

type SpeechRecognitionEvent = Event & { results: SpeechRecognitionResultList };
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

function getSpeechRecognition(): (new () => SpeechRecognitionInstance) | null {
  const w = window as unknown as Record<string, unknown>;
  return (w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null) as
    | (new () => SpeechRecognitionInstance)
    | null;
}

export function useVoiceInput(onTranscript: (text: string) => void) {
  const recording = ref(false);
  const supported = ref(!!getSpeechRecognition());
  let recognition: SpeechRecognitionInstance | null = null;

  function start(lang = 'zh-CN') {
    const Ctor = getSpeechRecognition();
    if (!Ctor) return;

    stop();
    recognition = new Ctor();
    recognition.lang = lang;
    recognition.interimResults = false;
    recognition.continuous = false;

    recognition.onresult = (ev) => {
      const last = ev.results[ev.results.length - 1];
      if (last?.[0]) onTranscript(last[0].transcript);
    };
    recognition.onerror = () => {
      recording.value = false;
    };
    recognition.onend = () => {
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
    recording.value = false;
  }

  function toggle(lang?: string) {
    if (recording.value) stop();
    else start(lang);
  }

  onUnmounted(stop);

  return { recording, supported, start, stop, toggle };
}
