import type {
  DashboardData, Guide, MarkSolvedInput, Mistake, MistakeInput, PicksData, Platform, PlatformSummary,
  ProblemKey, RevisionDue, Settings, SheetStatus, StatsData, SyncResult, TodayData
} from './types'

/** Everything the renderer can ask the main process for. Each key is also its IPC channel name. */
export interface Api {
  getGuide(): Promise<Guide>
  getSettings(): Promise<Settings>
  setSettings(patch: Partial<Settings>): Promise<Settings>
  getSheetStatus(): Promise<SheetStatus>
  getToday(): Promise<TodayData>
  getPicks(): Promise<PicksData>
  getRevisions(): Promise<RevisionDue[]>
  getDashboard(): Promise<DashboardData>
  getStats(): Promise<StatsData>
  getPlatforms(): Promise<PlatformSummary[]>
  markSolved(input: MarkSolvedInput): Promise<void>
  unmarkSolved(key: ProblemKey): Promise<void>
  reviewDone(key: ProblemKey, confidence: number): Promise<void>
  listMistakes(): Promise<Mistake[]>
  addMistake(m: MistakeInput): Promise<void>
  deleteMistake(id: number): Promise<void>
  sync(platform?: Platform): Promise<SyncResult[]>
  openExternal(url: string): Promise<void>
}

export const API_METHODS: (keyof Api)[] = [
  'getGuide', 'getSettings', 'setSettings', 'getSheetStatus', 'getToday', 'getPicks', 'getRevisions', 'getDashboard', 'getStats',
  'getPlatforms', 'markSolved', 'unmarkSolved', 'reviewDone', 'listMistakes', 'addMistake', 'deleteMistake', 'sync',
  'openExternal'
]

/** Main → renderer push events. */
export interface ApiEvents {
  /** Local data changed (sync finished, solve marked): views should refetch. */
  onDataChanged(cb: () => void): () => void
  /** Tray/notification asked to open a page. */
  onNavigate(cb: (path: string) => void): () => void
}
