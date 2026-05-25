import { ref } from 'vue';
import { postChat, type ChatResult } from '../utils/api';

export interface BenchmarkPrompt {
  label: string;
  text: string;
}

export interface LatencyBenchmarkRow {
  model: string;
  promptLabel: string;
  success: boolean;
  elapsedMs: number;
  error?: string;
}

export interface LatencyBenchmarkSummaryRow {
  model: string;
  averageMs: number;
  successRate: number;
  samples: number;
}

export interface LatencyBenchmarkRunOptions {
  models: string[];
  prompts?: string[];
}

interface BenchmarkRunnerDeps {
  request: (
    model: string,
    prompt: string,
  ) => Promise<ChatResult & { elapsedMs?: number; error?: string }>;
  now?: () => number;
}

const DEFAULT_BENCHMARK_PROMPTS: BenchmarkPrompt[] = [
  { label: '短问', text: '你是什么模型？请用一句话回答。' },
  { label: '长问', text: '请用三点总结：为什么首 token 延迟会影响聊天产品体验？' },
];

export function summarizeBenchmarkRows(rows: LatencyBenchmarkRow[]): LatencyBenchmarkSummaryRow[] {
  const grouped = new Map<string, LatencyBenchmarkRow[]>();
  for (const row of rows) {
    grouped.set(row.model, [...(grouped.get(row.model) ?? []), row]);
  }
  return [...grouped.entries()]
    .map(([model, samples]) => {
      const averageMs = Math.round(
        samples.reduce((sum, row) => sum + row.elapsedMs, 0) / Math.max(1, samples.length),
      );
      const successRate = Math.round(
        (samples.filter((row) => row.success).length / Math.max(1, samples.length)) * 100,
      );
      return { model, averageMs, successRate, samples: samples.length };
    })
    .sort((a, b) => a.averageMs - b.averageMs);
}

export function formatBenchmarkSummary(rows: LatencyBenchmarkRow[]): string {
  return summarizeBenchmarkRows(rows)
    .map((row) => `${row.model} avg ${formatMs(row.averageMs)} · success ${row.successRate}%`)
    .join(' / ');
}

export function createLatencyBenchmarkRunner(deps: BenchmarkRunnerDeps) {
  const now = deps.now ?? (() => performance.now());

  async function run(options: LatencyBenchmarkRunOptions): Promise<LatencyBenchmarkRow[]> {
    const prompts = normalizePrompts(options.prompts);
    const models = options.models.map((model) => model.trim()).filter(Boolean);
    const rows: LatencyBenchmarkRow[] = [];
    for (const model of models) {
      for (const prompt of prompts) {
        const startedAt = now();
        try {
          const response = await deps.request(model, prompt.text);
          const elapsedMs = Math.round(response.elapsedMs ?? now() - startedAt);
          rows.push({
            model,
            promptLabel: prompt.label,
            success: response.success === true,
            elapsedMs,
            error: response.success ? undefined : response.error,
          });
        } catch (error) {
          rows.push({
            model,
            promptLabel: prompt.label,
            success: false,
            elapsedMs: Math.round(now() - startedAt),
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }
    return rows;
  }

  return { run };
}

export function useLatencyBenchmark() {
  const benchmarkBusy = ref(false);
  const benchmarkRows = ref<LatencyBenchmarkRow[]>([]);
  const benchmarkSummary = ref('');

  async function runBenchmark(baseUrl: string, token: string | undefined, models: string[]) {
    if (!baseUrl || benchmarkBusy.value) return;
    benchmarkBusy.value = true;
    try {
      const localRunner = createLatencyBenchmarkRunner({
        request: async (model, prompt) => {
          const startedAt = performance.now();
          const response = await postChat(baseUrl, { action: 'chat', text: prompt, model }, token);
          return { ...response, elapsedMs: Math.round(performance.now() - startedAt) };
        },
      });
      benchmarkRows.value = await localRunner.run({ models: models.slice(0, 3) });
      benchmarkSummary.value = formatBenchmarkSummary(benchmarkRows.value);
    } finally {
      benchmarkBusy.value = false;
    }
  }

  return { benchmarkBusy, benchmarkRows, benchmarkSummary, runBenchmark };
}

function normalizePrompts(prompts?: string[]): BenchmarkPrompt[] {
  if (!prompts?.length) return DEFAULT_BENCHMARK_PROMPTS;
  return prompts.map((text, index) => ({ label: index === 0 ? '短问' : `样本${index + 1}`, text }));
}

function formatMs(value: number): string {
  return value < 1000 ? `${value}ms` : `${(value / 1000).toFixed(1)}s`;
}
