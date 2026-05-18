/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_ADMIN_PRIMARY_EMAIL?: string;
  readonly VITE_ADMIN_EMAILS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
