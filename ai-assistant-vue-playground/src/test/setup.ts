import { vi } from 'vitest';

// Playground mounts AiAssistant via main.ts; tests stub the widget globally.
vi.stubGlobal(
  'fetch',
  vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({ success: true, status: 'running' }),
  })),
);
