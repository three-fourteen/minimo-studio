/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPPORT_URL?: string;
  readonly VITE_STORE_URL?: string;
  readonly VITE_OFFICIAL_BUILD?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
