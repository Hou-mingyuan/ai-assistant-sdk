import { describe, expect, it, vi } from 'vitest';
import { useCapabilityToggles } from './useCapabilityToggles';

describe('useCapabilityToggles', () => {
  it('starts with every capability disabled', () => {
    const c = useCapabilityToggles({ notify: vi.fn() });
    expect(c.deepThinkEnabled.value).toBe(false);
    expect(c.webSearchEnabled.value).toBe(false);
    expect(c.fastReplyEnabled.value).toBe(false);
  });

  it('toggles deep-think and notifies on and off', () => {
    const notify = vi.fn();
    const c = useCapabilityToggles({ notify });
    c.setDeepThinkEnabled(true);
    expect(c.deepThinkEnabled.value).toBe(true);
    expect(notify).toHaveBeenLastCalledWith(expect.stringContaining('深度思考已开启'), 1800);
    c.setDeepThinkEnabled(false);
    expect(c.deepThinkEnabled.value).toBe(false);
    expect(notify).toHaveBeenLastCalledWith('深度思考已关闭', 1800);
  });

  it('toggles web-search and notifies', () => {
    const notify = vi.fn();
    const c = useCapabilityToggles({ notify });
    c.setWebSearchEnabled(true);
    expect(c.webSearchEnabled.value).toBe(true);
    expect(notify).toHaveBeenLastCalledWith(expect.stringContaining('联网搜索已开启'), 1800);
  });

  it('toggles fast-reply and notifies', () => {
    const notify = vi.fn();
    const c = useCapabilityToggles({ notify });
    c.setFastReplyEnabled(true);
    expect(c.fastReplyEnabled.value).toBe(true);
    expect(notify).toHaveBeenLastCalledWith(expect.stringContaining('快速回答已开启'), 1800);
  });
});
