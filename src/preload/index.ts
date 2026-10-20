import { contextBridge, ipcRenderer } from 'electron'
import { API_METHODS, type Api, type ApiEvents } from '@shared/api'

const api = Object.fromEntries(
  API_METHODS.map((m) => [m, (...args: unknown[]) => ipcRenderer.invoke(m, ...args)])
) as unknown as Api

const subscribe =
  (channel: string) =>
  (cb: (...args: never[]) => void): (() => void) => {
    const listener = (_: unknown, ...args: unknown[]): void => (cb as (...a: unknown[]) => void)(...args)
    ipcRenderer.on(channel, listener)
    return () => ipcRenderer.removeListener(channel, listener)
  }

const events: ApiEvents = {
  onDataChanged: subscribe('data-changed'),
  onNavigate: subscribe('navigate')
}

contextBridge.exposeInMainWorld('api', { ...api, ...events })
