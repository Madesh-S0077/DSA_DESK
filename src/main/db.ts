import Database from 'better-sqlite3'
import type {
  Mistake, MistakeInput, Platform, ProblemKey, ProblemRef, RevisionInfo, Settings, SolveInfo
} from '@shared/types'
import { dateKey } from '@shared/dates'

const SCHEMA = `
create table if not exists problems (
  key text primary key,
  platform text not null,
  title text not null,
  url text not null,
  difficulty text,
  rating integer,
  topic text,
  guide_no integer
);
create table if not exists solves (
  id integer primary key,
  problem_key text not null unique,
  solved_at integer not null,
  source text not null,
  time_taken_min integer,
  confidence integer
);
create table if not exists revisions (
  problem_key text primary key,
  due_at integer not null,
  interval_days integer not null,
  reps integer not null default 0
);
create table if not exists mistakes (
  id integer primary key,
  problem_key text,
  title text not null,
  mistake text not null default '',
  why text not null default '',
  insight text not null default '',
  pattern text not null default '',
  avoid text not null default '',
  created_at integer not null
);
create table if not exists settings (key text primary key, value text not null);
create table if not exists sync_state (
  platform text primary key,
  last_sync integer,
  cursor integer,
  rating integer,
  max_rating integer,
  solved integer,
  error text
);
create table if not exists rating_history (platform text not null, t integer not null, rating integer not null, primary key (platform, t));
create table if not exists cache (key text primary key, value text not null, fetched_at integer not null);
`

export const DEFAULT_SETTINGS: Settings = {
  onboarded: false,
  name: '',
  usernames: { leetcode: '', codeforces: '', atcoder: '', gfg: '' },
  lcSession: '',
  track: 'B',
  roadmapStart: dateKey(),
  dailyGoal: 3,
  reminders: true,
  reminderTime: '20:00',
  launchAtStartup: false,
  theme: 'system',
  targetCompanies: [],
  contestPlatforms: ['leetcode', 'codeforces', 'atcoder', 'gfg'],
  contestReminders: true,
  contestLeadMin: 30,
  aiModel: 'gemini-3.6-flash'
}

/** Settings-table rows that hold secrets rather than `Settings` fields. */
const SECRET_PREFIX = 'secret:'

export interface SyncState {
  platform: Platform
  lastSync: number | null
  cursor: number | null
  rating: number | null
  maxRating: number | null
  solved: number | null
  error: string | null
}

export interface SolveRow extends SolveInfo {
  key: ProblemKey
  platform: Platform
  title: string
  url: string
  difficulty: string | null
  topic: string | null
  guideNo: number | null
}

export class Store {
  readonly db: Database.Database

  constructor(file: string) {
    this.db = new Database(file)
    this.db.pragma('journal_mode = WAL')
    this.db.exec(SCHEMA)
  }

  // ---------------------------------------------------------------- settings
  getSettings(): Settings {
    const rows = this.db.prepare(`select key, value from settings where key not like '${SECRET_PREFIX}%'`).all() as { key: string; value: string }[]
    const stored = Object.fromEntries(rows.map((r) => [r.key, JSON.parse(r.value)]))
    const s = { ...DEFAULT_SETTINGS, ...stored } as Settings
    s.usernames = { ...DEFAULT_SETTINGS.usernames, ...(stored.usernames ?? {}) }
    if (!stored.roadmapStart) this.setSettings({ roadmapStart: s.roadmapStart })
    return s
  }

  setSettings(patch: Partial<Settings>): Settings {
    const put = this.db.prepare('insert into settings (key, value) values (?, ?) on conflict(key) do update set value = excluded.value')
    this.db.transaction(() => {
      for (const [k, v] of Object.entries(patch)) put.run(k, JSON.stringify(v))
    })()
    return this.getSettings()
  }

  /** Raw (already encrypted) secret, or null. */
  getSecret(name: string): string | null {
    const r = this.db.prepare('select value from settings where key = ?').get(SECRET_PREFIX + name) as { value: string } | undefined
    return r ? r.value : null
  }

  setSecret(name: string, value: string | null): void {
    if (value === null) this.db.prepare('delete from settings where key = ?').run(SECRET_PREFIX + name)
    else this.db.prepare('insert into settings (key, value) values (?, ?) on conflict(key) do update set value = excluded.value').run(SECRET_PREFIX + name, value)
  }

