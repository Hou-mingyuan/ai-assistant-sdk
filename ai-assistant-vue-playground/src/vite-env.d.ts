/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_AI_ASSISTANT_BASE_URL?: string
  readonly VITE_AI_ASSISTANT_ACCESS_TOKEN?: string
  readonly VITE_AI_ASSISTANT_PROXY_TARGET?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
