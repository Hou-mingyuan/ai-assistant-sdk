import { ref, watch } from 'vue';

export interface AudioPreferenceKeys {
  voiceKey: string;
  rateKey: string;
  autoReadKey: string;
}

export interface AudioPreferencePatch {
  voice?: string;
  rate?: number;
  autoRead?: boolean;
}

function loadString(key: string, fallback: string): string {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

export function useAudioPreferences(keys: AudioPreferenceKeys) {
  const voice = ref(loadString(keys.voiceKey, ''));
  const rate = ref(parseFloat(loadString(keys.rateKey, '1')) || 1);
  const autoRead = ref(loadString(keys.autoReadKey, '0') === '1');

  watch(voice, (v) => {
    try {
      localStorage.setItem(keys.voiceKey, v);
    } catch {
      /* ignore */
    }
  });
  watch(rate, (v) => {
    try {
      localStorage.setItem(keys.rateKey, String(v));
    } catch {
      /* ignore */
    }
  });
  watch(autoRead, (v) => {
    try {
      localStorage.setItem(keys.autoReadKey, v ? '1' : '0');
    } catch {
      /* ignore */
    }
  });

  function update(patch: AudioPreferencePatch) {
    if (patch.voice !== undefined) voice.value = patch.voice;
    if (patch.rate !== undefined) rate.value = patch.rate;
    if (patch.autoRead !== undefined) autoRead.value = patch.autoRead;
  }

  return {
    voice,
    rate,
    autoRead,
    update,
  };
}
