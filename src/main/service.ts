import type { Store, SolveRow } from './db'
import type {
  DashboardData, ExternalPick, Guide, GuideProblem, MarkSolvedInput, PicksData, Platform, PlatformSummary,
  ProblemKey, Recommendation, RevisionDue, SheetStatus, StatsData, TodayData, TopicStat
} from '@shared/types'
import { PLATFORMS } from '@shared/types'
import { DAY_MS, addDays, dateKey, daysBetween, parseDateKey, streaks } from '@shared/dates'
import { currentWeek, recommend, topicStats } from './engine/recommend'
import { schedule } from './engine/revision'
import { pickNearRating } from './engine/potd'
import { atcoderMeta, cfDifficulty, type SyncContext } from './sync'
import * as lc from './sync/leetcode'
import * as gfg from './sync/gfg'
import * as cf from './sync/codeforces'
import { acUrl, clipDifficulty } from './sync/atcoder'

export class Service {
  readonly guideBySlug: Map<string, GuideProblem>
  readonly guideByNo: Map<number, GuideProblem>
  readonly essential: Set<number>

  constructor(
    readonly store: Store,
    readonly guide: Guide
  ) {
    this.guideBySlug = new Map()
    this.guideByNo = new Map(guide.problems.map((p) => [p.no, p]))
    // Cross-listed problems share a slug; the first (lower-numbered) listing owns it.
    for (const p of guide.problems) if (!this.guideBySlug.has(p.slug)) this.guideBySlug.set(p.slug, p)
    this.essential = new Set(guide.lists.essential)
    store.transaction(() => {
      for (const p of this.guideBySlug.values()) {
        store.upsertProblem({ key: `lc:${p.slug}`, platform: 'leetcode', title: p.title, url: p.url, difficulty: p.difficulty, topic: p.topic, guideNo: p.no })
      }
    })
  }

  get syncContext(): SyncContext {
    return { store: this.store, guideBySlug: this.guideBySlug, essential: this.essential }
  }

  // ---------------------------------------------------------------- helpers
  private trackProblems(): GuideProblem[] {
    const ids = this.guide.tracks[this.store.getSettings().track]
    return ids.map((n) => this.guideByNo.get(n)!).filter(Boolean)
  }

  private solvedSlugs(): Set<string> {
    return new Set([...this.store.solvedKeys()].filter((k) => k.startsWith('lc:')).map((k) => k.slice(3)))
  }

  private weekInfo(today = dateKey()): { week: ReturnType<typeof currentWeek>; weekNumber: number } {
    const days = daysBetween(this.store.getSettings().roadmapStart, today)
    const week = currentWeek(this.guide.roadmap, days)
    return { week, weekNumber: days < 0 ? 0 : Math.floor(days / 7) + 1 }
  }

  /** Solves that happened on a known day (undated bulk imports excluded). */
  private datedSolves(): SolveRow[] {
    return this.store.allSolves().filter((s) => s.source !== 'import')
  }

  private recommendations(limit: number): Recommendation[] {
    const solvedSlugs = this.solvedSlugs()
    const since = Date.now() - 30 * DAY_MS
    const mistakesByTopic = new Map<string, number>()
    for (const m of this.store.listMistakes()) {
      if (m.createdAt < since || !m.problemKey) continue
      const topic = this.store.getProblem(m.problemKey)?.topic
      if (topic) mistakesByTopic.set(topic, (mistakesByTopic.get(topic) ?? 0) + 1)
    }
    const shakyByTopic = new Map<string, number>()
    for (const s of this.store.allSolves()) {
      if (s.confidence === 1 && s.topic) shakyByTopic.set(s.topic, (shakyByTopic.get(s.topic) ?? 0) + 1)
    }
    return recommend({ problems: this.trackProblems(), solvedSlugs, week: this.weekInfo().week, mistakesByTopic, shakyByTopic }, limit)
  }

  // ---------------------------------------------------------------- reads
  sheetStatus(): SheetStatus {
    const solved: SheetStatus['solved'] = {}
    for (const s of this.store.allSolves()) {
      if (s.key.startsWith('lc:')) solved[s.key.slice(3)] = { solvedAt: s.solvedAt, confidence: s.confidence, timeTakenMin: s.timeTakenMin, source: s.source }
    }
    const revisions: SheetStatus['revisions'] = {}
    for (const r of this.store.allRevisions()) if (r.key.startsWith('lc:')) revisions[r.key.slice(3)] = r
    return { solved, revisions }
  }

