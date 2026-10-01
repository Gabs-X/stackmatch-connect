/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Endpoint of the AI assistant backend. When unset, the chat uses simulated replies. */
  readonly VITE_ASSISTANT_API_URL?: string;
  /** Set to "true" on Vercel deployments to send page views to Vercel Analytics. */
  readonly VITE_VERCEL_ANALYTICS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
