import { computed, ref, type Ref } from 'vue';

export type ConnectionMode = 'backend' | 'direct';
export type ProviderProtocol = 'openai' | 'anthropic' | 'gemini';

export interface DirectProviderConfig {
  id: string;
  name: string;
  protocol: ProviderProtocol;
  baseUrl: string;
  apiKey: string;
  models: string[];
  activeModel: string;
  presetId?: string;
}

export interface DirectModelPreset {
  id: string;
  label: string;
  protocol: ProviderProtocol;
  baseUrl: string;
  model: string;
  defaultApiKey?: string;
}

export interface ConnectionConfig {
  mode: ConnectionMode;
  backendBaseUrl: string;
  backendToken: string;
  activeProviderId: string;
  providers: DirectProviderConfig[];
  /** Synced mirror of active provider fields for backward-compatible readers. */
  directBaseUrl: string;
  directApiKey: string;
  directModel: string;
}

export const CONNECTION_CONFIG_KEY = 'ai-assistant-connection-config-v1';

export const DIRECT_MODEL_PRESETS: ReadonlyArray<DirectModelPreset> = [
  {
    id: 'openai',
    label: 'OpenAI',
    protocol: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
  },
  {
    id: 'anthropic',
    label: 'Anthropic',
    protocol: 'anthropic',
    baseUrl: 'https://api.anthropic.com',
    model: 'claude-sonnet-4-20250514',
  },
  {
    id: 'gemini',
    label: 'Gemini',
    protocol: 'gemini',
    baseUrl: 'https://generativelanguage.googleapis.com',
    model: 'gemini-2.5-flash',
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    protocol: 'openai',
    baseUrl: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat',
  },
  {
    id: 'kimi',
    label: 'Kimi',
    protocol: 'openai',
    baseUrl: 'https://api.moonshot.cn/v1',
    model: 'moonshot-v1-8k',
  },
  {
    id: 'zhipu',
    label: '智谱 GLM',
    protocol: 'openai',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    model: 'glm-4-plus',
  },
  {
    id: 'siliconflow',
    label: '硅基流动',
    protocol: 'openai',
    baseUrl: 'https://api.siliconflow.cn/v1',
    model: 'Qwen/Qwen2.5-72B-Instruct',
  },
  {
    id: 'qwen',
    label: '通义千问',
    protocol: 'openai',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    model: 'qwen-plus',
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    protocol: 'openai',
    baseUrl: 'https://openrouter.ai/api/v1',
    model: 'openai/gpt-4o-mini',
  },
];

function uniqueId(baseId: string, existing: ReadonlyArray<DirectProviderConfig>): string {
  const used = new Set(existing.map((p) => p.id));
  if (!used.has(baseId)) return baseId;
  let seq = 2;
  while (used.has(`${baseId}-${seq}`)) seq += 1;
  return `${baseId}-${seq}`;
}

export function createProviderFromPreset(
  preset: DirectModelPreset,
  existing: ReadonlyArray<DirectProviderConfig> = [],
): DirectProviderConfig {
  return {
    id: uniqueId(preset.id, existing),
    name: preset.label,
    protocol: preset.protocol,
    baseUrl: preset.baseUrl,
    apiKey: preset.defaultApiKey ?? '',
    models: [preset.model],
    activeModel: preset.model,
    presetId: preset.id,
  };
}

export function createCustomProvider(
  existing: ReadonlyArray<DirectProviderConfig> = [],
  name = '自定义供应商',
): DirectProviderConfig {
  return {
    id: uniqueId('custom', existing),
    name,
    protocol: 'openai',
    baseUrl: '',
    apiKey: '',
    models: [],
    activeModel: '',
  };
}

function normalizeProtocol(val: unknown): ProviderProtocol {
  if (val === 'anthropic' || val === 'gemini') return val;
  return 'openai';
}

function dedupeStrings(items: unknown): string[] {
  if (!Array.isArray(items)) return [];
  return Array.from(
    new Set(items.map((m) => (typeof m === 'string' ? m.trim() : '')).filter(Boolean)),
  );
}

function normalizeProvider(raw: unknown, index: number): DirectProviderConfig {
  const obj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const protocol = normalizeProtocol(obj.protocol);
  const activeModel = typeof obj.activeModel === 'string' ? obj.activeModel.trim() : '';
  const models = dedupeStrings(obj.models);
  if (activeModel && !models.includes(activeModel)) {
    models.unshift(activeModel);
  }
  const baseUrl = typeof obj.baseUrl === 'string' ? obj.baseUrl : '';
  const name =
    typeof obj.name === 'string' && obj.name.trim() ? obj.name.trim() : `Provider ${index + 1}`;
  const id = typeof obj.id === 'string' && obj.id.trim() ? obj.id.trim() : `provider-${index + 1}`;
  return {
    id,
    name,
    protocol,
    baseUrl,
    apiKey: typeof obj.apiKey === 'string' ? obj.apiKey : '',
    models,
    activeModel: activeModel || models[0] || '',
    presetId: typeof obj.presetId === 'string' ? obj.presetId : undefined,
  };
}

export function createDefaultConnectionConfig(): ConnectionConfig {
  const starter = createProviderFromPreset(DIRECT_MODEL_PRESETS[0]);
  return {
    mode: 'backend',
    backendBaseUrl: '',
    backendToken: '',
    activeProviderId: starter.id,
    providers: [starter],
    directBaseUrl: starter.baseUrl,
    directApiKey: starter.apiKey,
    directModel: starter.activeModel,
  };
}

