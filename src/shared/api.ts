import type {
  AiHelpKind, CompanyStat, Contest, ContestsData, DashboardData, Guide, MarkSolvedInput, Mistake, MistakeInput, PicksData, Platform, PlatformSummary,
  ProblemKey, ProblemRef, RevisionDue, Settings, SheetStatus, StatsData, SyncResult, TodayData
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
  getCompanies(): Promise<CompanyStat[]>
  /** Cached for six hours unless `force`. */
  getContests(force?: boolean): Promise<ContestsData>
  /** Opens an .ics for the contest in the system calendar app, or Google Calendar in the browser. */
  addToCalendar(contest: Contest, target: 'app' | 'google'): Promise<void>
  markSolved(input: MarkSolvedInput): Promise<void>
  unmarkSolved(key: ProblemKey): Promise<void>
  reviewDone(key: ProblemKey, confidence: number): Promise<void>
  listMistakes(): Promise<Mistake[]>
  addMistake(m: MistakeInput): Promise<void>
  deleteMistake(id: number): Promise<void>
  sync(platform?: Platform): Promise<SyncResult[]>
  openExternal(url: string): Promise<void>
  /** Whether a Gemini key is saved. The key itself never leaves the main process. */
  hasAiKey(): Promise<boolean>
  /** Saves the Gemini key encrypted; an empty string removes it. */
  setAiKey(key: string): Promise<void>
  /** Cached per problem and kind unless `fresh`. */
  aiHelp(problem: ProblemRef, kind: AiHelpKind, fresh?: boolean): Promise<string>
}

export const API_METHODS: (keyof Api)[] = [
  'getGuide', 'getSettings', 'setSettings', 'getSheetStatus', 'getToday', 'getPicks', 'getRevisions', 'getDashboard', 'getStats',
  'getPlatforms', 'getCompanies', 'getContests', 'addToCalendar', 'markSolved', 'unmarkSolved', 'reviewDone', 'listMistakes', 'addMistake', 'deleteMistake', 'sync',
  'openExternal', 'hasAiKey', 'setAiKey', 'aiHelp'
]

/** Main → renderer push events. */
export interface ApiEvents {
  /** Local data changed (sync finished, solve marked): views should refetch. */
  onDataChanged(cb: () => void): () => void
  /** Tray/notification asked to open a page. */
  onNavigate(cb: (path: string) => void): () => void
}
