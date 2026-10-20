import { create } from 'zustand'
import { useEffect, useState } from 'react'
import type { Guide, ProblemRef, Settings, SheetStatus } from '@shared/types'

export interface FocusSession {
  problem: ProblemRef
  /** Pattern-card style hint revealed on demand. */
  hint?: string
  minutes: number
  startedAt: number
}

interface AppState {
  guide: Guide | null
  settings: Settings | null
  sheet: SheetStatus
  /** Bumped whenever the main process reports changed data; views refetch on change. */
  version: number
  solveTarget: ProblemRef | null
  mistakeTarget: ProblemRef | null
  focus: FocusSession | null
  celebrate: number
  init(): Promise<void>
  refresh(): Promise<void>
  setSettings(patch: Partial<Settings>): Promise<void>
  openSolve(p: ProblemRef | null): void
  openMistake(p: ProblemRef | null): void
  startFocus(f: Omit<FocusSession, 'startedAt'> | null): void
  triggerCelebrate(): void
}

let initialised = false

export const useApp = create<AppState>((set, get) => ({
  guide: null,
  settings: null,
  sheet: { solved: {}, revisions: {} },
  version: 0,
  solveTarget: null,
  mistakeTarget: null,
  focus: null,
  celebrate: 0,
  async init() {
    // StrictMode mounts effects twice; subscribe only once.
    if (initialised) return
    initialised = true
    const [guide, settings, sheet] = await Promise.all([window.api.getGuide(), window.api.getSettings(), window.api.getSheetStatus()])
    set({ guide, settings, sheet })
    window.api.onDataChanged(() => void get().refresh())
  },
  async refresh() {
    const [settings, sheet] = await Promise.all([window.api.getSettings(), window.api.getSheetStatus()])
    set((s) => ({ settings, sheet, version: s.version + 1 }))
  },
  async setSettings(patch) {
    const settings = await window.api.setSettings(patch)
    set({ settings })
  },
  openSolve: (p) => set({ solveTarget: p }),
  openMistake: (p) => set({ mistakeTarget: p }),
  startFocus: (f) => set({ focus: f ? { ...f, startedAt: Date.now() } : null }),
  triggerCelebrate: () => set((s) => ({ celebrate: s.celebrate + 1 }))
}))

/** Loads data from the main process and reloads it whenever app data changes. */
export function useData<T>(fetcher: () => Promise<T>, deps: unknown[] = []): { data: T | null; loading: boolean; error: string | null } {
  const version = useApp((s) => s.version)
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let alive = true
    setLoading(true)
    fetcher()
      .then((d) => alive && (setData(d), setError(null)))
      .catch((e: Error) => alive && setError(e.message))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, ...deps])
  return { data, loading, error }
}
