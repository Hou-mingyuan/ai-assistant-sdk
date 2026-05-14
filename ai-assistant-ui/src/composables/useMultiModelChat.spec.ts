import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ref } from 'vue';

vi.mock('../utils/api', () => {
  const streamMocks = new Map<string, () => AsyncGenerator<string>>();
  const streamChat = vi.fn(async function* (
    _baseUrl: string,
    payload: { model?: string },
    _token?: string,
    _signal?: AbortSignal,
  ): AsyncGenerator<string> {
    const generator = streamMocks.get(payload.model ?? '');
    if (!generator) throw new Error(`No mock for model ${payload.model}`);
    const it = generator();
    for await (const chunk of it) yield chunk;
  });
  return {
    streamChat,
    __setStreamMock: (model: string, fn: () => AsyncGenerator<string>) =>
      streamMocks.set(model, fn),
    __resetStreamMocks: () => streamMocks.clear(),
  };
});

import { useMultiModelChat } from './useMultiModelChat';
import * as apiModule from '../utils/api';

interface MockedApi {
  __setStreamMock: (model: string, fn: () => AsyncGenerator<string>) => void;
  __resetStreamMocks: () => void;
}

const api = apiModule as unknown as MockedApi;

function makeStream(chunks: string[]): () => AsyncGenerator<string> {
  return async function* gen() {
    for (const c of chunks) {
      yield c;
      await Promise.resolve();
    }
  };
}

describe('useMultiModelChat', () => {
  beforeEach(() => {
    api.__resetStreamMocks();
    vi.clearAllMocks();
  });

  it('toggleModel adds and removes models, respecting maxColumns', () => {
    const baseUrl = ref('/x');
    const mm = useMultiModelChat({ baseUrl, maxColumns: 2 });
    mm.toggleModel('a');
    mm.toggleModel('b');
    mm.toggleModel('c'); // dropped: at cap
    expect(mm.selectedModels.value).toEqual(['a', 'b']);
    mm.toggleModel('a');
    expect(mm.selectedModels.value).toEqual(['b']);
  });

  it('setSelectedModels truncates to maxColumns', () => {
    const baseUrl = ref('/x');
    const mm = useMultiModelChat({ baseUrl, maxColumns: 2 });
    mm.setSelectedModels(['x', 'y', 'z']);
    expect(mm.selectedModels.value).toEqual(['x', 'y']);
  });

  it('start() rejects empty prompts and empty selection silently', async () => {
    const baseUrl = ref('/x');
    const mm = useMultiModelChat({ baseUrl, maxColumns: 4 });
    await mm.start('   ');
    expect(mm.columns.value).toHaveLength(0);
    mm.setSelectedModels(['m1']);
    await mm.start('');
    expect(mm.columns.value).toHaveLength(0);
  });

  it('runs parallel streams and gathers per-column final content', async () => {
    api.__setStreamMock('m1', makeStream(['Hel', 'lo']));
    api.__setStreamMock('m2', makeStream(['Hi ', 'there']));
    const baseUrl = ref('/x');
    const mm = useMultiModelChat({ baseUrl, maxColumns: 4 });
    mm.setSelectedModels(['m1', 'm2']);
    await mm.start('greet');
    expect(mm.columns.value).toHaveLength(2);
    expect(mm.columns.value.map((c) => c.model)).toEqual(['m1', 'm2']);
    /* final flush in finally — content should be present */
    expect(mm.columns.value.find((c) => c.model === 'm1')!.content).toBe('Hello');
    expect(mm.columns.value.find((c) => c.model === 'm2')!.content).toBe('Hi there');
    expect(mm.isRunning.value).toBe(false);
  });

  it('captures per-column errors without affecting siblings', async () => {
    api.__setStreamMock('good', makeStream(['ok']));
    api.__setStreamMock('bad', async function* () {
      yield 'partial ';
      throw new Error('boom');
    });
    const baseUrl = ref('/x');
    const mm = useMultiModelChat({ baseUrl, maxColumns: 4 });
    mm.setSelectedModels(['good', 'bad']);
    await mm.start('q');
    const goodCol = mm.columns.value.find((c) => c.model === 'good')!;
    const badCol = mm.columns.value.find((c) => c.model === 'bad')!;
    expect(goodCol.content).toBe('ok');
    expect(goodCol.error).toBe('');
    expect(badCol.error).toMatch(/boom/);
    expect(badCol.loading).toBe(false);
  });

  it('clearAll resets all state', async () => {
    api.__setStreamMock('m', makeStream(['x']));
    const baseUrl = ref('/x');
    const mm = useMultiModelChat({ baseUrl, maxColumns: 4 });
    mm.setSelectedModels(['m']);
    await mm.start('p');
    expect(mm.columns.value).toHaveLength(1);
    mm.clearAll();
    expect(mm.columns.value).toHaveLength(0);
    expect(mm.lastPrompt.value).toBe('');
  });

  it('parseChunk hook receives the accumulated buffer', async () => {
    api.__setStreamMock('m', makeStream(['<think>plan</think>final answer']));
    const baseUrl = ref('/x');
    const seen: string[] = [];
    const mm = useMultiModelChat({
      baseUrl,
      maxColumns: 4,
      parseChunk: (raw: string) => {
        seen.push(raw);
        return { content: raw.replace(/<think>.*?<\/think>/g, ''), thinking: '' };
      },
    });
    mm.setSelectedModels(['m']);
    await mm.start('go');
    expect(seen.length).toBeGreaterThan(0);
    expect(mm.columns.value[0].content).toBe('final answer');
  });
});
