import type { Ref } from 'vue';
import type { AiAssistantOptions } from '../index';
import { fetchHealth, type HealthResult } from '../utils/api';

export interface RefreshWebSearchDiagnosticsOptions {
  options: AiAssistantOptions;
  webSearchDiagnosticsText: Ref<string>;
  webSearchStats?: Ref<Record<string, number> | null>;
  fetchHealth?: typeof fetchHealth;
}

export async function refreshWebSearchDiagnostics(
  opts: RefreshWebSearchDiagnosticsOptions,
): Promise<void> {
  opts.webSearchDiagnosticsText.value = '—';
  if (!opts.options.baseUrl) return;
  const fetchHealthImpl = opts.fetchHealth ?? fetchHealth;
  try {
    const health = await fetchHealthImpl(opts.options.baseUrl, opts.options.accessToken, true);
    if (!health.success) return;
    if (opts.webSearchStats) {
      opts.webSearchStats.value = health.webSearchStats ?? null;
    }
    opts.webSearchDiagnosticsText.value = formatWebSearchDiagnostics(health);
  } catch {
    opts.webSearchDiagnosticsText.value = 'unavailable';
  }
}

function formatWebSearchDiagnostics(health: HealthResult): string {
  const provider = health.webSearchProvider || 'duckduckgo';
  const configured = health.webSearchStableProviderConfigured ? 'configured' : 'fallback';
  const max = health.webSearchMaxResults ?? 5;
  const stats = health.webSearchStats;
  const statText = stats?.attempts
    ? ` · ${stats.successes ?? 0}/${stats.attempts} ok · ${stats.averageDurationMs ?? 0}ms avg`
    : '';
  const probeText =
    typeof health.webSearchProbe === 'string'
      ? ` · probe ${health.webSearchProbe}`
      : health.webSearchProbe?.status
        ? ` · probe ${health.webSearchProbe.status}`
        : '';
  return `${provider} · ${configured} · ${max}${statText}${probeText}`;
}
