/// <reference types="vite/client" />

import type { TaskifyAPI } from '../../preload'

declare global {
  interface Window {
    taskify: TaskifyAPI
  }
}
