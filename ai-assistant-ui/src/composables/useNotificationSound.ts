import { ref } from 'vue';

/**
 * Notification chime + enable flag extracted from AiAssistant.vue (behaviour unchanged).
 *
 * Plays a short two-note WebAudio chime when {@link soundEnabled} is true; silently
 * no-ops when disabled or when {@link AudioContext} is unavailable (e.g. SSR / tests).
 */
export function useNotificationSound() {
  const soundEnabled = ref(false);

  function playNotificationSound() {
    if (!soundEnabled.value) return;
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.setValueAtTime(1047, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.25);
      osc.onended = () => ctx.close();
    } catch {
      /* AudioContext may not be available */
    }
  }

  return { soundEnabled, playNotificationSound };
}