  today(): TodayData {
    const date = dateKey()
    const recs = this.recommendations(6)

    // The sheet POTD is fixed for the day once chosen, even after it gets solved.
    const cacheKey = `sheet-potd:${date}`
    let potdNo = this.store.cacheGet<number>(cacheKey, 2 * DAY_MS)
    if (potdNo == null && recs[0]) {
      potdNo = recs[0].problem.no
      this.store.cacheSet(cacheKey, potdNo)
    }
    const sheetPotd = potdNo == null ? null : (recs.find((r) => r.problem.no === potdNo) ?? { problem: this.guideByNo.get(potdNo)!, score: 0, reasons: ['Today’s pick'] })

    const endOfToday = parseDateKey(addDays(date, 1)).getTime()
    const revisionsDue = this.revisions().filter((r) => r.dueAt < endOfToday).slice(0, 8)

    const solvedToday = this.datedSolves().filter((s) => dateKey(s.solvedAt) === date).map((s) => s.key)
    return {
      date,
      sheetPotd,
      recommendations: recs.filter((r) => r.problem.no !== potdNo).slice(0, 5),
      revisionsDue,
      solvedToday,
      dailyGoal: this.store.getSettings().dailyGoal
    }
  }

  /** Every scheduled revision, soonest first. */
  revisions(): RevisionDue[] {
    return this.store
      .allRevisions()
      .map((r) => ({ ...r, problem: this.store.getProblem(r.key)!, overdueDays: Math.max(0, Math.floor((Date.now() - r.dueAt) / DAY_MS)) }))
      .filter((r) => r.problem)
  }

  dashboard(): DashboardData {
    const settings = this.store.getSettings()
    const today = dateKey()
    const dated = this.datedSolves()
    const perDay = new Map<string, number>()
    for (const s of dated) perDay.set(dateKey(s.solvedAt), (perDay.get(dateKey(s.solvedAt)) ?? 0) + 1)
    const { current, longest } = streaks(perDay.keys(), today)

    const heatmap: DashboardData['heatmap'] = []
    for (let i = 364; i >= 0; i--) {
      const d = addDays(today, -i)
      heatmap.push({ date: d, count: perDay.get(d) ?? 0 })
    }

    const solvedSlugs = this.solvedSlugs()
    const track = this.trackProblems()
    const uniq = (ps: GuideProblem[]): GuideProblem[] => [...new Map(ps.map((p) => [p.slug, p])).values()]
    const trackUniq = uniq(track)
    const { week, weekNumber } = this.weekInfo(today)
    const weekProblems = week?.from != null ? uniq(track.filter((p) => p.no >= week.from! && p.no <= week.to!)) : []

    const stats = topicStats(track, solvedSlugs)
    const started = stats.filter((s) => s.solved > 0 && s.weakness > 0)
    const weakTopics = (started.length >= 3 ? started : stats.filter((s) => s.weakness > 0))
      .sort((a, b) => b.weakness - a.weakness)
      .slice(0, 3)

    return {
      streak: current,
      longestStreak: longest,
      solvedToday: perDay.get(today) ?? 0,
      dailyGoal: settings.dailyGoal,
      heatmap,
      track: settings.track,
      trackDone: trackUniq.filter((p) => solvedSlugs.has(p.slug)).length,
      trackTotal: trackUniq.length,
      week,
      weekNumber,
      weekDone: weekProblems.filter((p) => solvedSlugs.has(p.slug)).length,
      weekTotal: weekProblems.length,
      platforms: this.platformSummaries(),
      weakTopics,
      totalSolved: this.store.solvedKeys().size
    }
  }

  platformSummaries(): PlatformSummary[] {
    const settings = this.store.getSettings()
    return PLATFORMS.map((platform) => {
      const s = this.store.getSyncState(platform)
      return { platform, username: settings.usernames[platform], solved: s.solved ?? 0, rating: s.rating, maxRating: s.maxRating, lastSync: s.lastSync, error: s.error }
    })
  }

  stats(): StatsData {
    const solvedSlugs = this.solvedSlugs()
    const track = this.trackProblems()
    const order = new Map(this.guide.topics.map((t, i) => [t.name, i]))
    const topics: TopicStat[] = topicStats(track, solvedSlugs).sort((a, b) => order.get(a.topic)! - order.get(b.topic)!)

    const uniqTrack = [...new Map(track.map((p) => [p.slug, p])).values()]
    const byDifficulty = (['Easy', 'Medium', 'Hard'] as const).map((difficulty) => {
      const ps = uniqTrack.filter((p) => p.difficulty === difficulty)
      return { difficulty, solved: ps.filter((p) => solvedSlugs.has(p.slug)).length, total: ps.length }
    })

    const all = this.store.allSolves()
    const dated = all.filter((s) => s.source !== 'import')
    const perWeek: StatsData['perWeek'] = []
    const monday = (t: number | string): string => {
      const d = typeof t === 'string' ? parseDateKey(t) : new Date(t)
      d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
      return dateKey(d)
    }
    const thisMonday = monday(dateKey())
    const counts = new Map<string, number>()
    for (const s of dated) counts.set(monday(s.solvedAt), (counts.get(monday(s.solvedAt)) ?? 0) + 1)
    for (let i = 11; i >= 0; i--) {
      const w = addDays(thisMonday, -7 * i)
      perWeek.push({ week: w, count: counts.get(w) ?? 0 })
    }

    const byPlatform = PLATFORMS.map((platform) => ({ platform, count: all.filter((s) => s.platform === platform).length }))
    const ratingHistory = (['codeforces', 'atcoder', 'leetcode'] as Platform[])
      .map((platform) => ({ platform, points: this.store.ratingHistory(platform) }))
      .filter((r) => r.points.length > 0)
    const conf = all.filter((s) => s.confidence != null)
    return {
      topics,
      byDifficulty,
      perWeek,
      byPlatform,
      ratingHistory,
      totalMinutes: all.reduce((a, s) => a + (s.timeTakenMin ?? 0), 0),
      avgConfidence: conf.length ? conf.reduce((a, s) => a + s.confidence!, 0) / conf.length : null
    }
  }