function buildLegacyDirectProvider(obj: Record<string, unknown>): DirectProviderConfig[] {
  const def = createDefaultConnectionConfig();
  const baseUrl =
    typeof obj.directBaseUrl === 'string' && obj.directBaseUrl.trim()
      ? obj.directBaseUrl
      : def.directBaseUrl;
  const apiKey = typeof obj.directApiKey === 'string' ? obj.directApiKey : '';
  const activeModel =
    typeof obj.directModel === 'string' && obj.directModel.trim()
      ? obj.directModel.trim()
      : def.directModel;
  const cleanUrl = baseUrl.trim().replace(/\/+$/, '');
  const matchedPreset = DIRECT_MODEL_PRESETS.find((p) => p.baseUrl === cleanUrl);
  return [
    {
      id: matchedPreset ? matchedPreset.id : 'openai',
      name: matchedPreset ? matchedPreset.label : 'OpenAI',
      protocol: matchedPreset ? matchedPreset.protocol : 'openai',
      baseUrl,
      apiKey,
      models: activeModel ? [activeModel] : [],
      activeModel,
      presetId: matchedPreset?.id,
    },
  ];
}

function sanitizeConfig(raw: unknown): ConnectionConfig {
  const def = createDefaultConnectionConfig();
  if (!raw || typeof raw !== 'object') return def;
  const obj = raw as Record<string, unknown>;

  const providers =
    Array.isArray(obj.providers) && obj.providers.length > 0
      ? obj.providers.map((item, idx) => normalizeProvider(item, idx))
      : buildLegacyDirectProvider(obj);

  const requestedId = typeof obj.activeProviderId === 'string' ? obj.activeProviderId.trim() : '';
  const activeProvider = providers.find((p) => p.id === requestedId) ?? providers[0];

  return {
    mode: obj.mode === 'direct' ? 'direct' : 'backend',
    backendBaseUrl:
      typeof obj.backendBaseUrl === 'string' ? obj.backendBaseUrl : def.backendBaseUrl,
    backendToken: typeof obj.backendToken === 'string' ? obj.backendToken : def.backendToken,
    activeProviderId: activeProvider.id,
    providers,
    directBaseUrl: activeProvider.baseUrl,
    directApiKey: activeProvider.apiKey,
    directModel: activeProvider.activeModel,
  };
}

function loadStoredConnectionConfig(storageKey: string): ConnectionConfig {
  const def = createDefaultConnectionConfig();
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return def;
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return def;
    return sanitizeConfig(JSON.parse(raw));
  } catch {
    return def;
  }
}

export function useConnectionConfig(
  hostBaseUrl: Ref<string | undefined>,
  hostAccessToken: Ref<string | undefined>,
  storageKey = CONNECTION_CONFIG_KEY,
) {
  const connectionConfig = ref<ConnectionConfig>(loadStoredConnectionConfig(storageKey));

  function persist(next: ConnectionConfig) {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      /* Ignore storage quota or sandbox failures. */
    }
  }

  function saveConnectionConfig(next: ConnectionConfig | Partial<ConnectionConfig>) {
    const hasExplicitProviders = Array.isArray(next.providers);
    const hasLegacyDirectFields =
      next.directBaseUrl !== undefined ||
      next.directApiKey !== undefined ||
      next.directModel !== undefined;
    const merged =
      !hasExplicitProviders && hasLegacyDirectFields
        ? {
            mode: connectionConfig.value.mode,
            backendBaseUrl: connectionConfig.value.backendBaseUrl,
            backendToken: connectionConfig.value.backendToken,
            ...next,
          }
        : { ...connectionConfig.value, ...next };
    const cleaned = sanitizeConfig(merged);
    connectionConfig.value = cleaned;
    persist(cleaned);
  }

  function resetConnectionConfig() {
    const def = createDefaultConnectionConfig();
    connectionConfig.value = def;
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      try {
        localStorage.removeItem(storageKey);
      } catch {
        /* Ignore storage errors. */
      }
    }
  }

  const isDirectMode = computed(() => connectionConfig.value.mode === 'direct');
  const activeProvider = computed(
    () =>
      connectionConfig.value.providers.find(
        (p) => p.id === connectionConfig.value.activeProviderId,
      ) ?? connectionConfig.value.providers[0],
  );
  const activeProtocol = computed<ProviderProtocol>(() =>
    isDirectMode.value ? activeProvider.value.protocol : 'openai',
  );
  const effectiveBaseUrl = computed(() =>
    isDirectMode.value
      ? activeProvider.value.baseUrl.trim()
      : connectionConfig.value.backendBaseUrl.trim() || hostBaseUrl.value?.trim() || '',
  );
  const effectiveToken = computed(() =>
    isDirectMode.value
      ? activeProvider.value.apiKey.trim()
      : connectionConfig.value.backendToken.trim() || hostAccessToken.value?.trim() || '',
  );

  return {
    connectionConfig,
    isDirectMode,
    activeProvider,
    activeProtocol,
    effectiveBaseUrl,
    effectiveToken,
    saveConnectionConfig,
    resetConnectionConfig,
  };
}
