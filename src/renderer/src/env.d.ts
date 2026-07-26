/// <reference types="vite/client" />

import type { RepoDeskApi } from '../../shared/types'

declare global {
  interface Window {
    repodesk: RepoDeskApi
  }
}

export {}
