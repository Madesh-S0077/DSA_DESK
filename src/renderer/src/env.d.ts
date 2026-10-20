/// <reference types="vite/client" />
import type { Api, ApiEvents } from "@shared/api"

declare global {
  interface Window {
    api: Api & ApiEvents
  }
}
