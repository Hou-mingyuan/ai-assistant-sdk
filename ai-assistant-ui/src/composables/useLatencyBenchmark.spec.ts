import { describe, expect, it, vi } from 'vitest';

import { createLatencyBenchmarkRunner, summarizeBenchmarkRows } from './useLatencyBenchmark';

describe('useLatencyBenchmark', () => {
  it('runs the same benchmark prompts against each selected model', async () => {
    const request = vi.fn(async (_model: string, prompt: string) => ({
      success: true,
      result: `ok:${prompt}`,
      elapsedMs: 120,
    }));
    const runner = createLatencyBenchmarkRunner({
      request,
      now: (() => {
        let value = 1000;
        return () => (value += 120);
      })(),
    });

    const rows = await runner.run({
      models: ['MiniMax-M2.7', 'MiniMax-M2'],
      prompts: ['你是什么模型', '总结这段文字的要点'],
    });

    expect(request).toHaveBeenCalledTimes(4);
    expect(rows).toHaveLength(4);
    expect(rows[0]).toEqual(
      expect.objectContaining({
        model: 'MiniMax-M2.7',
        promptLabel: '短问',
        success: true,
        elapsedMs: 120,
      }),
    );
  });

  it('summarizes benchmark rows by average latency and success rate', () => {
    const summary = summarizeBenchmarkRows([
      { model: 'MiniMax-M2.7', promptLabel: '短问', success: true, elapsedMs: 900 },
      { model: 'MiniMax-M2.7', promptLabel: '长问', success: false, elapsedMs: 1900 },
      { model: 'MiniMax-M2', promptLabel: '短问', success: true, elapsedMs: 300 },
      { model: 'MiniMax-M2', promptLabel: '长问', success: true, elapsedMs: 700 },
    ]);

    expect(summary).toEqual([
      { model: 'MiniMax-M2', averageMs: 500, successRate: 100, samples: 2 },
      { model: 'MiniMax-M2.7', averageMs: 1400, successRate: 50, samples: 2 },
    ]);
  });
});
