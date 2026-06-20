/// <reference types="vite/client" />

import type { TaskifyAPI } from '../../preload'

declare global {
  interface Window {
    taskify: TaskifyAPI
  }
}

interface ImportMetaEnv {
  readonly VITE_PLATFORM?: 'capacitor' | undefined
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