  // ---------------------------------------------------------------- problems & solves
  upsertProblem(p: ProblemRef): void {
    this.db
      .prepare(
        `insert into problems (key, platform, title, url, difficulty, rating, topic, guide_no)
         values (@key, @platform, @title, @url, @difficulty, @rating, @topic, @guideNo)
         on conflict(key) do update set title = excluded.title, url = excluded.url,
           difficulty = coalesce(excluded.difficulty, problems.difficulty),
           rating = coalesce(excluded.rating, problems.rating),
           topic = coalesce(excluded.topic, problems.topic),
           guide_no = coalesce(excluded.guide_no, problems.guide_no)`
      )
      .run({ difficulty: null, rating: null, topic: null, guideNo: null, ...p })
  }

  /** Records a solve. Keeps the earliest solve time; manual metadata (confidence, time) overrides. Returns true if new. */
  addSolve(key: ProblemKey, info: SolveInfo): boolean {
    const existing = this.getSolve(key)
    if (!existing) {
      this.db
        .prepare('insert into solves (problem_key, solved_at, source, time_taken_min, confidence) values (?, ?, ?, ?, ?)')
        .run(key, info.solvedAt, info.source, info.timeTakenMin, info.confidence)
      return true
    }
    // A timestamped sync beats a timeless import; otherwise keep the earliest time.
    const solvedAt =
      existing.source === 'import' && info.source !== 'import' ? info.solvedAt : Math.min(existing.solvedAt, info.solvedAt)
    const source = existing.source === 'import' && info.source !== 'import' ? info.source : existing.source
    this.db
      .prepare(
        `update solves set solved_at = ?, source = ?, time_taken_min = coalesce(?, time_taken_min),
         confidence = coalesce(?, confidence) where problem_key = ?`
      )
      .run(solvedAt, source, info.timeTakenMin, info.confidence, key)
    return false
  }

  removeSolve(key: ProblemKey): void {
    this.db.prepare('delete from solves where problem_key = ?').run(key)
    this.db.prepare('delete from revisions where problem_key = ?').run(key)
  }

  getSolve(key: ProblemKey): SolveInfo | null {
    const r = this.db
      .prepare('select solved_at, source, time_taken_min, confidence from solves where problem_key = ?')
      .get(key) as { solved_at: number; source: SolveInfo['source']; time_taken_min: number | null; confidence: number | null } | undefined
    return r ? { solvedAt: r.solved_at, source: r.source, timeTakenMin: r.time_taken_min, confidence: r.confidence } : null
  }

  allSolves(): SolveRow[] {
    const rows = this.db
      .prepare(
        `select s.problem_key key, s.solved_at, s.source, s.time_taken_min, s.confidence,
                p.platform, p.title, p.url, p.difficulty, p.topic, p.guide_no
         from solves s left join problems p on p.key = s.problem_key order by s.solved_at`
      )
      .all() as Record<string, unknown>[]
    return rows.map((r) => ({
      key: r.key as string,
      solvedAt: r.solved_at as number,
      source: r.source as SolveInfo['source'],
      timeTakenMin: r.time_taken_min as number | null,
      confidence: r.confidence as number | null,
      platform: ((r.platform as string) ?? (r.key as string).split(':')[0]) as Platform,
      title: (r.title as string) ?? (r.key as string),
      url: (r.url as string) ?? '',
      difficulty: r.difficulty as string | null,
      topic: r.topic as string | null,
      guideNo: r.guide_no as number | null
    }))
  }

  solvedKeys(): Set<ProblemKey> {
    return new Set((this.db.prepare('select problem_key from solves').pluck().all() as string[]))
  }

  getProblem(key: ProblemKey): ProblemRef | null {
    const r = this.db.prepare('select * from problems where key = ?').get(key) as Record<string, unknown> | undefined
    if (!r) return null
    return {
      key: r.key as string,
      platform: r.platform as Platform,
      title: r.title as string,
      url: r.url as string,
      difficulty: r.difficulty as string | null,
      rating: r.rating as number | null,
      topic: r.topic as string | null,
      guideNo: r.guide_no as number | null
    }
  }

  // ---------------------------------------------------------------- revisions
  getRevision(key: ProblemKey): RevisionInfo | null {
    const r = this.db.prepare('select * from revisions where problem_key = ?').get(key) as
      | { problem_key: string; due_at: number; interval_days: number; reps: number }
      | undefined
    return r ? { key: r.problem_key, dueAt: r.due_at, intervalDays: r.interval_days, reps: r.reps } : null
  }

