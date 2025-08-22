/// <reference types="vite/client" />
interface ImportMetaEnv {
  readonly VITE_SIGNALING_SERVER: string
  // add more env variables here if needed
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}