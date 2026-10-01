/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Endpoint of the AI assistant backend. When unset, the chat uses simulated replies. */
  readonly VITE_ASSISTANT_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