  setRevision(r: RevisionInfo): void {
    this.db
      .prepare(
        `insert into revisions (problem_key, due_at, interval_days, reps) values (?, ?, ?, ?)
         on conflict(problem_key) do update set due_at = excluded.due_at, interval_days = excluded.interval_days, reps = excluded.reps`
      )
      .run(r.key, r.dueAt, r.intervalDays, r.reps)
  }

  allRevisions(): RevisionInfo[] {
    return (this.db.prepare('select * from revisions order by due_at').all() as Record<string, number | string>[]).map((r) => ({
      key: r.problem_key as string,
      dueAt: r.due_at as number,
      intervalDays: r.interval_days as number,
      reps: r.reps as number
    }))
  }

  // ---------------------------------------------------------------- mistakes
  listMistakes(): Mistake[] {
    return (this.db.prepare('select * from mistakes order by created_at desc').all() as Record<string, unknown>[]).map((r) => ({
      id: r.id as number,
      problemKey: r.problem_key as string | null,
      title: r.title as string,
      mistake: r.mistake as string,
      why: r.why as string,
      insight: r.insight as string,
      pattern: r.pattern as string,
      avoid: r.avoid as string,
      createdAt: r.created_at as number
    }))
  }

  addMistake(m: MistakeInput): void {
    this.db
      .prepare(
        `insert into mistakes (problem_key, title, mistake, why, insight, pattern, avoid, created_at)
         values (@problemKey, @title, @mistake, @why, @insight, @pattern, @avoid, @createdAt)`
      )
      .run({ ...m, createdAt: Date.now() })
  }

  deleteMistake(id: number): void {
    this.db.prepare('delete from mistakes where id = ?').run(id)
  }

  // ---------------------------------------------------------------- sync state, ratings, cache
  getSyncState(platform: Platform): SyncState {
    const r = this.db.prepare('select * from sync_state where platform = ?').get(platform) as Record<string, number | string | null> | undefined
    return {
      platform,
      lastSync: (r?.last_sync as number) ?? null,
      cursor: (r?.cursor as number) ?? null,
      rating: (r?.rating as number) ?? null,
      maxRating: (r?.max_rating as number) ?? null,
      solved: (r?.solved as number) ?? null,
      error: (r?.error as string) ?? null
    }
  }

  setSyncState(platform: Platform, patch: Partial<Omit<SyncState, 'platform'>>): void {
    const s = { ...this.getSyncState(platform), ...patch }
    this.db
      .prepare(
        `insert into sync_state (platform, last_sync, cursor, rating, max_rating, solved, error)
         values (@platform, @lastSync, @cursor, @rating, @maxRating, @solved, @error)
         on conflict(platform) do update set last_sync = excluded.last_sync, cursor = excluded.cursor, rating = excluded.rating,
           max_rating = excluded.max_rating, solved = excluded.solved, error = excluded.error`
      )
      .run(s)
  }

  /** Forget everything synced for a platform (e.g. after a username change). Manual solves stay. */
  resetPlatform(platform: Platform): void {
    this.db.prepare(`delete from solves where source != 'manual' and problem_key in (select key from problems where platform = ?)`).run(platform)
    this.db.prepare('delete from sync_state where platform = ?').run(platform)
    this.db.prepare('delete from rating_history where platform = ?').run(platform)
  }

  setRatingHistory(platform: Platform, points: { t: number; rating: number }[]): void {
    const put = this.db.prepare('insert or replace into rating_history (platform, t, rating) values (?, ?, ?)')
    this.db.transaction(() => points.forEach((p) => put.run(platform, p.t, p.rating)))()
  }

  ratingHistory(platform: Platform): { t: number; rating: number }[] {
    return this.db.prepare('select t, rating from rating_history where platform = ? order by t').all(platform) as { t: number; rating: number }[]
  }

  cacheGet<T>(key: string, maxAgeMs: number): T | null {
    const r = this.db.prepare('select value, fetched_at from cache where key = ?').get(key) as { value: string; fetched_at: number } | undefined
    if (!r || Date.now() - r.fetched_at > maxAgeMs) return null
    return JSON.parse(r.value) as T
  }

  cacheSet(key: string, value: unknown): void {
    this.db
      .prepare('insert into cache (key, value, fetched_at) values (?, ?, ?) on conflict(key) do update set value = excluded.value, fetched_at = excluded.fetched_at')
      .run(key, JSON.stringify(value), Date.now())
  }

  transaction<T>(fn: () => T): T {
    return this.db.transaction(fn)()
  }
}
