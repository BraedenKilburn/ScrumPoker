/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PRIMEVUE_LICENSE_KEY: string;
  readonly VITE_SOCKET_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
