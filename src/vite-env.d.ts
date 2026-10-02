/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ANTHROPIC_API_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

// vite.config の define で ビルドごとに さしこまれる ばんごう（れい: 10-03-1631）
declare const __BUILD_ID__: string
