import { ref } from 'vue';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  CONNECTION_CONFIG_KEY,
  createDefaultConnectionConfig,
  createProviderFromPreset,
  DIRECT_MODEL_PRESETS,
  useConnectionConfig,
} from './useConnectionConfig';

describe('useConnectionConfig', () => {
  beforeEach(() => {
    localStorage.removeItem(CONNECTION_CONFIG_KEY);
  });

  it('defaults to backend mode using host options and resolves effective URL/token', () => {
    const hostUrl = ref('/ai-assistant');
    const hostToken = ref('host-secret');
    const state = useConnectionConfig(hostUrl, hostToken);

    expect(state.isDirectMode.value).toBe(false);
    expect(state.effectiveBaseUrl.value).toBe('/ai-assistant');
    expect(state.effectiveToken.value).toBe('host-secret');
    expect(state.activeProvider.value.id).toBe('openai');
    expect(DIRECT_MODEL_PRESETS.some((p) => p.id === 'deepseek')).toBe(true);
    expect(DIRECT_MODEL_PRESETS.some((p) => p.id === 'ollama' || p.id === 'magpie')).toBe(false);
    expect(DIRECT_MODEL_PRESETS.some((p) => p.protocol === 'anthropic')).toBe(true);
    expect(DIRECT_MODEL_PRESETS.some((p) => p.protocol === 'gemini')).toBe(true);
  });

  it('migrates legacy single-endpoint direct config cleanly into providers list', () => {
    const hostUrl = ref('/ai-assistant');
    const hostToken = ref('');
    const state = useConnectionConfig(hostUrl, hostToken);

    state.saveConnectionConfig({
      mode: 'direct',
      backendBaseUrl: '',
      backendToken: '',
      directBaseUrl: 'https://api.deepseek.com/v1',
      directApiKey: 'sk-local-demo',
      directModel: 'deepseek-chat',
    });

    expect(state.isDirectMode.value).toBe(true);
    expect(state.effectiveBaseUrl.value).toBe('https://api.deepseek.com/v1');
    expect(state.effectiveToken.value).toBe('sk-local-demo');
    expect(state.activeProvider.value.name).toBe('DeepSeek');
    expect(state.activeProvider.value.models).toContain('deepseek-chat');

    const reloaded = useConnectionConfig(hostUrl, hostToken);
    expect(reloaded.isDirectMode.value).toBe(true);
    expect(reloaded.connectionConfig.value.directModel).toBe('deepseek-chat');

    reloaded.resetConnectionConfig();
    expect(reloaded.isDirectMode.value).toBe(false);
    expect(localStorage.getItem(CONNECTION_CONFIG_KEY)).toBeNull();
  });

  it('persists multiple providers independently and switches active protocol/key/models', () => {
    const hostUrl = ref('/ai-assistant');
    const hostToken = ref('');
    const state = useConnectionConfig(hostUrl, hostToken);
    const def = createDefaultConnectionConfig();

    const openaiProv = { ...def.providers[0], apiKey: 'sk-oai-keep' };
    const anthropicPreset = DIRECT_MODEL_PRESETS.find((p) => p.id === 'anthropic')!;
    const anthropicProv = {
      ...createProviderFromPreset(anthropicPreset, [openaiProv]),
      apiKey: 'sk-ant-secret',
      models: ['claude-sonnet-4-20250514', 'claude-3-5-haiku-latest'],
      activeModel: 'claude-3-5-haiku-latest',
    };

    state.saveConnectionConfig({
      ...def,
      mode: 'direct',
      activeProviderId: anthropicProv.id,
      providers: [openaiProv, anthropicProv],
    });

    expect(state.activeProtocol.value).toBe('anthropic');
    expect(state.effectiveBaseUrl.value).toBe('https://api.anthropic.com');
    expect(state.effectiveToken.value).toBe('sk-ant-secret');
    expect(state.connectionConfig.value.directModel).toBe('claude-3-5-haiku-latest');

    const reloaded = useConnectionConfig(hostUrl, hostToken);
    expect(reloaded.connectionConfig.value.providers).toHaveLength(2);
    expect(reloaded.connectionConfig.value.providers[0].apiKey).toBe('sk-oai-keep');
    expect(reloaded.activeProtocol.value).toBe('anthropic');
  });
});
