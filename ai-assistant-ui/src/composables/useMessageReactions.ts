import type { Ref } from 'vue';

export interface ReactionPayload {
  messageIndex: number;
  emoji: string;
  toggled: boolean;
}

export interface ReactionMessage {
  reactions?: { selected?: string; counts?: Record<string, number> };
}

interface UseMessageReactionsDeps<TMessage extends ReactionMessage> {
  messages: Ref<TMessage[]>;
  onReaction?: (payload: ReactionPayload) => void;
  emitReaction: (payload: ReactionPayload) => void;
}

export function useMessageReactions<TMessage extends ReactionMessage>(
  deps: UseMessageReactionsDeps<TMessage>,
) {
  function setReaction(messageIndex: number, emoji: string, toggled: boolean) {
    const msg = deps.messages.value[messageIndex];
    if (!msg) return;

    const prev = msg.reactions ?? {};
    const counts: Record<string, number> = { ...(prev.counts ?? {}) };
    if (toggled) {
      counts[emoji] = Math.max(0, (counts[emoji] ?? 0) - 1);
      msg.reactions = { selected: '', counts };
    } else {
      if (prev.selected && prev.selected !== emoji) {
        counts[prev.selected] = Math.max(0, (counts[prev.selected] ?? 0) - 1);
      }
      counts[emoji] = (counts[emoji] ?? 0) + 1;
      msg.reactions = { selected: emoji, counts };
    }

    const payload = { messageIndex, emoji, toggled };
    try {
      deps.onReaction?.(payload);
    } catch (e) {
      void e;
    }
    deps.emitReaction(payload);
  }

  return {
    setReaction,
  };
}
