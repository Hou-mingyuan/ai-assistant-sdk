import { ref } from 'vue';
import { describe, expect, it, vi } from 'vitest';

import { useMessageReactions } from './useMessageReactions';

describe('useMessageReactions', () => {
  it('selects a reaction, increments the count, and notifies listeners', () => {
    const onReaction = vi.fn();
    const emitReaction = vi.fn();
    const messages = ref([{ role: 'assistant' as const, content: 'hello' }]);

    const reactions = useMessageReactions({ messages, onReaction, emitReaction });
    reactions.setReaction(0, '⭐', false);

    expect(messages.value[0]?.reactions).toEqual({ selected: '⭐', counts: { '⭐': 1 } });
    expect(onReaction).toHaveBeenCalledWith({ messageIndex: 0, emoji: '⭐', toggled: false });
    expect(emitReaction).toHaveBeenCalledWith({ messageIndex: 0, emoji: '⭐', toggled: false });
  });

  it('clears the selected reaction and decrements without going below zero', () => {
    const messages = ref([
      {
        role: 'assistant' as const,
        content: 'hello',
        reactions: { selected: '⭐', counts: { '⭐': 1 } },
      },
    ]);

    const reactions = useMessageReactions({ messages, emitReaction: vi.fn() });
    reactions.setReaction(0, '⭐', true);
    reactions.setReaction(0, '⭐', true);

    expect(messages.value[0]?.reactions).toEqual({ selected: '', counts: { '⭐': 0 } });
  });

  it('moves the selected reaction from the previous emoji to the next one', () => {
    const messages = ref([
      {
        role: 'assistant' as const,
        content: 'hello',
        reactions: { selected: '❤', counts: { '❤': 2, '📌': 1 } },
      },
    ]);

    const reactions = useMessageReactions({ messages, emitReaction: vi.fn() });
    reactions.setReaction(0, '📌', false);

    expect(messages.value[0]?.reactions).toEqual({
      selected: '📌',
      counts: { '❤': 1, '📌': 2 },
    });
  });

  it('ignores missing message indexes without emitting', () => {
    const emitReaction = vi.fn();
    const reactions = useMessageReactions({ messages: ref([]), emitReaction });

    reactions.setReaction(0, '⭐', false);

    expect(emitReaction).not.toHaveBeenCalled();
  });

  it('swallows host callback failures but still emits the component event', () => {
    const emitReaction = vi.fn();
    const reactions = useMessageReactions({
      messages: ref([{ role: 'assistant' as const, content: 'hello' }]),
      onReaction: () => {
        throw new Error('host failed');
      },
      emitReaction,
    });

    expect(() => reactions.setReaction(0, '⭐', false)).not.toThrow();
    expect(emitReaction).toHaveBeenCalledWith({ messageIndex: 0, emoji: '⭐', toggled: false });
  });
});
