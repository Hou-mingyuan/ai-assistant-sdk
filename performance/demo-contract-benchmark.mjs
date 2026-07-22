import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { performance } from 'node:perf_hooks';

const baseUrl = process.argv[2] || 'http://127.0.0.1:8080/ai-assistant';
const outputPath = process.argv[3];

function percentile(values, fraction) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)];
}

function summarize(values) {
  return {
    samples: values.length,
    meanMs: Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2)),
    p50Ms: Number(percentile(values, 0.5).toFixed(2)),
    p95Ms: Number(percentile(values, 0.95).toFixed(2)),
    p99Ms: Number(percentile(values, 0.99).toFixed(2)),
    maxMs: Number(Math.max(...values).toFixed(2)),
  };
}

async function healthSample() {
  const started = performance.now();
  const response = await fetch(`${baseUrl}/health`, { signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error(`health returned ${response.status}`);
  await response.arrayBuffer();
  return performance.now() - started;
}

async function chatSample(index) {
  const started = performance.now();
  const response = await fetch(`${baseUrl}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Tenant-Id': 'acceptance-performance' },
    body: JSON.stringify({ action: 'chat', text: `performance blocking ${index}` }),
    signal: AbortSignal.timeout(10_000),
  });
  const body = await response.json();
  if (!response.ok || body?.meta?.provider !== 'demo') {
    throw new Error(`chat contract failed: ${response.status} ${JSON.stringify(body)}`);
  }
  return performance.now() - started;
}

async function streamSample(index) {
  const started = performance.now();
  const response = await fetch(`${baseUrl}/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Tenant-Id': 'acceptance-performance' },
    body: JSON.stringify({ action: 'chat', text: `performance stream ${index}` }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok || !response.headers.get('content-type')?.includes('text/event-stream')) {
    throw new Error(`stream contract failed: ${response.status}`);
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let firstEventMs;
  let body = '';
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    body += decoder.decode(value, { stream: true });
    if (firstEventMs === undefined && body.includes('data:')) firstEventMs = performance.now() - started;
  }
  body += decoder.decode();
  if (
    firstEventMs === undefined ||
    !body.includes('[DEMO MODE - deterministic local response, not real AI]') ||
    !body.includes(`performance stream ${index}`)
  ) {
    throw new Error('stream did not deliver the complete Demo SSE contract');
  }
  return firstEventMs;
}

async function measure(sample, count, concurrency) {
  const values = [];
  for (let offset = 0; offset < count; offset += concurrency) {
    const batch = Array.from({ length: Math.min(concurrency, count - offset) }, (_, i) =>
      sample(offset + i),
    );
    values.push(...(await Promise.all(batch)));
  }
  return values;
}

await healthSample();
await chatSample('warmup');
await streamSample('warmup');

const health = summarize(await measure(healthSample, 100, 5));
const chat = summarize(await measure(chatSample, 30, 3));
const sseTtft = summarize(await measure(streamSample, 30, 3));
const thresholds = {
  healthP95Ms: 400,
  demoChatP95Ms: 1_000,
  demoSseTtftP95Ms: 1_000,
};
const passed =
  health.p95Ms < thresholds.healthP95Ms &&
  chat.p95Ms < thresholds.demoChatP95Ms &&
  sseTtft.p95Ms < thresholds.demoSseTtftP95Ms;
const result = {
  measuredAt: new Date().toISOString(),
  baseUrl,
  environment: 'Local explicit Demo provider; 5-way health / 3-way chat concurrency',
  scope: 'Demo provider contract only; not a real upstream LLM latency benchmark',
  health,
  demoBlockingChat: chat,
  demoSseTimeToFirstEvent: sseTtft,
  thresholds,
  passed,
};

if (outputPath) {
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
}
console.log(JSON.stringify(result, null, 2));
if (!passed) process.exitCode = 1;
