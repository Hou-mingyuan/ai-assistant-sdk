export function appendVoiceTranscript(current: string, transcript: string): string {
  const cleanTranscript = transcript.trim();
  if (!cleanTranscript) return current;
  const cleanCurrent = current.trim();
  return cleanCurrent ? `${cleanCurrent} ${cleanTranscript}` : cleanTranscript;
}

export function shouldAutoSendVoiceTranscript(state: {
  active: boolean;
  mode: 'translate' | 'summarize' | 'chat';
  hasBaseUrl: boolean;
  loading: boolean;
  transcript: string;
}): boolean {
  return (
    state.active &&
    state.mode === 'chat' &&
    state.hasBaseUrl &&
    !state.loading &&
    state.transcript.trim().length > 0
  );
}
