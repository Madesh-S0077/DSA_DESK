// Types shared by the main process, preload bridge and renderer.

export type Platform = 'leetcode' | 'codeforces' | 'atcoder' | 'gfg'
export const PLATFORMS: Platform[] = ['leetcode', 'codeforces', 'atcoder', 'gfg']
export const PLATFORM_LABEL: Record<Platform, string> = {
  leetcode: 'LeetCode',
  codeforces: 'Codeforces',
  atcoder: 'AtCoder',
  gfg: 'GeeksforGeeks'
}

export type Difficulty = 'Easy' | 'Medium' | 'Hard'
export type TrackId = 'A' | 'B' | 'C'

// ---------------------------------------------------------------- guide.json
export interface PatternCard {
  signals: string
  core: string
  complexity: string
  traps: string
}

export interface GuideTopic {
  name: string
  card: PatternCard
}

export interface ProblemDetails {
  pattern?: string
  concept?: string
  why?: string
  prereqs?: string
  approach?: string
  insight?: string
  mistake?: string
  variation?: string
  companies?: string[]
  /** Asked across the board rather than at named companies; counts toward every company. */
  everywhere?: boolean
  /** The guide's remark on how often it comes up, e.g. "Extremely frequently asked". */
  companyNote?: string
  seeAlso?: number
  text?: string
}

export interface GuideProblem {
  no: number
  title: string
  difficulty: Difficulty
  /** 1 Foundation · 2 Pattern Building · 3 Interview · 4 MAANG */
  level: 1 | 2 | 3 | 4
  /** 1–5 stars */
  priority: number
  topic: string
  slug: string
  url: string
  details: ProblemDetails
}

export interface RoadmapWeek {
  week: number
  topics: string
  from: number | null
  to: number | null
  revision: string
  mock: number[]
}

export interface Simulation {
  id: number
  name: string
  problems: number[]
}

export interface Guide {
  source: string
  topics: GuideTopic[]
  problems: GuideProblem[]
  tracks: Record<TrackId, number[]>
  trackATopicOrder: string[]
  lists: { essential: number[]; core: number[]; highestRoi: number[] }
  simulations: Simulation[]
  roadmap: RoadmapWeek[]
}

// ---------------------------------------------------------------- app state
export interface Settings {
  onboarded: boolean
  name: string
  usernames: Record<Platform, string>
  /** Optional LEETCODE_SESSION cookie to import the full solved list. */
  lcSession: string
  track: TrackId
  /** YYYY-MM-DD; the roadmap week is derived from it. */
  roadmapStart: string
  dailyGoal: number
  reminders: boolean
  /** HH:MM, local time */
  reminderTime: string
  launchAtStartup: boolean
  theme: 'system' | 'light' | 'dark'
  /** Companies you are preparing for; their problems get a recommender bonus. */
  targetCompanies: string[]
  /** Platforms whose contests show up and trigger reminders. */
  contestPlatforms: Platform[]
  contestReminders: boolean
  /** Minutes before a contest starts to send the reminder. */
  contestLeadMin: number
  /** Gemini model used for AI help, e.g. `gemini-3.6-flash`. */
  aiModel: string
}

/** Platform-qualified id: `lc:two-sum`, `cf:1520A`, `ac:abc300_a`, `gfg:<slug>`. */
export type ProblemKey = string

export interface ProblemRef {
  key: ProblemKey
  platform: Platform
  title: string
  url: string
  difficulty?: string | null
  rating?: number | null
  topic?: string | null
  guideNo?: number | null
}

export interface SolveInfo {
  solvedAt: number
  confidence: number | null
  timeTakenMin: number | null
  source: 'manual' | 'sync' | 'import'
}

export interface RevisionInfo {
  key: ProblemKey
  dueAt: number
  intervalDays: number
  reps: number
}

export interface SheetStatus {
  solved: Record<string, SolveInfo>
  revisions: Record<string, RevisionInfo>
}

export interface Recommendation {
  problem: GuideProblem
  score: number
  reasons: string[]
}

export interface TopicStat {
  topic: string
  solved: number
  total: number
  weakness: number
}

export interface ExternalPick extends ProblemRef {
  tags?: string[]
  date?: string
}

export interface RevisionDue extends RevisionInfo {
  problem: ProblemRef
  overdueDays: number
}

export interface TodayData {
  date: string
  sheetPotd: Recommendation | null
  recommendations: Recommendation[]
  revisionsDue: RevisionDue[]
  solvedToday: ProblemKey[]
  dailyGoal: number
}

/** Daily picks that need the network; loaded separately so Today renders instantly. */
export interface PicksData {
  lcDaily: ExternalPick | null
  gfgPotd: ExternalPick | null
  cfPick: ExternalPick | null
  acPick: ExternalPick | null
  errors: Partial<Record<'lcDaily' | 'gfgPotd' | 'cfPick' | 'acPick', string>>
}

export interface PlatformSummary {
  platform: Platform
  username: string
  solved: number
  rating: number | null
  maxRating: number | null
  lastSync: number | null
  error: string | null
}

export interface DashboardData {
  streak: number
  longestStreak: number
  solvedToday: number
  dailyGoal: number
  heatmap: { date: string; count: number }[]
  track: TrackId
  trackDone: number
  trackTotal: number
  week: RoadmapWeek | null
  weekNumber: number
  weekDone: number
  weekTotal: number
  platforms: PlatformSummary[]
  weakTopics: TopicStat[]
  totalSolved: number
}

export interface StatsData {
  topics: TopicStat[]
  byDifficulty: { difficulty: string; solved: number; total: number }[]
  perWeek: { week: string; count: number }[]
  byPlatform: { platform: Platform; count: number }[]
  ratingHistory: { platform: Platform; points: { t: number; rating: number }[] }[]
  totalMinutes: number
  avgConfidence: number | null
}

export interface Mistake {
  id: number
  problemKey: ProblemKey | null
  title: string
  mistake: string
  why: string
  insight: string
  pattern: string
  avoid: string
  createdAt: number
}

export type MistakeInput = Omit<Mistake, 'id' | 'createdAt'>

export interface MarkSolvedInput {
  problem: ProblemRef
  confidence: number
  timeTakenMin: number | null
}

export interface SyncResult {
  platform: Platform
  ok: boolean
  added: number
  message: string
}

export interface Contest {
  /** Platform-qualified id: `cf:2278`, `lc:weekly-contest-525`, `ac:abc481`, `gfg:<slug>`. */
  id: string
  platform: Platform
  name: string
  url: string
  /** Unix ms */
  start: number
  durationMin: number
}

export interface ContestsData {
  contests: Contest[]
  fetchedAt: number | null
  errors: Partial<Record<Platform, string>>
}

export interface CompanyStat {
  company: string
  total: number
  solved: number
  byDifficulty: { difficulty: Difficulty; solved: number; total: number }[]
  /** Unsolved ★5 problems for this company. */
  mustDoLeft: number
  /** The next few unsolved problems, easiest-first within the guide's order. */
  next: GuideProblem[]
}

/** What the AI tutor is asked for in focus mode. */
export type AiHelpKind = 'explain' | 'hint' | 'approach'
