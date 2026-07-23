import { afterEach, describe, expect, it, vi } from 'vitest';

const provide = vi.fn();
const mount = vi.fn();
const unmount = vi.fn();

vi.mock('vue', () => ({
  createApp: () => ({ provide, mount, unmount }),
  reactive: <T extends object>(value: T) => value,
}));

vi.mock('./components/AiAssistant.vue', () => ({ default: {} }));

import type { AiAssistantOptions } from './index';
import './web-component';

type TestElement = HTMLElement & { _options: AiAssistantOptions | null };

async function mountElement(attributes: Record<string, string>): Promise<TestElement> {
  const element = document.createElement('ai-assistant') as TestElement;
  for (const [name, value] of Object.entries(attributes)) {
    element.setAttribute(name, value);
  }
  const ready = new Promise<void>((resolve) => {
    element.addEventListener('ai-assistant:ready', () => resolve(), { once: true });
  });
  document.body.appendChild(element);
  await ready;
  return element;
}

describe('AiAssistant Web Component attributes', () => {
  afterEach(() => {
    document.body.replaceChildren();
    vi.clearAllMocks();
  });

  it('keeps legacy endpoint and token aliases when canonical aliases are absent', async () => {
    const element = await mountElement({ endpoint: '/legacy-api', token: 'legacy-token' });

    expect(element._options?.baseUrl).toBe('/legacy-api');
    expect(element._options?.accessToken).toBe('legacy-token');
  });

  it('prefers canonical aliases and falls back when they are removed', async () => {
    const element = await mountElement({
      endpoint: '/legacy-api',
      'base-url': '/canonical-api',
      token: 'legacy-token',
      'access-token': 'canonical-token',
    });

    expect(element._options?.baseUrl).toBe('/canonical-api');
    expect(element._options?.accessToken).toBe('canonical-token');

    element.removeAttribute('base-url');
    element.removeAttribute('access-token');

    expect(element._options?.baseUrl).toBe('/legacy-api');
    expect(element._options?.accessToken).toBe('legacy-token');
  });
});
