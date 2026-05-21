import { computed, reactive } from 'vue';
import { beforeEach, describe, expect, it } from 'vitest';

import { useConnectionConfigState } from './useConnectionConfigState';

const t = computed(() => ({
  connectionConfigDefaultApplied: 'Default applied',
}));

function createConnectionConfig(
  options = reactive<{ baseUrl?: string; accessToken?: string }>({}),
) {
  return useConnectionConfigState({ options, t });
}

describe('useConnectionConfigState', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('syncs connection inputs from options', () => {
    const options = reactive({ baseUrl: '/ai', accessToken: 'token' });
    const state = createConnectionConfig(options);
    state.connectionBaseUrlInput.value = '/other';
    state.connectionTokenInput.value = 'other-token';

    state.syncConnectionInputsFromOptions();

    expect(state.connectionBaseUrlInput.value).toBe('/ai');
    expect(state.connectionTokenInput.value).toBe('token');
  });

  it('applies trimmed input values back to options', () => {
    const options = reactive<{ baseUrl?: string; accessToken?: string }>({});
    const state = createConnectionConfig(options);
    state.connectionBaseUrlInput.value = '  /custom-ai  ';
    state.connectionTokenInput.value = '  token  ';

    state.applyConnectionConfigInputs();

    expect(options.baseUrl).toBe('/custom-ai');
    expect(options.accessToken).toBe('token');
  });

  it('maps blank inputs to undefined options', () => {
    const options = reactive<{ baseUrl?: string; accessToken?: string }>({
      baseUrl: '/ai',
      accessToken: 'token',
    });
    const state = createConnectionConfig(options);
    state.connectionBaseUrlInput.value = ' ';
    state.connectionTokenInput.value = '';

    state.applyConnectionConfigInputs();

    expect(options.baseUrl).toBeUndefined();
    expect(options.accessToken).toBeUndefined();
  });

  it('persists or removes values when persistence is enabled', () => {
    const state = createConnectionConfig();
    state.connectionBaseUrlInput.value = '/ai';
    state.connectionTokenInput.value = 'token';

    state.persistConnectionConfigIfEnabled();
    expect(localStorage.getItem(state.connectionBaseUrlStorageKey)).toBe('/ai');
    expect(localStorage.getItem(state.connectionTokenStorageKey)).toBe('token');

    state.connectionBaseUrlInput.value = '';
    state.connectionTokenInput.value = '';
    state.persistConnectionConfigIfEnabled();
    expect(localStorage.getItem(state.connectionBaseUrlStorageKey)).toBeNull();
    expect(localStorage.getItem(state.connectionTokenStorageKey)).toBeNull();
  });

  it('clears persisted values when persistence is disabled', () => {
    localStorage.setItem('ai-assistant-connection-base-url', '/old');
    localStorage.setItem('ai-assistant-connection-token', 'old-token');
    const state = createConnectionConfig();
    state.connectionPersistEnabled.value = false;

    state.persistConnectionConfigIfEnabled();

    expect(localStorage.getItem(state.connectionBaseUrlStorageKey)).toBeNull();
    expect(localStorage.getItem(state.connectionTokenStorageKey)).toBeNull();
  });

  it('applies the default diagnostics base URL message', () => {
    const state = createConnectionConfig();

    state.useDefaultBaseUrlForDiagnostics();

    expect(state.connectionBaseUrlInput.value).toBe('/ai-assistant');
    expect(state.connectionConfigMessage.value).toBe('Default applied');
  });
});