  // ---------------------------------------------------------------- network picks
  async picks(): Promise<PicksData> {
    const date = dateKey()
    const errors: PicksData['errors'] = {}
    const cached = async <T>(name: keyof PicksData['errors'], fn: () => Promise<T | null>): Promise<T | null> => {
      const key = `pick:${name}:${date}`
      const hit = this.store.cacheGet<T>(key, 2 * DAY_MS)
      if (hit) return hit
      try {
        const v = await fn()
        if (v) this.store.cacheSet(key, v)
        return v
      } catch (e) {
        errors[name] = (e as Error).message
        return null
      }
    }
    const [lcDaily, gfgPotd, cfPick, acPick] = await Promise.all([
      cached('lcDaily', () => lc.fetchDaily()),
      cached('gfgPotd', () => gfg.fetchPotd()),
      cached('cfPick', () => this.cfPick(date)),
      cached('acPick', () => this.acPick(date))
    ])
    return { lcDaily, gfgPotd, cfPick, acPick, errors }
  }

  private async cfPick(date: string): Promise<ExternalPick | null> {
    type Lite = { key: string; title: string; url: string; rating: number | null; tags: string[] }
    let set = this.store.cacheGet<Lite[]>('cf-problemset', 3 * DAY_MS)
    if (!set) {
      set = (await cf.fetchProblemset())
        .filter((p) => p.rating != null && p.contestId != null)
        .map((p) => ({ key: cf.cfKey(p), title: `${p.contestId}${p.index}. ${p.name}`, url: cf.cfUrl(p), rating: p.rating ?? null, tags: p.tags }))
      this.store.cacheSet('cf-problemset', set)
    }
    const rating = this.store.getSyncState('codeforces').rating ?? 900
    const p = pickNearRating(set, rating, this.store.solvedKeys(), `cf:${date}`, [50, 250])
    return p ? { ...p, platform: 'codeforces', difficulty: cfDifficulty(p.rating) } : null
  }

  private async acPick(date: string): Promise<ExternalPick | null> {
    const { titles, difficulty, contest } = await atcoderMeta(this.store)
    // Stick to ABC: regular, well-graded practice material.
    const set = [...difficulty]
      .filter(([id]) => id.startsWith('abc') && titles.has(id))
      .map(([id, d]) => ({ key: `ac:${id}`, id, rating: clipDifficulty(d) }))
    const rating = this.store.getSyncState('atcoder').rating ?? 400
    const p = pickNearRating(set, rating, this.store.solvedKeys(), `ac:${date}`, [0, 200])
    if (!p) return null
    return { key: p.key, platform: 'atcoder', title: titles.get(p.id)!, url: acUrl(contest.get(p.id) ?? p.id.split('_')[0], p.id), rating: p.rating, difficulty: cfDifficulty(p.rating) }
  }

  // ---------------------------------------------------------------- writes
  markSolved({ problem, confidence, timeTakenMin }: MarkSolvedInput): void {
    const now = Date.now()
    const g = problem.key.startsWith('lc:') ? this.guideBySlug.get(problem.key.slice(3)) : undefined
    this.store.upsertProblem({ ...problem, topic: problem.topic ?? g?.topic ?? null, guideNo: g?.no ?? null })
    this.store.addSolve(problem.key, { solvedAt: now, source: 'manual', confidence, timeTakenMin })
    const prev = this.store.getRevision(problem.key)
    this.store.setRevision({ key: problem.key, ...schedule(prev?.reps ?? null, confidence, now, !!g && this.essential.has(g.no)) })
  }

  unmarkSolved(key: ProblemKey): void {
    this.store.removeSolve(key)
  }

  reviewDone(key: ProblemKey, confidence: number): void {
    const prev = this.store.getRevision(key)
    const g = key.startsWith('lc:') ? this.guideBySlug.get(key.slice(3)) : undefined
    this.store.setRevision({ key, ...schedule(prev?.reps ?? null, confidence, Date.now(), !!g && this.essential.has(g.no)) })
  }
}
