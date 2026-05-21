import { ref, type ComputedRef } from 'vue';

interface ConnectionOptions {
  baseUrl?: string;
  accessToken?: string;
}

interface ConnectionConfigLabels {
  connectionConfigDefaultApplied: string;
}

interface UseConnectionConfigStateDeps {
  options: ConnectionOptions;
  t: ComputedRef<ConnectionConfigLabels>;
}

export function useConnectionConfigState(deps: UseConnectionConfigStateDeps) {
  const connectionBaseUrlInput = ref(deps.options.baseUrl || '');
  const connectionTokenInput = ref(deps.options.accessToken || '');
  const connectionPersistEnabled = ref(true);
  const connectionConfigMessage = ref('');
  const connectionBaseUrlStorageKey = 'ai-assistant-connection-base-url';
  const connectionTokenStorageKey = 'ai-assistant-connection-token';

  function syncConnectionInputsFromOptions() {
    connectionBaseUrlInput.value = deps.options.baseUrl || '';
    connectionTokenInput.value = deps.options.accessToken || '';
  }

  function applyConnectionConfigInputs() {
    const baseUrl = connectionBaseUrlInput.value.trim();
    const token = connectionTokenInput.value.trim();
    deps.options.baseUrl = baseUrl || undefined;
    deps.options.accessToken = token || undefined;
  }

  function persistConnectionConfigIfEnabled() {
    const baseUrl = connectionBaseUrlInput.value.trim();
    const token = connectionTokenInput.value.trim();
    try {
      if (!connectionPersistEnabled.value) {
        localStorage.removeItem(connectionBaseUrlStorageKey);
        localStorage.removeItem(connectionTokenStorageKey);
        return;
      }
      if (baseUrl) localStorage.setItem(connectionBaseUrlStorageKey, baseUrl);
      else localStorage.removeItem(connectionBaseUrlStorageKey);
      if (token) localStorage.setItem(connectionTokenStorageKey, token);
      else localStorage.removeItem(connectionTokenStorageKey);
    } catch {
      /* localStorage may be unavailable or full. */
    }
  }

  function useDefaultBaseUrlForDiagnostics() {
    connectionBaseUrlInput.value = '/ai-assistant';
    connectionConfigMessage.value = deps.t.value.connectionConfigDefaultApplied;
  }

  return {
    connectionBaseUrlInput,
    connectionTokenInput,
    connectionPersistEnabled,
    connectionConfigMessage,
    connectionBaseUrlStorageKey,
    connectionTokenStorageKey,
    syncConnectionInputsFromOptions,
    applyConnectionConfigInputs,
    persistConnectionConfigIfEnabled,
    useDefaultBaseUrlForDiagnostics,
  };
}
